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

export async function analyzeAtlasQuery(query,{lang="uk",location=null,signal}={}){
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
