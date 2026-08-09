function cleanTerms(query){
  return [...new Set(String(query||"").toLowerCase().replace(/[.,!?;:()]/g," ").split(/\s+/).filter(word=>word.length>2))].slice(0,12);
}

export function createFallbackPlan(query,{lang="uk"}={}){
  const terms=cleanTerms(query);
  return {
    understood:Boolean(String(query||"").trim()),
    goal:String(query||"").trim(),
    intent:"solve",
    domain:"general",
    solution_scope:"mixed",
    urgency:"planned",
    needs_location:false,
    clarification:{required:false,question:"",options:[]},
    passport_search:{
      terms,
      capability_description:lang==="uk"?"Можливості людей, речі, навички або допомога, релевантні запиту":"People, items, skills or help relevant to the request"
    },
    external_searches:[],
    safety:{level:"none",message:""},
    result_strategy:lang==="uk"?"Спочатку Паспорти можливостей, потім найкращі додаткові варіанти":"Opportunity Passports first, then the best additional options",
    fallback:true
  };
}

async function requestBrainPlan(query,{lang="uk",location=null,signal}={}){
  const response=await fetch("/api/brain",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({query,language:lang,location}),
    signal
  });

  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const error=new Error(data?.error||"atlas-brain-unavailable");
    error.details=data?.details||"";
    error.status=response.status;
    throw error;
  }

  if(!data?.plan)throw new Error("atlas-brain-empty-plan");
  return data.plan;
}

function hasSearch(plan,source){
  return Array.isArray(plan?.external_searches)
    ?plan.external_searches.some(item=>item&&item.source===source&&String(item.query||"").trim())
    :false;
}

function hasMapMode(plan,mode){
  return Array.isArray(plan?.external_searches)
    ?plan.external_searches.some(item=>item&&item.source==="maps"&&item.mode===mode&&String(item.query||"").trim())
    :false;
}

function hasAnyRetrieval(plan){
  const searches=Array.isArray(plan?.external_searches)
    ?plan.external_searches.some(item=>item&&item.source&&item.source!=="none"&&String(item.query||"").trim())
    :false;
  const passportTerms=Array.isArray(plan?.passport_search?.terms)&&plan.passport_search.terms.some(term=>String(term||"").trim());
  return searches||passportTerms;
}

function planNeedsRecovery(plan){
  if(plan?.clarification?.required&&plan?.clarification?.question)return false;

  // A destination route is not a nearby-place lookup. Atlas must resolve the
  // named destination globally and route to it from the user's current point.
  if(plan?.solution_scope==="destination_route"&&!hasMapMode(plan,"destination"))return true;

  // If location is materially required for a local action, Atlas must actually
  // retrieve a nearby real-world option rather than only return articles/pages.
  if(plan?.solution_scope==="local_action"&&plan?.needs_location&&!hasMapMode(plan,"nearby"))return true;
  if(plan?.needs_location&&!hasSearch(plan,"maps"))return true;

  // Atlas must not stop after merely understanding the request.
  return !hasAnyRetrieval(plan);
}

export async function analyzeAtlasQuery(query,{lang="uk",location=null,signal}={}){
  const original=String(query||"").trim();
  const firstPlan=await requestBrainPlan(original,{lang,location,signal});
  if(!planNeedsRecovery(firstPlan))return firstPlan;

  const routeRule=firstPlan?.solution_scope==="destination_route"
    ?(lang==="uk"
      ?"Це маршрут до названого пункту призначення. План зобов'язаний містити source=maps, mode=destination, а query має бути лише назвою/адресою пункту призначення без слів про маршрут."
      :"This is a route to a named destination. The plan must contain source=maps, mode=destination, and query must be only the destination name/address without route wording.")
    :"";
  const localRule=firstPlan?.solution_scope==="local_action"&&firstPlan?.needs_location
    ?(lang==="uk"
      ?"Це локальна фізична дія. План зобов'язаний містити source=maps, mode=nearby для реальної людини/місця/сервісу поруч."
      :"This is a local physical action. The plan must contain source=maps, mode=nearby for a real nearby person/place/service.")
    :"";

  const recoveryQuery=lang==="uk"
    ?`Оригінальний запит користувача: «${original}». Перший план не пройшов контроль якості. ${routeRule} ${localRule} Паспорти можливостей завжди перевіряються першими, але їх відсутність не може зупинити виконання задачі. Якщо одного відсутнього параметра справді бракує — постав одне коротке уточнення. Інакше сформуй практичні пошуки, які ведуть до конкретної дії. Не вигадуй результатів і не створюй сценарій під цей приклад.`
    :`Original user request: “${original}”. The first plan failed the quality gate. ${routeRule} ${localRule} Opportunity Passports are always checked first, but a Passport miss must not stop execution. If one missing parameter truly blocks progress, ask one short clarification. Otherwise produce practical retrieval actions that lead to a concrete next step. Do not invent results or create a scenario for this example.`;

  try{
    const recoveryPlan=await requestBrainPlan(recoveryQuery,{lang,location,signal});
    return planNeedsRecovery(recoveryPlan)?firstPlan:recoveryPlan;
  }catch(error){
    if(error?.name==="AbortError")throw error;
    return firstPlan;
  }
}