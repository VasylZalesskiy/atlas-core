import {createFallbackPlan} from "../src/services/atlasBrain.js";
import {getFreeAiStatus,runFreeAiResponse} from "./_free-ai.js";

function redactAnalyticsText(value,max=600){
  return String(value||"")
    .replace(/\s+/g," ")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,"[email]")
    .replace(/(?:\+?\d[\d ()-]{7,}\d)/g,"[phone]")
    .trim()
    .slice(0,max);
}

function logAnalytics(event,data={}){
  console.log(JSON.stringify({level:"info",message:"atlas-analytics",event,...data}));
}

function logAnalyticsError(event,error,data={}){
  console.error(JSON.stringify({
    level:"error",
    message:"atlas-analytics",
    event,
    error:String(error?.message||error||"unknown").slice(0,300),
    ...data
  }));
}

function send(res,status,body){
  res.status(status).setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.end(JSON.stringify(body));
}

const schema={
  type:"object",
  additionalProperties:false,
  required:["understood","goal","intent","domain","solution_scope","urgency","needs_location","clarification","passport_search","solution_steps","external_searches","safety","result_strategy"],
  properties:{
    understood:{type:"boolean"},
    goal:{type:"string"},
    intent:{type:"string"},
    domain:{type:"string"},
    solution_scope:{type:"string",enum:["local_action","destination_route","remote_action","information","transaction","mixed"]},
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
    solution_steps:{
      type:"array",
      minItems:1,
      maxItems:4,
      items:{
        type:"object",
        additionalProperties:false,
        required:["id","title","purpose","passport_terms","nearby_query","internet_query","nearby_relevant","internet_relevant"],
        properties:{
          id:{type:"string"},
          title:{type:"string"},
          purpose:{type:"string"},
          passport_terms:{type:"array",items:{type:"string"},maxItems:8},
          nearby_query:{type:"string"},
          internet_query:{type:"string"},
          nearby_relevant:{type:"boolean"},
          internet_relevant:{type:"boolean"}
        }
      }
    },
    external_searches:{
      type:"array",
      maxItems:5,
      items:{
        type:"object",
        additionalProperties:false,
        required:["source","mode","query","reason"],
        properties:{
          source:{type:"string",enum:["maps","web","marketplace","official","none"]},
          mode:{type:"string",enum:["nearby","destination","standard"]},
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

async function runDiagnostic(){
  try{
    const {data,model}=await runFreeAiResponse({instructions:"Reply exactly with OK.",input:"Health check",maxOutputTokens:32,timeoutMs:8000});
    return {
      api_call_ok:true,
      provider:"vercel-ai-gateway",
      model,
      response_status:data?.status||"completed",
      incomplete_reason:data?.incomplete_details?.reason||null,
      output_text:extractText(data).slice(0,20)||null
    };
  }catch(error){
    return {
      api_call_ok:false,
      provider:"vercel-ai-gateway",
      error_code:error?.code||"free-ai-unavailable",
      message:error?.message||"Request failed"
    };
  }
}

function parsePlan(text){
  const raw=String(text||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"");
  const start=raw.indexOf("{");
  const end=raw.lastIndexOf("}");
  if(start<0||end<=start)throw new Error("brain-invalid-json");
  const plan=JSON.parse(raw.slice(start,end+1));
  if(!plan||typeof plan!=="object"||!Array.isArray(plan.solution_steps)||!Array.isArray(plan.external_searches)||!plan.passport_search){
    throw new Error("brain-invalid-plan");
  }
  return plan;
}

export default async function handler(req,res){
  const startedAt=Date.now();

  if(req.method==="GET"){
    const freeAi=await getFreeAiStatus({force:String(req.query?.refresh||"")==="1"});
    const base={status:"atlas-brain-endpoint-online",ai:freeAi,paid_ai_disabled:true};
    if(String(req.query?.test||"")==="1"){
      const diagnostic=await runDiagnostic();
      return send(res,200,{...base,...diagnostic});
    }
    return send(res,200,base);
  }

  if(req.method!=="POST")return send(res,405,{error:"method-not-allowed"});

  let body={};
  try{
    body=typeof req.body==="string"?JSON.parse(req.body||"{}"):req.body||{};
  }catch{
    return send(res,400,{error:"invalid-json"});
  }

  const query=String(body.query||"").trim();
  const locationText=String(body.location_text||"").replace(/\s+/g," ").trim().slice(0,200);
  const language=body.language==="en"?"en":"uk";
  const location=body.location&&Number.isFinite(Number(body.location.latitude))&&Number.isFinite(Number(body.location.longitude))
    ?{latitude:Number(body.location.latitude),longitude:Number(body.location.longitude)}
    :null;

  if(!query)return send(res,400,{error:"query-required"});
  if(query.length>1200)return send(res,400,{error:"query-too-long"});

  logAnalytics("atlas_search_submitted",{
    query:redactAnalyticsText(query),
    language,
    location_provided:Boolean(location||locationText),
    request_id:String(req.headers?.["x-vercel-id"]||"").slice(0,160)
  });

  const resolvedCoordinates=await resolveLocationContext(location,language);
  const locationContext=resolvedCoordinates||(
    locationText
      ?{resolved:true,city:locationText,region:"",country:"",country_code:"",display_name:locationText,source:"user_text"}
      :null
  );

  const instructions=`You are Atlas Brain, a universal intent and solution planner.\n\nCritical rule: never rely on a registry of predefined scenarios. Treat every user request semantically, including requests you have never seen before. Examples are tests, not categories.\n\nYour job is to convert the user's natural-language request into a compact search plan for Atlas. Atlas ALWAYS checks Opportunity Passports first (people, skills, things, help, items to lend/sell/give away), then continues with maps or external sources when they add value. A Passport miss must never stop the task.\n\nCHANNEL-NEUTRALITY POLICY: The user states the desired outcome; Atlas must not silently choose a fulfillment channel that the user did not request. If the user does not explicitly say delivery, online, remote, marketplace, pickup, nearby-only, or another channel, do not collapse the task into one of those channels. When a present need can plausibly be fulfilled by people/resources in Passports, by a nearby real-world place, and/or by an online service, plan multiple practical channels in this order: Opportunity Passports first, then nearby local fulfillment when location is available, then online/web/marketplace as an additional alternative. In such cases use solution_scope=mixed (or local_action when local fulfillment is clearly the main path), set needs_location=true when nearby fulfillment adds value, and include at least one source=maps, mode=nearby search. Online/delivery results must not replace local possibilities unless the user explicitly asked for online/delivery.\n\nClassify solution_scope semantically:\n- local_action: the user needs a nearby real person/place/service/resource.\n- destination_route: the user wants to reach a named destination, address, city, venue or place.\n- remote_action: the useful action is explicitly remote/online or local fulfillment is not materially relevant.\n- information: the user mainly wants facts/explanation.\n- transaction: buying/selling/renting/exchanging.\n- mixed: more than one of these is materially needed.\n\nMAP MODES:\n- source=maps, mode=nearby means search around the user's current location for a provider/place/resource.\n- source=maps, mode=destination means resolve the named destination globally, even when it is outside the nearby radius, then Atlas will build a route from the user's current position. For destination mode, query must contain ONLY the destination name/address (plus city/country if useful), never phrases like “route to”, “how to get”, “drive to”, or generic transport instructions.\n- For non-map sources always use mode=standard.\n\nDESTINATION ROUTE POLICY: If the user asks how to get/travel/drive/walk to a named destination, set solution_scope=destination_route, needs_location=true, and include at least one source=maps, mode=destination search. The destination query must be the actual destination, not a nearby search term. Passport search should look for people/resources that could directly help with the trip when relevant (for example driver, ride, carpool, transport), but after Passports Atlas must still build the destination route. Do not replace a route with travel advice or web articles.\n\nACTION-FIRST POLICY: Atlas exists to help the user DO something, not merely read about it. When the request is a current real-world need and a nearby person/place/service could solve it, prioritize actionable local retrieval with source=maps, mode=nearby and relevant Opportunity Passport capabilities. Informational web pages, articles, guides, category pages, regulations or official explanations are secondary and must never replace a real provider/place/action when one can reasonably be searched.\n\nPHYSICAL-HELP POLICY: If the user describes a current bodily symptom, pain, injury, or other health concern, do not diagnose and do not choose a disease. Treat the practical goal as finding appropriate nearby medical help. Set solution_scope=local_action and needs_location=true. If location is available, include at least one source=maps, mode=nearby search for broad appropriate care such as hospital, clinic, urgent care, family doctor, medical center or emergency department, using neutral provider terms rather than a guessed diagnosis. Populate passport_search with relevant human capabilities such as doctor, nurse, paramedic, family doctor or other suitable medical professional. Unless the user explicitly asks for medical information or explanations, do NOT use informational web/official articles as the primary retrieval path.\n\nDo not invent businesses, people, products, distances, availability, prices, diagnoses, contacts, programs, eligibility rules, routes or legal facts. Do not claim a result exists; only define what should be searched. Ask at most ONE clarification question, and only if one missing detail materially blocks a useful search. If useful searching can start without clarification, set clarification.required=false.\n\nLocation policy: if location_context is resolved, use its city/region/country in search queries whenever geography materially affects the answer. Do not ask for location again when the supplied context is sufficient. If geography is essential but location_context is unavailable, one location clarification is allowed.\n\nSource policy: when an answer depends on current official rules, public benefits, grants, regulated services, legal requirements, or government programs, include at least one external_searches item with source=official, mode=standard and a geography-specific query. For products, offers, rentals, vehicles, jobs or other listings, use marketplace/web with mode=standard as appropriate.\n\nSafety policy: do not add generic common-sense warnings to ordinary tasks. Set safety.level=none unless the user's request itself implies a concrete health, physical, legal, fraud, or emergency risk. For health/safety situations, do not diagnose. Mark caution/urgent only when appropriate and keep the message concise.\n\nUse the user's language (${language}). Keep search terms short and practical. result_strategy should say what Atlas should prioritize when ranking final results (for example Passport relevance first, then proximity, route time, availability, price, trust, authority, recency, urgency, and immediate actionability).`;

  const solutionChainPolicy=`SOLUTION-CHAIN POLICY: Atlas checks Opportunity Passports first, then automatically executes useful nearby and internet searches without asking the user to choose a source. Build solution_steps as the shortest practical sequence that completes this specific task, using 1-4 necessary steps only. Each step must describe a real outcome, not a generic category. A purchase may need acquisition, delivery, installation or storage, but include each link ONLY when it materially helps this user's stated goal. Never force a predefined chain onto every request. For every step provide concise Opportunity Passport terms, a practical nearby provider/place query, and a practical internet or marketplace query. Set the corresponding relevance flag to false and leave its query empty when a channel would not help. For transactions, preserve whether the user wants to buy, sell, rent or exchange. Preserve the exact product/service, requested quantity and known geography in acquisition search queries. For bulk acquisition, the first step must search concrete supplier listings able to cover the requested quantity; delivery and storage are separate steps only when they are materially required. If a bare product-and-quantity request is genuinely ambiguous between buying and selling, ask one short clarification with those two options.`;

  const context={
    query,
    language,
    location_available:Boolean(location||locationText),
    location_text:locationText,
    location_context:locationContext
  };

  const fallback=(reason)=>{
    const plan={...createFallbackPlan(query,{lang:language}),location_text:locationText};
    logAnalytics("atlas_brain_free_fallback",{reason:String(reason||"free-ai-unavailable").slice(0,120),duration_ms:Date.now()-startedAt});
    return send(res,200,{plan,model:"deterministic/free",ai_status:"fallback",fallback_reason:String(reason||"free-ai-unavailable").slice(0,160),location_context:locationContext});
  };

  try{
    const {data,model}=await runFreeAiResponse({
      instructions:`${instructions}\n\n${solutionChainPolicy}\n\nReturn ONLY one JSON object matching this JSON Schema. Do not use Markdown fences or add prose:\n${JSON.stringify(schema)}`,
      input:JSON.stringify(context),
      maxOutputTokens:2600,
      timeoutMs:15000
    });

    if(data?.status==="incomplete"){
      return fallback(data?.incomplete_details?.reason||"brain-incomplete-response");
    }

    const text=extractText(data);
    if(!text)return fallback("brain-empty-response");

    let plan;
    try{
      plan=parsePlan(text);
    }catch{
      return fallback("brain-invalid-json");
    }

    logAnalytics("atlas_brain_completed",{
      domain:String(plan?.domain||"").slice(0,80),
      solution_scope:String(plan?.solution_scope||"").slice(0,40),
      urgency:String(plan?.urgency||"").slice(0,24),
      step_count:Array.isArray(plan?.solution_steps)?plan.solution_steps.length:0,
      clarification_required:Boolean(plan?.clarification?.required),
      duration_ms:Date.now()-startedAt
    });

    return send(res,200,{plan,model,ai_status:"free-ai",paid_ai_disabled:true,location_context:locationContext});
  }catch(error){
    logAnalyticsError("atlas_brain_free_ai_unavailable",error,{duration_ms:Date.now()-startedAt});
    return fallback(error?.name==="AbortError"?"free-ai-timeout":error?.code||error?.message||"free-ai-unavailable");
  }
}
