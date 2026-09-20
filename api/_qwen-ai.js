const QWEN_MODEL="qwen3.8-flash";
const QWEN_URL="https://ws-y0i5f576v5kqdzim.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions";

function apiKey(){
  return String(process.env.DASHSCOPE_API_KEY||"").trim();
}

function extractQwenText(data){
  return String(data?.choices?.[0]?.message?.content||"").trim();
}

export async function getQwenStatus(){
  return {
    provider:"alibaba-qwen",
    configured:Boolean(apiKey()),
    region:"singapore",
    model:QWEN_MODEL,
    required_key:"DASHSCOPE_API_KEY"
  };
}

export async function runQwenResponse({instructions,input,maxOutputTokens=2600,timeoutMs=15000,json=true}={}){
  const key=apiKey();
  if(!key){
    if(json){
      return {
        data:{status:"incomplete",incomplete_details:{reason:"qwen-key-unavailable"},output_text:""},
        model:QWEN_MODEL,
        status:await getQwenStatus()
      };
    }
    throw Object.assign(new Error("qwen-key-unavailable"),{code:"qwen-key-unavailable"});
  }

  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(QWEN_URL,{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Authorization":`Bearer ${key}`
      },
      body:JSON.stringify({
        model:QWEN_MODEL,
        messages:[
          {role:"system",content:String(instructions||"")},
          {role:"user",content:String(input||"")}
        ],
        temperature:0,
        max_tokens:maxOutputTokens,
        ...(json?{response_format:{type:"json_object"}}:{})
      }),
      signal:controller.signal
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      const error=new Error(data?.error?.message||data?.message||`qwen-${response.status}`);
      error.code=data?.error?.code||data?.code||`qwen-${response.status}`;
      error.status=response.status;
      throw error;
    }
    const outputText=extractQwenText(data);
    if(!outputText)throw Object.assign(new Error("qwen-empty-response"),{code:"qwen-empty-response"});
    return {
      data:{...data,status:"completed",output_text:outputText},
      model:QWEN_MODEL,
      status:await getQwenStatus()
    };
  }finally{
    clearTimeout(timeout);
  }
}

export const QWEN_AI_MODEL=QWEN_MODEL;
