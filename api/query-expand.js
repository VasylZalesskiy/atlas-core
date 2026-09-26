import {getQwenStatus,runQwenResponse} from "./_qwen-ai.js";

function send(res,status,body){
  res.status(status).setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.end(JSON.stringify(body));
}

function clean(value){
  return String(value||"").replace(/\s+/g," ").trim();
}

function parseTerms(text){
  const raw=String(text||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"");
  const start=raw.indexOf("{");
  const end=raw.lastIndexOf("}");
  if(start<0||end<=start)return [];
  try{
    const data=JSON.parse(raw.slice(start,end+1));
    return [...new Set((Array.isArray(data?.terms)?data.terms:[])
      .map(clean)
      .filter(term=>term.length>=2&&term.length<=100))].slice(0,14);
  }catch{
    return [];
  }
}

async function expandQuery(query){
  const instructions=[
    "You normalize a user's search request for Atlas Opportunity Passports.",
    "Return JSON only: {\"terms\":[...]}.",
    "Generate up to 14 short search terms or phrases that express the SAME intent.",
    "Prefer Ukrainian. Include useful grammatical forms, noun/verb variants, common synonyms and common spelling variants.",
    "English or Russian variants are allowed only when they are common and directly useful.",
    "Do not broaden to unrelated services or products. Do not add locations, prices, brands, personal data or explanations.",
    "The terms are used only to match existing Atlas opportunity descriptions."
  ].join("\n");
  const {data,model}=await runQwenResponse({
    instructions,
    input:query,
    maxOutputTokens:320,
    timeoutMs:9000,
    json:true
  });
  return {terms:parseTerms(data?.output_text),model};
}

export default async function handler(req,res){
  if(req.method==="GET"){
    const status=await getQwenStatus();
    if(String(req.query?.test||"")!=="1")return send(res,200,{status:"qwen-query-expander-online",qwen:status});
    if(!status.configured)return send(res,200,{status:"qwen-query-expander-online",qwen:status,api_call_ok:false,error_code:"qwen-key-unavailable"});
    try{
      const result=await expandQuery("потрібно зремонтувати компютер");
      return send(res,200,{status:"qwen-query-expander-online",qwen:status,api_call_ok:true,...result});
    }catch(error){
      return send(res,200,{
        status:"qwen-query-expander-online",
        qwen:status,
        api_call_ok:false,
        error_code:error?.code||"qwen-unavailable",
        message:String(error?.message||"Request failed").slice(0,300)
      });
    }
  }

  if(req.method!=="POST")return send(res,405,{error:"method-not-allowed"});
  const query=clean(typeof req.body==="string"?JSON.parse(req.body||"{}")?.query:req.body?.query);
  if(!query)return send(res,400,{error:"query-required"});
  if(query.length>600)return send(res,400,{error:"query-too-long"});

  const status=await getQwenStatus();
  if(!status.configured)return send(res,200,{terms:[],provider:"qwen",configured:false});

  try{
    const result=await expandQuery(query);
    return send(res,200,{...result,provider:"qwen",configured:true});
  }catch(error){
    return send(res,200,{
      terms:[],
      provider:"qwen",
      configured:true,
      error_code:error?.code||"qwen-unavailable"
    });
  }
}
