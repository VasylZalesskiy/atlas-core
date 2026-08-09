const OPENAI_URL="https://api.openai.com/v1/responses";

function send(res,status,body){
  res.status(status).setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.end(JSON.stringify(body));
}

function cleanText(value){
  return String(value||"").replace(/\s+/g," ").trim();
}

function hostname(url){
  try{return new URL(url).hostname.replace(/^www\./,"")}catch{return ""}
}

function inferSourceType(url,allowed){
  const host=hostname(url);
  if(/(^|\.)gov\.|(^|\.)gov$|diia\.gov\.ua|kmu\.gov\.ua|msp\.gov\.ua/i.test(host))return "official";
  if(allowed.some(item=>item.source==="marketplace"))return "marketplace";
  if(allowed.some(item=>item.source==="official"))return "official";
  return "web";
}

function snippetAround(text,annotation){
  const raw=cleanText(text);
  if(!raw)return "";
  const start=Number(annotation?.start_index);
  const end=Number(annotation?.end_index);
  if(!Number.isFinite(start)||!Number.isFinite(end))return raw.slice(0,260);
  const from=Math.max(0,start-110);
  const to=Math.min(raw.length,end+170);
  return cleanText(raw.slice(from,to)).slice(0,320);
}

function extractVerifiedResults(data,allowed){
  const results=[];
  const seen=new Set();

  for(const item of data?.output||[]){
    if(item?.type==="message"){
      for(const content of item?.content||[]){
        if(content?.type!=="output_text")continue;
        const text=String(content.text||"");
        for(const annotation of content.annotations||[]){
          if(annotation?.type!=="url_citation"||!annotation.url)continue;
          const url=String(annotation.url);
          if(seen.has(url))continue;
          seen.add(url);
          results.push({
            title:cleanText(annotation.title)||hostname(url)||"Знайдене джерело",
            snippet:snippetAround(text,annotation),
            url,
            source_type:inferSourceType(url,allowed),
            price_text:"",
            location_text:""
          });
        }
      }
    }
  }

  if(results.length<3){
    for(const item of data?.output||[]){
      if(item?.type!=="web_search_call")continue;
      for(const source of item?.action?.sources||[]){
        if(source?.type!=="url"||!source.url||seen.has(source.url))continue;
        seen.add(source.url);
        results.push({
          title:hostname(source.url)||"Знайдене джерело",
          snippet:"",
          url:source.url,
          source_type:inferSourceType(source.url,allowed),
          price_text:"",
          location_text:""
        });
      }
    }
  }

  return results.slice(0,8);
}

function diagnosticSummary(data){
  const toolCalls=(data?.output||[]).filter(item=>item?.type==="web_search_call");
  const cited=[];
  for(const item of data?.output||[]){
    if(item?.type!=="message")continue;
    for(const content of item?.content||[]){
      if(content?.type!=="output_text")continue;
      for(const annotation of content.annotations||[]){
        if(annotation?.type==="url_citation"&&annotation.url)cited.push(annotation.url);
      }
    }
  }
  const sourceUrls=[];
  for(const call of toolCalls){
    for(const source of call?.action?.sources||[]){
      if(source?.type==="url"&&source.url)sourceUrls.push(source.url);
    }
  }
  return {
    response_status:data?.status||"unknown",
    incomplete_reason:data?.incomplete_details?.reason||null,
    web_search_calls:toolCalls.length,
    web_search_statuses:toolCalls.map(call=>call.status||"unknown"),
    citation_count:[...new Set(cited)].length,
    source_count:[...new Set(sourceUrls)].length,
    sample_hosts:[...new Set([...cited,...sourceUrls].map(hostname).filter(Boolean))].slice(0,5)
  };
}

async function runWebDiagnostic(apiKey,model){
  try{
    const response=await fetch(OPENAI_URL,{
      method:"POST",
      headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        model,
        store:false,
        input:"Find one current official Ukrainian government page about social assistance. Use web search and cite the source.",
        tools:[{type:"web_search",search_context_size:"low",user_location:{type:"approximate",country:"UA",region:"Ternopil"}}],
        reasoning:{effort:"minimal"},
        max_output_tokens:1200
      })
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      return {
        api_call_ok:false,
        openai_status:response.status,
        error_type:data?.error?.type||"unknown",
        error_code:data?.error?.code||"unknown",
        message:data?.error?.message||"OpenAI web search failed"
      };
    }
    return {api_call_ok:true,openai_status:response.status,model:data?.model||model,...diagnosticSummary(data)};
  }catch(error){
    return {api_call_ok:false,openai_status:0,error_type:"network_or_runtime_error",error_code:"request_failed",message:error?.message||"Request failed"};
  }
}

export default async function handler(req,res){
  const apiKey=process.env.OPENAI_API_KEY;
  const model=process.env.OPENAI_SEARCH_MODEL||process.env.OPENAI_MODEL||"gpt-5-mini";

  if(req.method==="GET"){
    const base={status:"atlas-external-search-endpoint-online",openai_key_configured:Boolean(apiKey),model};
    if(String(req.query?.test||"")==="1"){
      if(!apiKey)return send(res,200,{...base,api_call_ok:false,error_code:"openai-key-missing"});
      const diagnostic=await runWebDiagnostic(apiKey,model);
      return send(res,200,{...base,...diagnostic});
    }
    return send(res,200,base);
  }

  if(req.method!=="POST")return send(res,405,{error:"method-not-allowed"});
  if(!apiKey)return send(res,503,{error:"openai-key-missing"});

  let body={};
  try{body=typeof req.body==="string"?JSON.parse(req.body||"{}"):req.body||{}}
  catch{return send(res,400,{error:"invalid-json"})}

  const searches=Array.isArray(body.searches)?body.searches.slice(0,4):[];
  const goal=cleanText(body.goal).slice(0,700);
  const language=body.language==="en"?"en":"uk";

  if(!goal||!searches.length)return send(res,200,{results:[]});

  const allowed=searches
    .filter(item=>item&&["web","marketplace","official"].includes(item.source))
    .map(item=>({
      source:item.source,
      query:cleanText(item.query).slice(0,400),
      reason:cleanText(item.reason).slice(0,300)
    }))
    .filter(item=>item.query);

  if(!allowed.length)return send(res,200,{results:[]});

  const instructions=`You are Atlas external-search executor. Search the public web for REAL, currently accessible, actionable sources that can help solve the user's goal.\n\nCritical rules:\n- You MUST use web search.\n- Recommend only sources you actually found.\n- Cite every recommended source using web citations.\n- Never invent a URL, organization, program, listing, price, availability, person, benefit, or eligibility rule.\n- If source intent is official, prioritize authoritative government or official organization pages.\n- If source intent is marketplace, prioritize concrete offer/listing pages when possible.\n- Prefer specific actionable pages over generic home pages.\n- Give at most 6 useful sources total.\n- If reliable results are not found, say so briefly instead of inventing.\n- Write the short explanation in ${language==="uk"?"Ukrainian":"English"}.`;

  const searchPlan=allowed.map((item,index)=>`${index+1}. [${item.source}] ${item.query}${item.reason?` — ${item.reason}`:""}`).join("\n");
  const input=`Goal: ${goal}\n\nSearch tasks:\n${searchPlan}\n\nReturn a concise set of the best actionable sources. Cite each one.`;

  try{
    const response=await fetch(OPENAI_URL,{
      method:"POST",
      headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        model,
        store:false,
        instructions,
        input,
        tools:[{type:"web_search",search_context_size:"medium"}],
        reasoning:{effort:"minimal"},
        max_output_tokens:3200
      })
    });

    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      return send(res,502,{
        error:"external-search-failed",
        status:response.status,
        details:data?.error?.message||"OpenAI web search failed",
        code:data?.error?.code||""
      });
    }

    const results=extractVerifiedResults(data,allowed);
    if(results.length)return send(res,200,{results,search_status:data?.status||"completed"});

    return send(res,200,{
      results:[],
      search_status:data?.status||"unknown",
      incomplete_reason:data?.incomplete_details?.reason||null,
      diagnostic:diagnosticSummary(data)
    });
  }catch(error){
    return send(res,500,{error:"external-search-failed",details:error?.message||"Unknown error"});
  }
}
