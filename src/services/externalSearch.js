export async function searchExternalSources(plan,{lang="uk",signal}={}){
  const searches=(plan?.external_searches||[]).filter(item=>["web","marketplace","official"].includes(item?.source));
  if(!searches.length)return [];

  const response=await fetch("/api/external-search",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      goal:plan.goal,
      domain:plan.domain||"",
      solution_scope:plan.solution_scope||"",
      location_text:plan.location_text||"",
      searches,
      language:lang
    }),
    signal
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const error=new Error(data?.error||"external-search-unavailable");
    error.details=data?.details||"";
    error.status=response.status;
    throw error;
  }
  return Array.isArray(data?.results)?data.results:[];
}
