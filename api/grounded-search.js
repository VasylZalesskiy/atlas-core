const MODEL="gemini-2.5-flash";

function send(res,status,body){
  res.status(status).setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.end(JSON.stringify(body));
}

function clean(value,limit=4000){return String(value||"").replace(/\s+/g," ").trim().slice(0,limit)}
function safeUrl(value){try{const url=new URL(String(value||""));return /^https?:$/.test(url.protocol)?url.toString():""}catch{return ""}}
function host(url){try{return new URL(url).hostname.replace(/^www\./,"")}catch{return ""}}
function geminiKey(){return String(process.env.GEMINI_FREE_TIER_API_KEY||process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY||"").trim()}

function collectGrounding(data){
  const candidate=data?.candidates?.[0];
  const answer=clean((candidate?.content?.parts||[]).map(part=>part?.text||"").join("\n"),7000);
  const chunks=Array.isArray(candidate?.groundingMetadata?.groundingChunks)?candidate.groundingMetadata.groundingChunks:[];
  const seen=new Set();
  const sources=[];
  for(const chunk of chunks){
    const url=safeUrl(chunk?.web?.uri);
    if(!url||seen.has(url))continue;
    seen.add(url);
    sources.push({url,title:clean(chunk?.web?.title||host(url),240)});
  }
  return {answer,sources:sources.slice(0,8)};
}

function promptFor({goal,query,language,domain,locationText}){
  const uk=language!=="en";
  const location=locationText?`\nLocation/context: ${locationText}`:"";
  const safety=domain==="health"
    ?(uk?"Для медичної теми не став діагноз і не замінюй лікаря; дай лише перевірену практичну інформацію та безпечний наступний крок.":"For health topics, do not diagnose or replace a clinician; provide only verified practical information and a safe next step.")
    :"";
  return uk
    ?`Ти — пошуковий модуль Atlas. Знайди в актуальному інтернеті конкретну відповідь на задачу людини.\nЗадача: ${goal}\nПошуковий фокус: ${query}${location}\n${safety}\nПравила: відповідай українською; 2–5 коротких речень; спочатку дай практичну відповідь, а не опис процесу пошуку; якщо йдеться про товар/послугу — називай лише конкретні знайдені варіанти, постачальників, ціни, кількість або умови, якщо вони реально є у джерелах; не вигадуй наявність, ціну, адресу чи контакт; якщо точного рішення немає — прямо скажи, чого саме не підтверджено. Не пиши список URL у тексті — джерела Atlas покаже окремо.`
    :`You are Atlas's web-search module. Find a concrete current web answer to the person's task.\nTask: ${goal}\nSearch focus: ${query}${location}\n${safety}\nRules: answer in English; use 2–5 short sentences; give the practical answer first, not a description of the search process; for products/services name only concrete options, suppliers, prices, quantities or conditions actually supported by sources; never invent availability, price, address or contact; if no exact solution is confirmed, say what remains unconfirmed. Do not list URLs in the prose; Atlas shows sources separately.`;
}

async function groundedSearch({goal,query,language="uk",domain="",locationText=""}){
  const key=geminiKey();
  if(!key)return {configured:false,answer:"",sources:[],reason:"key-unavailable"};
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,{
      method:"POST",
      headers:{"Content-Type":"application/json","x-goog-api-key":key},
      body:JSON.stringify({
        contents:[{role:"user",parts:[{text:promptFor({goal,query,language,domain,locationText})}]}],
        tools:[{google_search:{}}],
        generationConfig:{temperature:0.15,maxOutputTokens:700}
      }),
      signal:controller.signal
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      console.warn(JSON.stringify({level:"warning",message:"atlas_grounded_search_failed",status:response.status,error:data?.error?.message||"gemini-error"}));
      return {configured:true,answer:"",sources:[],reason:`gemini-${response.status}`};
    }
    const grounded=collectGrounding(data);
    return {configured:true,...grounded,reason:grounded.answer?"ok":"empty-answer"};
  }catch(error){
    console.warn(JSON.stringify({level:"warning",message:"atlas_grounded_search_unavailable",error:error?.name||error?.message||"unknown"}));
    return {configured:true,answer:"",sources:[],reason:error?.name==="AbortError"?"timeout":"network-error"};
  }finally{clearTimeout(timer)}
}

function toResults({answer,sources,language,domain}){
  if(!answer)return [];
  const uk=language!=="en";
  const health=domain==="health";
  const answerResult={
    title:uk?"Відповідь Atlas з інтернету":"Atlas web answer",
    snippet:answer,
    url:"",
    source_type:"grounded_web",
    source_name:uk?"Atlas · Інтернет":"Atlas · Web",
    source_group:"grounded-web",
    result_kind:health?"web_answer":"listing",
    price_text:"",
    location_text:"",
    quantity_tonnes:null,
    quantity_text:"",
    verification_text:uk?"Відповідь сформована на основі актуального веб-пошуку; джерела наведені нижче.":"The answer is grounded in a current web search; sources are shown below."
  };
  const sourceResults=sources.map((source,index)=>({
    title:source.title||host(source.url)||`${uk?"Джерело":"Source"} ${index+1}`,
    snippet:"",
    url:source.url,
    source_type:"web",
    source_name:host(source.url)||"Інтернет",
    source_group:"grounded-web-source",
    result_kind:"web_result",
    price_text:"",
    location_text:"",
    quantity_tonnes:null,
    quantity_text:"",
    verification_text:uk?"Джерело, використане для відповіді Atlas.":"A source used for the Atlas answer."
  }));
  return [answerResult,...sourceResults];
}

export default async function handler(req,res){
  if(req.method==="GET")return send(res,200,{
    status:"atlas-grounded-search-endpoint-online",
    configured:Boolean(geminiKey()),
    model:MODEL,
    provider:"gemini-google-search-grounding"
  });
  if(req.method!=="POST")return send(res,405,{error:"method-not-allowed"});

  let body={};
  try{body=typeof req.body==="string"?JSON.parse(req.body||"{}"):req.body||{}}
  catch{return send(res,400,{error:"invalid-json"})}

  const goal=clean(body.goal,700);
  const query=clean(body.query||body.goal,500);
  const language=body.language==="en"?"en":"uk";
  const domain=clean(body.domain,120);
  const locationText=clean(body.location_text,180);
  if(!goal||!query)return send(res,200,{results:[],configured:Boolean(geminiKey()),search_status:"no-query"});

  const grounded=await groundedSearch({goal,query,language,domain,locationText});
  return send(res,200,{
    results:toResults({...grounded,language,domain}),
    configured:grounded.configured,
    search_status:grounded.answer?"grounded-answer":grounded.reason,
    source_count:grounded.sources.length,
    model:MODEL
  });
}
