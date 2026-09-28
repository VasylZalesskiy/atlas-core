import {getFreeAiStatus,runFreeAiResponse} from "./_free-ai.js";
import {getOpenAIStatus,runOpenAIResponse} from "./_openai-ai.js";

function send(res,status,body){
  res.status(status).setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.end(JSON.stringify(body));
}

function clean(value){
  return String(value||"").replace(/\s+/g," ").trim();
}

function extractResponseText(data){
  if(typeof data?.output_text==="string"&&data.output_text.trim())return data.output_text;
  for(const item of data?.output||[]){
    if(item?.type!=="message")continue;
    for(const content of item?.content||[]){
      if(content?.type==="output_text"&&typeof content.text==="string")return content.text;
    }
  }
  return "";
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
  try{
    const {data,model}=await runFreeAiResponse({
      instructions,
      input:query,
      maxOutputTokens:320,
      timeoutMs:5500,
      json:true
    });
    const terms=parseTerms(extractResponseText(data));
    if(terms.length)return {terms,model,provider:"google-gemini-free-tier",paid_fallback_used:false};
  }catch{}

  const openai=await getOpenAIStatus();
  if(openai.configured){
    const {data,model}=await runOpenAIResponse({
      instructions,
      input:query,
      maxOutputTokens:320,
      timeoutMs:8000,
      model:"gpt-6-luna",
      schema:{
        type:"object",
        additionalProperties:false,
        required:["terms"],
        properties:{
          terms:{type:"array",items:{type:"string"},maxItems:14}
        }
      },
      schemaName:"atlas_query_terms"
    });
    const terms=parseTerms(extractResponseText(data));
    if(terms.length)return {terms,model,provider:"openai",paid_fallback_used:true};
  }

  return {terms:[],model:"deterministic",provider:"fallback",paid_fallback_used:false};
}

export default async function handler(req,res){
  if(req.method==="GET"){
    const status=await getFreeAiStatus();
    const openai=await getOpenAIStatus();
    if(String(req.query?.test||"")!=="1")return send(res,200,{status:"atlas-query-expander-online",free_ai:status,paid_fallback:{configured:openai.configured,model:"gpt-6-luna"}});
    if(!status.configured&&!openai.configured)return send(res,200,{status:"atlas-query-expander-online",free_ai:status,paid_fallback:{configured:false,model:"gpt-6-luna"},api_call_ok:false,error_code:"ai-key-unavailable"});
    try{
      const result=await expandQuery("потрібно зремонтувати компютер");
      return send(res,200,{status:"atlas-query-expander-online",free_ai:status,paid_fallback:{configured:openai.configured,model:"gpt-6-luna"},api_call_ok:true,...result});
    }catch(error){
      return send(res,200,{
        status:"atlas-query-expander-online",
        free_ai:status,
        api_call_ok:false,
        error_code:error?.code||"free-ai-unavailable",
        message:String(error?.message||"Request failed").slice(0,300)
      });
    }
  }

  if(req.method!=="POST")return send(res,405,{error:"method-not-allowed"});
  const query=clean(typeof req.body==="string"?JSON.parse(req.body||"{}")?.query:req.body?.query);
  if(!query)return send(res,400,{error:"query-required"});
  if(query.length>600)return send(res,400,{error:"query-too-long"});

  const status=await getFreeAiStatus();
  const openai=await getOpenAIStatus();
  if(!status.configured&&!openai.configured)return send(res,200,{terms:[],provider:"fallback",configured:false});

  try{
    const result=await expandQuery(query);
    return send(res,200,{...result,configured:true});
  }catch(error){
    return send(res,200,{
      terms:[],
      provider:"google-gemini-free-tier",
      configured:true,
      error_code:error?.code||"free-ai-unavailable"
    });
  }
}
