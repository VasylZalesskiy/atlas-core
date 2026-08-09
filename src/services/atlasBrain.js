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
    urgency:"planned",
    needs_location:false,
    clarification:{required:false,question:"",options:[]},
    passport_search:{
      terms,
      capability_description:lang==="uk"?"Можливості людей, речі, навички або допомога, релевантні запиту":"People, items, skills or help relevant to the request"
    },
    external_searches:[],
    safety:{level:"none",message:""},
    result_strategy:lang==="uk"?"Показати найбільш релевантні доступні можливості":"Show the most relevant available opportunities",
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

function hasAnyRetrieval(plan){
  const searches=Array.isArray(plan?.external_searches)
    ?plan.external_searches.some(item=>item&&item.source&&item.source!=="none"&&String(item.query||"").trim())
    :false;
  const passportTerms=Array.isArray(plan?.passport_search?.terms)&&plan.passport_search.terms.some(term=>String(term||"").trim());
  return searches||passportTerms;
}

function planNeedsRecovery(plan){
  if(plan?.clarification?.required&&plan?.clarification?.question)return false;

  // Universal quality gate: when Brain says location is materially required,
  // Atlas must actually retrieve nearby real-world options rather than only articles/pages.
  if(plan?.needs_location&&!hasSearch(plan,"maps"))return true;

  // Atlas must not stop after merely understanding the request.
  return !hasAnyRetrieval(plan);
}

export async function analyzeAtlasQuery(query,{lang="uk",location=null,signal}={}){
  const original=String(query||"").trim();
  const firstPlan=await requestBrainPlan(original,{lang,location,signal});
  if(!planNeedsRecovery(firstPlan))return firstPlan;

  const locationRule=firstPlan?.needs_location
    ?(lang==="uk"
      ?"Перший план сам визначив, що локація важлива, але не створив maps-пошук. Це недопустимо: додай щонайменше один source=maps запит для реальної найближчої людини/місця/сервісу, який може допомогти. Інформаційні статті не можуть замінити локальну дію."
      :"The first plan itself marked location as important but produced no maps search. This is invalid: add at least one source=maps query for a real nearby person/place/service that can help. Informational pages cannot replace local action.")
    :"";

  const recoveryQuery=lang==="uk"
    ?`Оригінальний запит користувача: «${original}». Перший план не пройшов контроль якості. ${locationRule} Якщо одного відсутнього параметра справді бракує для корисного результату — постав одне коротке конкретне уточнення. Інакше сформуй практичні пошуки, які ведуть до конкретної дії. Паспорти можливостей мають шукати реальних людей/ресурси. Не вигадуй результатів і не створюй сценарій під цей приклад.`
    :`Original user request: “${original}”. The first plan failed the quality gate. ${locationRule} If one missing parameter truly blocks a useful result, ask one short specific clarification. Otherwise produce practical retrieval actions that lead to a concrete next step. Opportunity Passports should search for real people/resources. Do not invent results or create a scenario for this example.`;

  try{
    const recoveryPlan=await requestBrainPlan(recoveryQuery,{lang,location,signal});
    return planNeedsRecovery(recoveryPlan)?firstPlan:recoveryPlan;
  }catch(error){
    if(error?.name==="AbortError")throw error;
    return firstPlan;
  }
}
