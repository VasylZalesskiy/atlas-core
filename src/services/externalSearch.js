import {buildMarketplaceShortcuts} from "../../api/_search-utils.js";
import {searchOviForTask} from "./oviSearchBridge";

function isActionableExternalResult(item){
  return ["listing","store_option"].includes(item?.result_kind);
}

function actionableOnly(items){
  return (Array.isArray(items)?items:[]).filter(isActionableExternalResult);
}

function uniqueResults(items){
  const seen=new Set();
  return items.filter(item=>{
    const key=`${item?.source_name||item?.source_type||""}:${item?.url||""}:${item?.title||""}`;
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  });
}

export async function searchExternalSources(plan,{lang="uk",signal}={}){
  const searches=(plan?.external_searches||[]).filter(item=>["web","marketplace","official"].includes(item?.source));
  if(!searches.length)return [];

  // OVI is a first-party concrete commercial source. It is checked in parallel
  // with marketplace retrieval, but only stock-backed offers are allowed to
  // enter Atlas as a solved result.
  const wantsMarketplace=searches.some(item=>item.source==="marketplace");
  const oviPromise=wantsMarketplace
    ?searchOviForTask(plan?.goal||searches[0]?.query||"",{lang}).catch(()=>[])
    :Promise.resolve([]);

  // Search shortcuts are useful as internal fallbacks, but they are NOT a solved
  // Atlas result. A user should never receive "go search on Google/OLX" as the
  // best answer. Only concrete listings/store options can enter solution ranking.
  const marketplaceFallback=()=>wantsMarketplace
    ?actionableOnly(buildMarketplaceShortcuts({
      goal:plan?.goal||"",
      query:searches.find(item=>item.source==="marketplace")?.query||plan?.goal||"",
      locationText:plan?.location_text||"",
      language:lang
    }))
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
    const [data,oviResults]=await Promise.all([
      response.json().catch(()=>({})),
      oviPromise
    ]);
    if(!response.ok){
      const fallback=uniqueResults([...oviResults,...marketplaceFallback()]);
      if(fallback.length)return fallback;
      const error=new Error(data?.error||"external-search-unavailable");
      error.details=data?.details||"";
      error.status=response.status;
      throw error;
    }
    const results=actionableOnly(data?.results);
    return uniqueResults([...oviResults,...(results.length?results:marketplaceFallback())]);
  }catch(error){
    if(error?.name==="AbortError")throw error;
    const oviResults=await oviPromise;
    const fallback=uniqueResults([...oviResults,...marketplaceFallback()]);
    if(fallback.length)return fallback;
    throw error;
  }
}
