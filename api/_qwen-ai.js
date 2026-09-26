const DEFAULT_MODEL="qwen-turbo";
const DEFAULT_BASE_URL="https://dashscope-intl.aliyuncs.com/compatible-mode/v1";

function apiKey(){
  return String(process.env.DASHSCOPE_API_KEY||"").trim();
}

function baseUrl(){
  return String(process.env.DASHSCOPE_BASE_URL||DEFAULT_BASE_URL).trim().replace(/\/$/,"");
}

function modelName(){
  return String(process.env.QWEN_MODEL||DEFAULT_MODEL).trim()||DEFAULT_MODEL;
}

function extractText(data){
  return String(data?.choices?.[0]?.message?.content||"").trim();
}

export async function getQwenStatus(){
  return {
    provider:"alibaba-qwen",
    configured:Boolean(apiKey()),
    model:modelName(),
    region:"singapore",
    base_url_configured:Boolean(String(process.env.DASHSCOPE_BASE_URL||"").trim()),
    required_key:"DASHSCOPE_API_KEY"
  };
}

export async function runQwenResponse({
  instructions="",
  input="",
  maxOutputTokens=600,
  timeoutMs=10000,
  json=true
}={}){
  const key=apiKey();
  if(!key)throw Object.assign(new Error("qwen-key-unavailable"),{code:"qwen-key-unavailable"});

  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const body={
      model:modelName(),
      messages:[
        {role:"system",content:String(instructions||"")},
        {role:"user",content:String(input||"")}
      ],
      temperature:0,
      max_tokens:maxOutputTokens,
      enable_thinking:false
    };
    if(json)body.response_format={type:"json_object"};

    const response=await fetch(`${baseUrl()}/chat/completions`,{
      method:"POST",
      headers:{
        "Authorization":`Bearer ${key}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify(body),
      signal:controller.signal
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      const message=data?.error?.message||data?.message||`qwen-${response.status}`;
      const error=new Error(message);
      error.code=data?.error?.code||data?.code||`qwen-${response.status}`;
      error.status=response.status;
      throw error;
    }
    const outputText=extractText(data);
    if(!outputText)throw Object.assign(new Error("qwen-empty-response"),{code:"qwen-empty-response"});
    return {
      data:{...data,status:"completed",output_text:outputText},
      model:modelName(),
      status:await getQwenStatus()
    };
  }finally{
    clearTimeout(timeout);
  }
}
