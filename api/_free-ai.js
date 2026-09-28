const PRIMARY_MODEL="gemini-3.5-flash-lite";
const FALLBACK_MODELS=["gemini-3.1-flash-lite","gemini-3.8-flash"];
const GEMINI_MODELS=[PRIMARY_MODEL,...FALLBACK_MODELS];

function apiKey(){
  // Dedicated key only: Atlas must not silently reuse another Google key.
  return String(process.env.GEMINI_FREE_TIER_API_KEY||"").trim();
}

function extractGeminiText(data){
  for(const candidate of data?.candidates||[]){
    const text=(candidate?.content?.parts||[]).map(part=>typeof part?.text==="string"?part.text:"").join("").trim();
    if(text)return text;
  }
  return "";
}

export async function getFreeAiStatus(){
  return {
    provider:"google-gemini-free-tier",
    configured:Boolean(apiKey()),
    zero_cost_only:true,
    paid_fallback:false,
    model:PRIMARY_MODEL,
    fallback_models:FALLBACK_MODELS,
    required_key:"GEMINI_FREE_TIER_API_KEY",
    billing_requirement:"billing-disabled-project"
  };
}

async function callGemini(model,{key,instructions,input,maxOutputTokens,json,timeoutMs}){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const generationConfig={temperature:0,maxOutputTokens};
    if(json)generationConfig.responseMimeType="application/json";
    const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
      method:"POST",
      headers:{"Content-Type":"application/json","x-goog-api-key":key},
      body:JSON.stringify({
        systemInstruction:{parts:[{text:String(instructions||"")}]},
        contents:[{role:"user",parts:[{text:String(input||"")}]}],
        generationConfig
      }),
      signal:controller.signal
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      const error=new Error(data?.error?.message||`free-ai-${response.status}`);
      error.code=data?.error?.status||`free-ai-${response.status}`;
      error.status=response.status;
      throw error;
    }
    const outputText=extractGeminiText(data);
    if(!outputText)throw Object.assign(new Error("free-ai-empty-response"),{code:"free-ai-empty-response"});
    return {data:{...data,status:"completed",output_text:outputText},model};
  }finally{
    clearTimeout(timeout);
  }
}

export async function runFreeAiResponse({instructions,input,maxOutputTokens=2600,timeoutMs=15000,json=true}={}){
  const key=apiKey();
  if(!key){
    if(json){
      return {
        data:{status:"incomplete",incomplete_details:{reason:"free-ai-key-unavailable"},output_text:""},
        model:PRIMARY_MODEL,
        status:await getFreeAiStatus()
      };
    }
    throw Object.assign(new Error("free-ai-key-unavailable"),{code:"free-ai-key-unavailable"});
  }

  let lastError=null;
  const started=Date.now();
  for(let index=0;index<GEMINI_MODELS.length;index+=1){
    const model=GEMINI_MODELS[index];
    const remaining=Math.max(1200,timeoutMs-(Date.now()-started));
    if(remaining<=1200&&index>0)break;
    try{
      const perModel=Math.min(index===0?3500:2200,remaining);
      const result=await callGemini(model,{key,instructions,input,maxOutputTokens,json,timeoutMs:perModel});
      return {...result,status:await getFreeAiStatus()};
    }catch(error){
      lastError=error;
      const retryable=["UNAVAILABLE","RESOURCE_EXHAUSTED","INTERNAL"].includes(String(error?.code||"").toUpperCase())||
        [20,429,500,502,503,504].includes(Number(error?.status||error?.code));
      if(!retryable)break;
    }
  }
  throw lastError||Object.assign(new Error("free-ai-unavailable"),{code:"free-ai-unavailable"});
}

export const FREE_AI_MODEL=PRIMARY_MODEL;
