import {
  buildMarketplaceShortcuts,extractListingQuantityTonnes,extractPriceText,extractRequestedTonnes,
  googleMapsSearchUrl,hostname,inferSourceType,isActionableCommerceResult,rankMarketplaceResults,
  resultKind,sourceGroupsFor,sourceName
} from "./_search-utils.js";

const OPENAI_URL="https://api.openai.com/v1/responses";

function send(res,status,body){
  res.status(status).setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.end(JSON.stringify(body));
}

function cleanText(value){return String(value||"").replace(/\s+/g," ").trim()}
function logAnalytics(event,data={}){console.log(JSON.stringify({level:"info",message:"atlas-analytics",event,...data}))}
function logAnalyticsError(event,error,data={}){
  console.error(JSON.stringify({level:"error",message:"atlas-analytics",event,error:String(error?.message||error||"unknown").slice(0,300),...data}));
}

function cleanSnippet(value){
  return cleanText(value)
    .replace(/https?:\/\/[^\s)\]}>,]+/gi,"")
    .replace(/\([^)]*utm_[^)]*\)/gi,"")
    .replace(/\[[^\]]*\]\([^)]*\)/g,"")
    .replace(/\butm_[a-z_]+=[^\s]+/gi,"")
    .replace(/\s+([,.;:!?])/g,"$1")
    .replace(/\(\s*\)/g,"")
    .replace(/\s{2,}/g," ")
    .trim()
    .slice(0,420);
}

function snippetAround(text,annotation){
  const raw=cleanText(text);
  if(!raw)return "";
  const start=Number(annotation?.start_index);
  const end=Number(annotation?.end_index);
  if(!Number.isFinite(start)||!Number.isFinite(end))return cleanSnippet(raw.slice(0,420));
  return cleanSnippet(raw.slice(Math.max(0,start-180),Math.min(raw.length,end+260)));
}

function enrichResult(result,sourceGroup,{locationText=""}={}){
  const combined=`${result.title||""} ${result.snippet||""}`;
  const quantity=extractListingQuantityTonnes(combined);
  const host=hostname(result.url);
  const retailer=["rozetka.com.ua","silpo.ua","metro.zakaz.ua","novus.zakaz.ua","auchan.zakaz.ua","zakaz.ua"].includes(host);
  return {
    ...result,
    source_type:inferSourceType(result.url),
    source_name:sourceName(result.url),
    source_group:sourceGroup?.id||"open-web",
    result_kind:resultKind(result.url),
    price_text:extractPriceText(combined),
    location_text:"",
    quantity_tonnes:quantity,
    quantity_text:Number.isFinite(quantity)?`${quantity} т`:"",
    verification_text:"Дані з оголошення — підтвердьте наявність, кількість і ціну у продавця",
    google_maps_url:retailer?googleMapsSearchUrl(sourceName(result.url),locationText):""
  };
}

function extractVerifiedResults(data,sourceGroup,context={}){
  const results=[];
  const seen=new Set();
  for(const item of data?.output||[]){
    if(item?.type!=="message")continue;
    for(const content of item?.content||[]){
      if(content?.type!=="output_text")continue;
      const text=String(content.text||"");
      for(const annotation of content.annotations||[]){
        if(annotation?.type!=="url_citation"||!annotation.url)continue;
        const url=String(annotation.url);
        if(seen.has(url))continue;
        seen.add(url);
        results.push(enrichResult({
          title:cleanText(annotation.title)||hostname(url)||"Знайдене джерело",
          snippet:snippetAround(text,annotation),url
        },sourceGroup,context));
      }
    }
  }
  if(results.length<3){
    for(const item of data?.output||[]){
      if(item?.type!=="web_search_call")continue;
      for(const source of item?.action?.sources||[]){
        if(source?.type!=="url"||!source.url||seen.has(source.url))continue;
        seen.add(source.url);
        results.push(enrichResult({title:hostname(source.url)||"Знайдене джерело",snippet:"",url:source.url},sourceGroup,context));
      }
    }
  }
  return results;
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

async function executeWebSearch({apiKey,model,instructions,input,searchContextSize="medium",userLocation=null,allowedDomains=[],maxOutputTokens=3200,timeoutMs=18000}){
  const webTool={type:"web_search",search_context_size:searchContextSize};
  if(userLocation)webTool.user_location=userLocation;
  if(allowedDomains.length)webTool.filters={allowed_domains:allowedDomains};
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(OPENAI_URL,{
      method:"POST",
      headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({model,store:false,instructions,input,tools:[webTool],tool_choice:"required",max_output_tokens:maxOutputTokens}),
      signal:controller.signal
    });
    const data=await response.json().catch(()=>({}));
    return {response,data};
  }finally{
    clearTimeout(timeout);
  }
}

async function runWebDiagnostic(apiKey,model){
  try{
    const {response,data}=await executeWebSearch({
      apiKey,model,input:"Find one current official Ukrainian government page about social assistance. Use web search and cite the source.",
      searchContextSize:"low",userLocation:{type:"approximate",country:"UA",region:"Ternopil"},maxOutputTokens:1200
    });
    if(!response.ok)return {api_call_ok:false,openai_status:response.status,error_type:data?.error?.type||"unknown",error_code:data?.error?.code||"unknown",message:data?.error?.message||"OpenAI web search failed"};
    return {api_call_ok:true,openai_status:response.status,model:data?.model||model,...diagnosticSummary(data)};
  }catch(error){
    return {api_call_ok:false,openai_status:0,error_type:"network_or_runtime_error",error_code:"request_failed",message:error?.message||"Request failed"};
  }
}

function searchInstructions(language){
  return `You are Atlas external-search executor. Find REAL, current, actionable sources that solve the user's goal.

Rules:
- You MUST use web search and cite every recommendation.
- Search only the domains made available by the web-search tool when domain filters are present.
- For marketplace tasks, search several wording variants and prefer individual current listings over category, home, article or advice pages.
- For bulk purchases, preserve the requested product, quantity and geography. Look for a supplier whose DECLARED quantity covers the request; if unavailable, return several smaller concrete offers that could be combined.
- For every cited listing, state in the same sentence any declared quantity, unit price or total price, location, date and delivery option visible in the source. Omit facts the source does not show.
- Listing facts are seller claims, not verified availability. Never claim Atlas confirmed stock.
- Never invent a URL, seller, listing, quantity, price, date, location, delivery, availability, eligibility or contact.
- Prefer sources where the user can contact a provider, buy, sell, apply, book or complete the next action now.
- Deprioritize guides, blogs, news, generic marketing pages and old category pages.
- Return up to 6 useful sources, best first. If none are reliable, say so instead of guessing.
- Write in ${language==="uk"?"Ukrainian":"English"}.`;
}

function deduplicate(results){
  const seen=new Set();
  return results.filter(result=>{
    let key=result.url;
    try{const url=new URL(result.url);url.hash="";[...url.searchParams.keys()].filter(name=>/^utm_|gclid|fbclid/i.test(name)).forEach(name=>url.searchParams.delete(name));key=url.toString()}catch{}
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  });
}

export default async function handler(req,res){
  const startedAt=Date.now();
  const apiKey=process.env.OPENAI_API_KEY;
  const model=process.env.OPENAI_SEARCH_MODEL||process.env.OPENAI_MODEL||"gpt-5-mini";
  if(req.method==="GET"){
    const base={status:"atlas-external-search-endpoint-online",openai_key_configured:Boolean(apiKey),model};
    if(String(req.query?.test||"")==="1"){
      if(!apiKey)return send(res,200,{...base,api_call_ok:false,error_code:"openai-key-missing"});
      return send(res,200,{...base,...await runWebDiagnostic(apiKey,model)});
    }
    return send(res,200,base);
  }
  if(req.method!=="POST")return send(res,405,{error:"method-not-allowed"});
  if(!apiKey)return send(res,503,{error:"openai-key-missing"});

  let body={};
  try{body=typeof req.body==="string"?JSON.parse(req.body||"{}"):req.body||{}}catch{return send(res,400,{error:"invalid-json"})}
  const searches=Array.isArray(body.searches)?body.searches.slice(0,4):[];
  const goal=cleanText(body.goal).slice(0,700);
  const domain=cleanText(body.domain).slice(0,160);
  const locationText=cleanText(body.location_text).slice(0,200);
  const language=body.language==="en"?"en":"uk";
  if(!goal||!searches.length)return send(res,200,{results:[],sources_checked:[]});

  const allowed=searches.filter(item=>item&&["web","marketplace","official"].includes(item.source)).map(item=>({
    source:item.source,query:cleanText(item.query).slice(0,400),reason:cleanText(item.reason).slice(0,300)
  })).filter(item=>item.query);
  if(!allowed.length)return send(res,200,{results:[],sources_checked:[]});

  const requestedTonnes=extractRequestedTonnes(`${goal} ${allowed.map(item=>item.query).join(" ")}`);
  const tasks=allowed.flatMap(item=>sourceGroupsFor({source:item.source,goal,query:item.query,domain}).map(group=>({item,group})));
  logAnalytics("atlas_external_search_started",{
    source_count:allowed.length,source_groups:[...new Set(tasks.map(task=>task.group.id))].join(","),
    requested_tonnes:requestedTonnes,language
  });

  const instructions=searchInstructions(language);
  try{
    const attempts=await Promise.allSettled(tasks.map(async({item,group})=>{
      const input=`User goal: ${goal}\nTask: ${item.query}\nWhy this step matters: ${item.reason||"complete the next action"}\nUser location context: ${locationText||"not provided"}\nSource group: ${group.label}.\nFind current concrete results for this task. Keep the requested quantity and location in the search. Cite every result.`;
      const attempt=await executeWebSearch({
        apiKey,model,instructions,input,searchContextSize:group.domains.length?"high":"medium",
        allowedDomains:group.domains,maxOutputTokens:2600
      });
      if(!attempt.response.ok){
        const error=new Error(attempt.data?.error?.message||"OpenAI web search failed");
        error.status=attempt.response.status;
        throw error;
      }
      return {group,data:attempt.data,results:extractVerifiedResults(attempt.data,group,{locationText})};
    }));

    const completed=attempts.filter(attempt=>attempt.status==="fulfilled").map(attempt=>attempt.value);
    let results=deduplicate(completed.flatMap(attempt=>attempt.results));
    const failed=attempts.filter(attempt=>attempt.status==="rejected");

    const marketplaceTask=allowed.some(item=>item.source==="marketplace");
    if(!results.length&&!marketplaceTask){
      const queryPlan=allowed.map(item=>`[${item.source}] ${item.query}`).join("\n");
      const fallback=await executeWebSearch({
        apiKey,model,instructions,searchContextSize:"high",maxOutputTokens:3400,
        input:`Filtered source searches returned no cited URLs. Search the wider public web for current concrete offers.\nGoal: ${goal}\nLocation: ${locationText||"not provided"}\nQueries:\n${queryPlan}\nCite every result and do not answer from memory.`
      });
      if(fallback.response.ok){
        const group={id:"open-web",label:"відкритий інтернет",domains:[]};
        results=extractVerifiedResults(fallback.data,group,{locationText});
        completed.push({group,data:fallback.data,results});
      }else if(!completed.length){
        return send(res,502,{error:"external-search-failed",status:fallback.response.status,details:fallback.data?.error?.message||failed[0]?.reason?.message||"OpenAI web search failed"});
      }
    }

    if(marketplaceTask){
      results=results.filter(isActionableCommerceResult);
      const marketplaceQuery=allowed.find(item=>item.source==="marketplace")?.query||allowed[0]?.query||goal;
      const shortcuts=buildMarketplaceShortcuts({goal,query:marketplaceQuery,locationText,language});
      const representedHosts=new Set(results.map(result=>hostname(result.url)).filter(Boolean));
      const missingSourceShortcuts=shortcuts.filter(shortcut=>shortcut.result_kind==="maps_search"||!representedHosts.has(hostname(shortcut.url)));
      results=deduplicate([...results,...missingSourceShortcuts]);
    }
    results=rankMarketplaceResults(results,{requestedTonnes,limit:12});
    const sourcesChecked=[...new Set(tasks.flatMap(task=>task.group.domains).concat(results.map(result=>hostname(result.url))).filter(Boolean))];
    logAnalytics("atlas_external_search_completed",{
      result_count:results.length,source_groups:completed.map(item=>item.group.id).join(","),
      failed_groups:failed.length,requested_tonnes:requestedTonnes,duration_ms:Date.now()-startedAt
    });
    return send(res,200,{
      results,sources_checked:sourcesChecked,requested_quantity_tonnes:requestedTonnes,
      search_status:results.length?"completed":"no-results",attempts:attempts.length+(results.length?0:1)
    });
  }catch(error){
    logAnalyticsError("atlas_external_search_failed",error,{duration_ms:Date.now()-startedAt});
    return send(res,500,{error:"external-search-failed",details:error?.message||"Unknown error"});
  }
}
