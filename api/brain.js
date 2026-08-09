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

async function resolveLocationContext(location,language){
  if(!location)return null;
  const base={latitude:location.latitude,longitude:location.longitude,resolved:false};
  try{
    const params=new URLSearchParams({
      format:"jsonv2",
      lat:String(location.latitude),
      lon:String(location.longitude),
      zoom:"10",
      addressdetails:"1",
      "accept-language":language==="en"?"en":"uk"
    });
    const response=await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`,{
      headers:{Accept:"application/json","User-Agent":"Atlas-MVP/2.5"}
    });
    if(!response.ok)return base;
    const data=await response.json();
    const address=data?.address||{};
    const city=address.city||address.town||address.village||address.municipality||address.county||"";
    const region=address.state||address.region||address.county||"";
    const country=address.country||"";
    const countryCode=String(address.country_code||"").toUpperCase();
    return {
      ...base,
      resolved:Boolean(city||region||country),
      city,
      region,
      country,
      country_code:countryCode,
      display_name:String(data?.display_name||"").slice(0,300)
    };
  }catch{
    return base;
  }
}

async function runDiagnostic(apiKey,model){
  try{
    const response=await fetch(OPENAI_URL,{
      method:"POST",
      headers:{
        "Authorization":`Bearer ${apiKey}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        model,
        store:false,
        input:"Reply exactly with OK.",
        reasoning:{effort:"minimal"},
        max_output_tokens:256
      })
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      return {
        api_call_ok:false,
        openai_status:response.status,
        error_type:data?.error?.type||"unknown",
        error_code:data?.error?.code||"unknown",
        message:data?.error?.message||"OpenAI request failed"
      };
    }
    return {
      api_call_ok:true,
      openai_status:response.status,
      model:data?.model||model,
      response_status:data?.status||"completed",
      incomplete_reason:data?.incomplete_details?.reason||null,
      output_text:extractText(data).slice(0,20)||null
    };
  }catch(error){
    return {
      api_call_ok:false,
      openai_status:0,
      error_type:"network_or_runtime_error",
      error_code:"request_failed",
      message:error?.message||"Request failed"
    };
  }
}

export default async function handler(req,res){
  const apiKey=process.env.OPENAI_API_KEY;
  const model=process.env.OPENAI_MODEL||"gpt-5-mini";

  if(req.method==="GET"){
    const base={
      status:"atlas-brain-endpoint-online",
      openai_key_configured:Boolean(apiKey),
      model
    };
    if(String(req.query?.test||"")==="1"){
      if(!apiKey)return send(res,200,{...base,api_call_ok:false,error_code:"openai-key-missing"});
      const diagnostic=await runDiagnostic(apiKey,model);
      return send(res,200,{...base,...diagnostic});
    }
    return send(res,200,base);
  }

  if(req.method!=="POST")return send(res,405,{error:"method-not-allowed"});
  if(!apiKey)return send(res,503,{error:"openai-key-missing"});

  let body={};
  try{
    body=typeof req.body==="string"?JSON.parse(req.body||"{}"):req.body||{};
  }catch{
    return send(res,400,{error:"invalid-json"});
  }

  const query=String(body.query||"").trim();
  const language=body.language==="en"?"en":"uk";
  const location=body.location&&Number.isFinite(Number(body.location.latitude))&&Number.isFinite(Number(body.location.longitude))
    ?{latitude:Number(body.location.latitude),longitude:Number(body.location.longitude)}
    :null;

  if(!query)return send(res,400,{error:"query-required"});
  if(query.length>1200)return send(res,400,{error:"query-too-long"});

  const locationContext=await resolveLocationContext(location,language);

  const instructions=`You are Atlas Brain, a universal intent and solution planner.\n\nCritical rule: never rely on a registry of predefined scenarios. Treat every user request semantically, including requests you have never seen before. Examples are tests, not categories.\n\nYour job is to convert the user's natural-language request into a compact search plan for Atlas. Atlas first searches Opportunity Passports (people, skills, things, help, items to lend/sell/give away), then uses external sources only when needed.\n\nDo not invent businesses, people, products, distances, availability, prices, diagnoses, contacts, programs, eligibility rules, or legal facts. Do not claim a result exists; only define what should be searched. Ask at most ONE clarification question, and only if one missing detail materially blocks a useful search. If useful searching can start without clarification, set clarification.required=false.\n\nLocation policy: if location_context is resolved, use its city/region/country in search queries whenever geography materially affects the answer. Do not ask for location again when the supplied context is sufficient. If geography is essential but location_context is unavailable, one location clarification is allowed.\n\nSource policy: when an answer depends on current official rules, public benefits, grants, regulated services, legal requirements, or government programs, include at least one external_searches item with source=official and a geography-specific query. For products, offers, rentals, vehicles, jobs or other listings, use marketplace/web as appropriate. For nearby physical places, use maps. These are retrieval policies, not predefined user scenarios.\n\nFor health/safety situations, do not diagnose. Mark safety caution/urgent only when appropriate and keep the message concise.\n\nUse the user's language (${language}). Keep search terms short and practical. result_strategy should say what Atlas should prioritize when ranking final results (for example proximity, availability, price, trust, authority, recency, or urgency).`;

  const context={
    query,
    language,
    location_available:Boolean(location),
    location_context:locationContext
  };

  try{
    const response=await fetch(OPENAI_URL,{
      method:"POST",
      headers:{
        "Authorization":`Bearer ${apiKey}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        model,
        store:false,
        reasoning:{effort:"minimal"},
        instructions,
        input:JSON.stringify(context),
        max_output_tokens:2400,
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

    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      return send(res,502,{
        error:"brain-request-failed",
        status:response.status,
        details:data?.error?.message||"OpenAI request failed",
        code:data?.error?.code||"",
        type:data?.error?.type||""
      });
    }

    if(data?.status==="incomplete"){
      return send(res,502,{
        error:"brain-incomplete-response",
        reason:data?.incomplete_details?.reason||"unknown",
        model:data?.model||model
      });
    }

    const text=extractText(data);
    if(!text)return send(res,502,{error:"brain-empty-response",status:data?.status||"unknown"});

    let plan;
    try{
      plan=JSON.parse(text);
    }catch{
      return send(res,502,{error:"brain-invalid-json"});
    }

    return send(res,200,{plan,model:data?.model||model,location_context:locationContext});
  }catch(error){
    return send(res,500,{error:"brain-failed",details:error?.message||"Unknown error"});
  }
}
