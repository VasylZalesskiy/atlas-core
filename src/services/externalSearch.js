import {buildMarketplaceShortcuts} from "../../api/_search-utils.js";

export async function searchExternalSources(plan,{lang="uk",signal}={}){
  const searches=(plan?.external_searches||[]).filter(item=>["web","marketplace","official"].includes(item?.source));
  if(!searches.length)return [];

  const marketplaceFallback=()=>searches.some(item=>item.source==="marketplace")
    ?buildMarketplaceShortcuts({
      goal:plan?.goal||"",
      query:searches.find(item=>item.source==="marketplace")?.query||plan?.goal||"",
      locationText:plan?.location_text||"",
      language:lang
    })
    :[];

  try{
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
      const fallback=marketplaceFallback();
      if(fallback.length)return fallback;
      const error=new Error(data?.error||"external-search-unavailable");
      error.details=data?.details||"";
      error.status=response.status;
      throw error;
    }
    const results=Array.isArray(data?.results)?data.results:[];
    return results.length?results:marketplaceFallback();
  }catch(error){
    if(error?.name==="AbortError")throw error;
    const fallback=marketplaceFallback();
    if(fallback.length)return fallback;
    throw error;
  }
}
