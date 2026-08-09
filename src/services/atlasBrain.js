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

function planHasNextAction(plan){
  const clarification=Boolean(plan?.clarification?.required&&plan?.clarification?.question);
  const searches=Array.isArray(plan?.external_searches)
    ?plan.external_searches.some(item=>item&&item.source&&item.source!=="none"&&String(item.query||"").trim())
    :false;
  return clarification||searches;
}

export async function analyzeAtlasQuery(query,{lang="uk",location=null,signal}={}){
  const original=String(query||"").trim();
  const firstPlan=await requestBrainPlan(original,{lang,location,signal});

  // Universal recovery pass: Atlas must not stop after understanding a request
  // if the plan contains neither a clarification nor a concrete retrieval action.
  if(planHasNextAction(firstPlan))return firstPlan;

  const recoveryQuery=lang==="uk"
    ?`Оригінальний запит користувача: «${original}». Перший план зрозумів мету, але не дав ні конкретного зовнішнього пошуку, ні уточнення. Перевір план ще раз. Якщо одного відсутнього параметра справді бракує для корисного результату — постав одне коротке конкретне уточнення. Якщо уточнення не потрібне — сформуй практичні external_searches, щоб Atlas міг продовжити пошук. Не вигадуй результатів і не створюй сценарій під цей приклад.`
    :`Original user request: “${original}”. The first plan understood the goal but produced neither a concrete external search nor a clarification. Reassess the plan. If one missing parameter truly blocks a useful result, ask one short specific clarification. If clarification is not needed, produce practical external_searches so Atlas can continue retrieval. Do not invent results and do not create a scenario for this example.`;

  try{
    const recoveryPlan=await requestBrainPlan(recoveryQuery,{lang,location,signal});
    return planHasNextAction(recoveryPlan)?recoveryPlan:firstPlan;
  }catch(error){
    if(error?.name==="AbortError")throw error;
    return firstPlan;
  }
}
