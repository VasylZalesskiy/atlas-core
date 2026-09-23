const OPENAI_URL="https://api.openai.com/v1/responses";
const AI_GATEWAY_URL="https://ai-gateway.vercel.sh/v1/responses";
const DEFAULT_OPENAI_MODEL="gpt-6-sol";

function apiKey(){
  return String(process.env.OPENAI_API_KEY||"").trim();
}

function gatewayKey(){
  return String(process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN||"").trim();
}

function configuredModel(){
  return String(process.env.OPENAI_MODEL||DEFAULT_OPENAI_MODEL).trim()||DEFAULT_OPENAI_MODEL;
}

export async function getOpenAIStatus(){
  const gatewayConfigured=Boolean(gatewayKey());
  const directConfigured=Boolean(apiKey());
  return {
    provider:"openai",
    configured:gatewayConfigured||directConfigured,
    model:configuredModel(),
    route:gatewayConfigured?"vercel-ai-gateway":"direct-openai",
    gateway_configured:gatewayConfigured,
    direct_configured:directConfigured,
    required_key:"VERCEL_OIDC_TOKEN, AI_GATEWAY_API_KEY or OPENAI_API_KEY"
  };
}

function gatewayModel(model){
  const value=String(model||DEFAULT_OPENAI_MODEL).trim()||DEFAULT_OPENAI_MODEL;
  return value.includes("/")?value:`openai/${value}`;
}

function requestTargets(){
  const targets=[];
  const gateway=gatewayKey();
  const direct=apiKey();
  if(gateway)targets.push({url:AI_GATEWAY_URL,key:gateway,route:"vercel-ai-gateway",gateway:true});
  if(direct)targets.push({url:OPENAI_URL,key:direct,route:"direct-openai",gateway:false});
  return targets;
}

export async function runOpenAIResponse({
  instructions,input,maxOutputTokens=2600,timeoutMs=15000,
  schema=null,schemaName="atlas_response",model="",tools=[],toolChoice="",include=[]
}={}){
  const selectedModel=String(model||configuredModel()).trim()||DEFAULT_OPENAI_MODEL;
  const targets=requestTargets();
  if(!targets.length){
    return {
      data:{status:"incomplete",incomplete_details:{reason:"openai-key-unavailable"},output_text:""},
      model:selectedModel,
      status:await getOpenAIStatus()
    };
  }

  let lastError=null;
  for(const target of targets){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),timeoutMs);
    const body={
      model:target.gateway?gatewayModel(selectedModel):selectedModel,
      store:false,
      instructions:String(instructions||""),
      input:String(input||""),
      max_output_tokens:maxOutputTokens
    };
    if(schema){
      body.text={format:{type:"json_schema",name:schemaName,strict:true,schema}};
    }
    if(Array.isArray(tools)&&tools.length)body.tools=tools;
    if(toolChoice)body.tool_choice=toolChoice;
    if(Array.isArray(include)&&include.length)body.include=include;

    try{
      const response=await fetch(target.url,{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${target.key}`},
        body:JSON.stringify(body),
        signal:controller.signal
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok){
        const error=new Error(data?.error?.message||`openai-${response.status}`);
        error.code=data?.error?.code||`openai-${response.status}`;
        error.status=response.status;
        throw error;
      }
      return {data,model:data?.model||body.model,route:target.route,status:await getOpenAIStatus()};
    }catch(error){
      lastError=error;
    }finally{
      clearTimeout(timeout);
    }
  }
  throw lastError||new Error("openai-unavailable");
}

export const OPENAI_AI_MODEL=DEFAULT_OPENAI_MODEL;
