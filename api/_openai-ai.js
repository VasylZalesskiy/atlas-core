const OPENAI_URL="https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_MODEL="gpt-6-sol";

function apiKey(){
  return String(process.env.OPENAI_API_KEY||"").trim();
}

function configuredModel(){
  return String(process.env.OPENAI_MODEL||DEFAULT_OPENAI_MODEL).trim()||DEFAULT_OPENAI_MODEL;
}

export async function getOpenAIStatus(){
  return {
    provider:"openai",
    configured:Boolean(apiKey()),
    model:configuredModel(),
    required_key:"OPENAI_API_KEY"
  };
}

export async function runOpenAIResponse({
  instructions,input,maxOutputTokens=2600,timeoutMs=15000,
  schema=null,schemaName="atlas_response",model="",tools=[],toolChoice="",include=[]
}={}){
  const key=apiKey();
  const selectedModel=String(model||configuredModel()).trim()||DEFAULT_OPENAI_MODEL;
  if(!key){
    return {
      data:{status:"incomplete",incomplete_details:{reason:"openai-key-unavailable"},output_text:""},
      model:selectedModel,
      status:await getOpenAIStatus()
    };
  }

  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const body={
      model:selectedModel,
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

    const response=await fetch(OPENAI_URL,{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${key}`},
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
    return {data,model:data?.model||selectedModel,status:await getOpenAIStatus()};
  }finally{
    clearTimeout(timeout);
  }
}

export const OPENAI_AI_MODEL=DEFAULT_OPENAI_MODEL;
