import {buildMarketplaceShortcuts} from "../../api/_search-utils.js";
import {searchOviForTask} from "./oviSearchBridge";

function isConcreteExternalResult(item){
  return ["listing","store_option","store_option_pending"].includes(item?.result_kind);
}

function concreteOnly(items){
  return (Array.isArray(items)?items:[]).filter(isConcreteExternalResult);
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

function orderedResults(oviResults,otherResults){
  const readyOvi=oviResults.filter(item=>item.result_kind==="store_option");
  const pendingOvi=oviResults.filter(item=>item.result_kind==="store_option_pending");
  return uniqueResults([...readyOvi,...otherResults,...pendingOvi]);
}

export async function searchExternalSources(plan,{lang="uk",signal}={}){
  const searches=(plan?.external_searches||[]).filter(item=>["web","marketplace","official"].includes(item?.source));
  if(!searches.length)return [];

  // OVI is checked in parallel with marketplace retrieval. Sufficient stock is
  // a solved result; insufficient stock is kept only as a concrete partial option.
  const wantsMarketplace=searches.some(item=>item.source==="marketplace");
  const oviPromise=wantsMarketplace
    ?searchOviForTask(plan?.goal||searches[0]?.query||"",{lang}).catch(()=>[])
    :Promise.resolve([]);

  // Search shortcuts are useful internally, but they are NOT an Atlas solution.
  // Only concrete listings/store options may reach the result UI.
  const marketplaceFallback=()=>wantsMarketplace
    ?concreteOnly(buildMarketplaceShortcuts({
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
      const fallback=orderedResults(oviResults,marketplaceFallback());
      if(fallback.length)return fallback;
      const error=new Error(data?.error||"external-search-unavailable");
      error.details=data?.details||"";
      error.status=response.status;
      throw error;
    }
    const results=concreteOnly(data?.results);
    return orderedResults(oviResults,results.length?results:marketplaceFallback());
  }catch(error){
    if(error?.name==="AbortError")throw error;
    const oviResults=await oviPromise;
    const fallback=orderedResults(oviResults,marketplaceFallback());
    if(fallback.length)return fallback;
    throw error;
  }
}
