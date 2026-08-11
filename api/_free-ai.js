const GATEWAY_RESPONSES_URL="https://ai-gateway.vercel.sh/v1/responses";
const GATEWAY_MODELS_URL="https://ai-gateway.vercel.sh/v1/models";

const APPROVED_MODELS=[
  "inclusionai/ling-3.0-tiny-free",
  "poolside/laguna-s-2.1-free"
];

let catalogCache=null;

function authToken(){
  return process.env.VERCEL_OIDC_TOKEN||process.env.AI_GATEWAY_API_KEY||"";
}

function numericPrices(value,prices=[]){
  if(value&&typeof value==="object"){
    for(const entry of Object.values(value))numericPrices(entry,prices);
    return prices;
  }
  if(typeof value==="number"&&Number.isFinite(value))prices.push(value);
  if(typeof value==="string"&&value.trim()!==""&&Number.isFinite(Number(value)))prices.push(Number(value));
  return prices;
}

export function isExplicitlyFreeModel(model){
  if(!model||!APPROVED_MODELS.includes(model.id))return false;
  const markedFree=Array.isArray(model.tags)&&model.tags.includes("free")||model.id.endsWith("-free");
  if(!markedFree)return false;
  return numericPrices(model.pricing||{}).every(price=>price===0);
}

function preferredModels(){
  const requested=String(process.env.ATLAS_FREE_AI_MODEL||"").trim();
  return requested&&APPROVED_MODELS.includes(requested)
    ?[requested,...APPROVED_MODELS.filter(id=>id!==requested)]
    :APPROVED_MODELS;
}

async function loadCatalog({force=false}={}){
  if(!force&&catalogCache&&Date.now()-catalogCache.loadedAt<10*60*1000)return catalogCache.models;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),5000);
  try{
    const response=await fetch(GATEWAY_MODELS_URL,{headers:{Accept:"application/json"},signal:controller.signal});
    if(!response.ok)throw new Error(`free-ai-catalog-${response.status}`);
    const data=await response.json();
    const models=Array.isArray(data?.data)?data.data:[];
    catalogCache={loadedAt:Date.now(),models};
    return models;
  }finally{
    clearTimeout(timeout);
  }
}

export async function getFreeAiStatus({force=false}={}){
  const configured=Boolean(authToken());
  try{
    const models=await loadCatalog({force});
    const byId=new Map(models.map(model=>[model.id,model]));
    const model=preferredModels().map(id=>byId.get(id)).find(isExplicitlyFreeModel)||null;
    return {
      provider:"vercel-ai-gateway",
      configured,
      catalog_verified:Boolean(model),
      zero_cost_only:true,
      model:model?.id||null,
      pricing:model?.pricing||null
    };
  }catch(error){
    return {
      provider:"vercel-ai-gateway",
      configured,
      catalog_verified:false,
      zero_cost_only:true,
      model:null,
      pricing:null,
      error:String(error?.message||"free-ai-catalog-unavailable").slice(0,160)
    };
  }
}

export async function runFreeAiResponse({instructions,input,maxOutputTokens=2600,timeoutMs=15000}={}){
  const token=authToken();
  if(!token)throw Object.assign(new Error("free-ai-auth-unavailable"),{code:"free-ai-auth-unavailable"});

  const status=await getFreeAiStatus();
  if(!status.catalog_verified||!status.model){
    throw Object.assign(new Error("free-ai-price-not-verified"),{code:"free-ai-price-not-verified"});
  }

  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(GATEWAY_RESPONSES_URL,{
      method:"POST",
      headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:status.model,
        store:false,
        instructions,
        input,
        temperature:0,
        max_output_tokens:maxOutputTokens
      }),
      signal:controller.signal
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      const error=new Error(data?.error?.message||`free-ai-${response.status}`);
      error.code=data?.error?.code||`free-ai-${response.status}`;
      error.status=response.status;
      throw error;
    }
    return {data,model:data?.model||status.model,status};
  }finally{
    clearTimeout(timeout);
  }
}

export const FREE_AI_MODELS=Object.freeze([...APPROVED_MODELS]);
