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

function hasWebRetrieval(plan){
  return Array.isArray(plan?.external_searches)
    ?plan.external_searches.some(item=>item&&["web","marketplace","official"].includes(item.source)&&String(item.query||"").trim())
    :false;
}

function hasExternalRetrieval(plan){
  return Array.isArray(plan?.external_searches)
    ?plan.external_searches.some(item=>item&&item.source&&item.source!=="none"&&String(item.query||"").trim())
    :false;
}

function hasAnyRetrieval(plan){
  const searches=hasExternalRetrieval(plan);
  const passportTerms=Array.isArray(plan?.passport_search?.terms)&&plan.passport_search.terms.some(term=>String(term||"").trim());
  return searches||passportTerms;
}

function hasContradictoryClarification(plan){
  return Boolean(plan?.clarification?.required&&plan?.clarification?.question&&hasExternalRetrieval(plan));
}

function planNeedsRecovery(plan,{locationAvailable=false}={}){
  // A clarification is allowed to block only when Atlas genuinely cannot start
  // a useful external action yet. If Brain already produced executable searches,
  // saying “clarification required” is contradictory and must be rebuilt.
  if(hasContradictoryClarification(plan))return true;
  if(plan?.clarification?.required&&plan?.clarification?.question)return false;

  // A destination route is not a nearby-place lookup. Atlas must resolve the
  // named destination globally and route to it from the user's current point.
  if(plan?.solution_scope==="destination_route"&&!hasMapMode(plan,"destination"))return true;

  // If location is materially required for a local action, Atlas must actually
  // retrieve a nearby real-world option rather than only return articles/pages.
  if(plan?.solution_scope==="local_action"&&plan?.needs_location&&!hasMapMode(plan,"nearby"))return true;
  if(plan?.needs_location&&!hasSearch(plan,"maps"))return true;

  // Channel-neutral mixed tasks must not collapse into web/delivery only.
  // When Atlas itself classifies the task as mixed and the user's location is
  // already known, a web retrieval path must be accompanied by a nearby path.
  if(plan?.solution_scope==="mixed"&&locationAvailable&&hasWebRetrieval(plan)&&!hasMapMode(plan,"nearby"))return true;

  // Atlas must not stop after merely understanding the request.
  return !hasAnyRetrieval(plan);
}

function recoveryInstruction(plan,{lang="uk",locationAvailable=false}={}){
  const clarificationRule=hasContradictoryClarification(plan)
    ?(lang==="uk"
      ?"План суперечливий: він одночасно каже, що уточнення обов'язкове, і вже містить виконувані зовнішні пошуки. Якщо корисний пошук уже можна почати, встанови clarification.required=false і продовжуй виконання. Уточнення допустиме лише коли без нього справді неможливо почати корисний пошук."
      :"The plan is contradictory: it marks clarification as required while already containing executable external searches. If useful retrieval can already begin, set clarification.required=false and continue execution. Clarification is allowed only when useful searching truly cannot start without it.")
    :"";

  const routeRule=plan?.solution_scope==="destination_route"
    ?(lang==="uk"
      ?"Це маршрут до названого пункту призначення. План зобов'язаний містити source=maps, mode=destination, а query має бути лише назвою/адресою пункту призначення без слів про маршрут."
      :"This is a route to a named destination. The plan must contain source=maps, mode=destination, and query must be only the destination name/address without route wording.")
    :"";

  const localRule=plan?.solution_scope==="local_action"&&plan?.needs_location
    ?(lang==="uk"
      ?"Це локальна фізична дія. План зобов'язаний містити source=maps, mode=nearby для реальної людини/місця/сервісу поруч."
      :"This is a local physical action. The plan must contain source=maps, mode=nearby for a real nearby person/place/service.")
    :"";

  const mixedRule=plan?.solution_scope==="mixed"&&locationAvailable&&hasWebRetrieval(plan)&&!hasMapMode(plan,"nearby")
    ?(lang==="uk"
      ?"Це змішана задача з відомою локацією, але план звузив рішення до web/доставки. Це порушує нейтральність каналів: додай source=maps, mode=nearby для реальних локальних варіантів. Web/доставка може залишитися лише додатковим каналом після Паспортів і локальних варіантів."
      :"This is a mixed task with known location, but the plan collapsed fulfillment into web/delivery. This violates channel neutrality: add source=maps, mode=nearby for real local options. Web/delivery may remain only as an additional channel after Passports and local options.")
    :"";

  return [clarificationRule,routeRule,localRule,mixedRule].filter(Boolean).join(" ");
}

export async function analyzeAtlasQuery(query,{lang="uk",location=null,signal}={}){
  const original=String(query||"").trim();
  const qualityContext={locationAvailable:Boolean(location)};
  let candidate=await requestBrainPlan(original,{lang,location,signal});
  if(!planNeedsRecovery(candidate,qualityContext))return candidate;

  // Give Brain up to two chances to rebuild an invalid plan. Never return the
  // original invalid plan merely because the first recovery was also invalid.
  for(let attempt=0;attempt<2;attempt+=1){
    const violation=recoveryInstruction(candidate,{lang,...qualityContext});
    const recoveryQuery=lang==="uk"
      ?`Оригінальний запит користувача: «${original}». Поточний план не пройшов контроль якості. ${violation} Паспорти можливостей завжди перевіряються першими, але їх відсутність не може зупинити виконання задачі. Не нав'язуй канал, якого користувач не просив. Не став уточнення, якщо вже можна почати корисний пошук. Якщо одного відсутнього параметра справді бракує для будь-якого корисного пошуку — постав одне коротке уточнення. Інакше сформуй практичні пошуки, які ведуть до конкретної дії. Не вигадуй результатів і не створюй сценарій під цей приклад.`
      :`Original user request: “${original}”. The current plan failed the quality gate. ${violation} Opportunity Passports are always checked first, but a Passport miss must not stop execution. Do not impose a fulfillment channel the user did not request. Do not ask for clarification when useful searching can already begin. If one missing parameter truly blocks all useful retrieval, ask one short clarification. Otherwise produce practical retrieval actions that lead to a concrete next step. Do not invent results or create a scenario for this example.`;

    try{
      candidate=await requestBrainPlan(recoveryQuery,{lang,location,signal});
      if(!planNeedsRecovery(candidate,qualityContext))return candidate;
    }catch(error){
      if(error?.name==="AbortError")throw error;
      break;
    }
  }

  // If Brain still returns a contradictory clarification together with runnable
  // searches, do not block the user with the question: keep the searches and
  // let Atlas execute them. Structural map/channel checks above still apply.
  if(hasContradictoryClarification(candidate)){
    candidate={
      ...candidate,
      clarification:{required:false,question:"",options:[]}
    };
  }

  // If Brain still cannot produce a quality-valid channel-neutral plan, suppress
  // misleading web-only fulfillment instead of pretending it is the full answer.
  if(candidate?.solution_scope==="mixed"&&qualityContext.locationAvailable&&hasWebRetrieval(candidate)&&!hasMapMode(candidate,"nearby")){
    return {
      ...candidate,
      external_searches:(candidate.external_searches||[]).filter(item=>!["web","marketplace","official"].includes(item?.source)),
      clarification:{
        required:true,
        question:lang==="uk"?"Не вдалося надійно знайти локальні варіанти. Хочете, щоб Atlas поки показав онлайн/доставку?":"Local options could not be retrieved reliably. Should Atlas show online/delivery options for now?",
        options:lang==="uk"?["Так, показати онлайн / доставку"]:["Yes, show online / delivery"]
      }
    };
  }

  return candidate;
}
