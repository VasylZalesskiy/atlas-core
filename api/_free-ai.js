const GEMINI_MODEL="gemini-3.5-flash-lite";
const GEMINI_URL=`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function apiKey(){
  // The dedicated variable is intentional: Atlas will not silently reuse a
  // key from a project that may have billing enabled.
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
    model:GEMINI_MODEL,
    required_key:"GEMINI_FREE_TIER_API_KEY",
    billing_requirement:"billing-disabled-project"
  };
}

export async function runFreeAiResponse({instructions,input,maxOutputTokens=2600,timeoutMs=15000,json=true}={}){
  const key=apiKey();
  if(!key){
    // For normal Atlas Brain JSON planning, a missing free-tier key is an
    // expected operating mode, not a runtime failure. Let brain.js select the
    // deterministic fallback without emitting an error-level log. Diagnostics
    // still throw so /api/brain?test=1 reports the missing key truthfully.
    if(json){
      return {
        data:{status:"incomplete",incomplete_details:{reason:"free-ai-key-unavailable"},output_text:""},
        model:GEMINI_MODEL,
        status:await getFreeAiStatus()
      };
    }
    throw Object.assign(new Error("free-ai-key-unavailable"),{code:"free-ai-key-unavailable"});
  }

  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const generationConfig={temperature:0,maxOutputTokens};
    if(json)generationConfig.responseMimeType="application/json";
    const response=await fetch(GEMINI_URL,{
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
    return {
      data:{...data,status:"completed",output_text:outputText},
      model:GEMINI_MODEL,
      status:await getFreeAiStatus()
    };
  }finally{
    clearTimeout(timeout);
  }
}

export const FREE_AI_MODEL=GEMINI_MODEL;
