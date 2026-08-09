const OPENAI_URL="https://api.openai.com/v1/responses";

function send(res,status,body){
  res.status(status).setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.end(JSON.stringify(body));
}

const schema={
  type:"object",
  additionalProperties:false,
  required:["understood","goal","intent","domain","urgency","needs_location","clarification","passport_search","external_searches","safety","result_strategy"],
  properties:{
    understood:{type:"boolean"},
    goal:{type:"string"},
    intent:{type:"string"},
    domain:{type:"string"},
    urgency:{type:"string",enum:["immediate","soon","planned"]},
    needs_location:{type:"boolean"},
    clarification:{
      type:"object",
      additionalProperties:false,
      required:["required","question","options"],
      properties:{
        required:{type:"boolean"},
        question:{type:"string"},
        options:{type:"array",items:{type:"string"},maxItems:5}
      }
    },
    passport_search:{
      type:"object",
      additionalProperties:false,
      required:["terms","capability_description"],
      properties:{
        terms:{type:"array",items:{type:"string"},maxItems:12},
        capability_description:{type:"string"}
      }
    },
    external_searches:{
      type:"array",
      maxItems:5,
      items:{
        type:"object",
        additionalProperties:false,
        required:["source","query","reason"],
        properties:{
          source:{type:"string",enum:["maps","web","marketplace","official","none"]},
          query:{type:"string"},
          reason:{type:"string"}
        }
      }
    },
    safety:{
      type:"object",
      additionalProperties:false,
      required:["level","message"],
      properties:{
        level:{type:"string",enum:["none","caution","urgent"]},
        message:{type:"string"}
      }
    },
    result_strategy:{type:"string"}
  }
};

function extractText(data){
  if(typeof data?.output_text==="string"&&data.output_text.trim())return data.output_text;
  for(const item of data?.output||[]){
    if(item?.type!=="message")continue;
    for(const content of item?.content||[]){
      if(content?.type==="output_text"&&typeof content.text==="string")return content.text;
    }
  }
  return "";
}

export default async function handler(req,res){
  if(req.method==="GET"){
    return send(res,200,{
      status:"atlas-brain-endpoint-online",
      openai_key_configured:Boolean(process.env.OPENAI_API_KEY),
      model:process.env.OPENAI_MODEL||"gpt-5-mini"
    });
  }

  if(req.method!=="POST")return send(res,405,{error:"method-not-allowed"});

  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey)return send(res,503,{error:"openai-key-missing"});

  const body=typeof req.body==="string"?JSON.parse(req.body||"{}"):req.body||{};
  const query=String(body.query||"").trim();
  const language=body.language==="en"?"en":"uk";
  const location=body.location&&Number.isFinite(Number(body.location.latitude))&&Number.isFinite(Number(body.location.longitude))
    ?{latitude:Number(body.location.latitude),longitude:Number(body.location.longitude)}
    :null;

  if(!query)return send(res,400,{error:"query-required"});
  if(query.length>1200)return send(res,400,{error:"query-too-long"});

  const instructions=`You are Atlas Brain, a universal intent and solution planner.\n\nCritical rule: never rely on a registry of predefined scenarios. Treat every user request semantically, including requests you have never seen before. Examples are tests, not categories.\n\nYour job is to convert the user's natural-language request into a compact search plan for Atlas. Atlas first searches Opportunity Passports (people, skills, things, help, items to lend/sell/give away), then uses external sources only when needed.\n\nDo not invent businesses, people, products, distances, availability, prices, diagnoses, or contacts. Do not claim a result exists; only define what should be searched. Ask at most ONE clarification question, and only if one missing detail materially blocks a useful search. If useful searching can start without clarification, set clarification.required=false.\n\nFor health/safety situations, do not diagnose. Mark safety caution/urgent only when appropriate and keep the message concise.\n\nUse the user's language (${language}). Keep search terms short and practical. result_strategy should say what Atlas should prioritize when ranking final results (for example proximity, availability, price, trust, or urgency).`;

  const context={query,language,location_available:Boolean(location)};

  try{
    const response=await fetch(OPENAI_URL,{
      method:"POST",
      headers:{
        "Authorization":`Bearer ${apiKey}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        model:process.env.OPENAI_MODEL||"gpt-5-mini",
        store:false,
        instructions,
        input:JSON.stringify(context),
        max_output_tokens:1400,
        text:{
          format:{
            type:"json_schema",
            name:"atlas_brain_plan",
            strict:true,
            schema
          }
        }
      })
    });

    const data=await response.json();
    if(!response.ok)return send(res,502,{error:"brain-request-failed",status:response.status,details:data?.error?.message||"OpenAI request failed"});

    const text=extractText(data);
    if(!text)return send(res,502,{error:"brain-empty-response"});

    const plan=JSON.parse(text);
    return send(res,200,{plan});
  }catch(error){
    return send(res,500,{error:"brain-failed",details:error?.message||"Unknown error"});
  }
}
