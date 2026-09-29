import {buildMarketplaceShortcuts} from "../../api/_search-utils.js";

function isConcreteExternalResult(item){
  return ["listing","store_option","store_option_pending","web_answer","web_result","official_result"].includes(item?.result_kind);
}

function concreteOnly(items){
  return (Array.isArray(items)?items:[]).filter(isConcreteExternalResult);
}

function usefulResults(items){
  // Result cards must represent a concrete offer/place/answer, not a link to another search.
  return uniqueResults(concreteOnly(items));
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

async function groundedResults(plan,searches,{lang,signal}){
  const focus=searches.find(item=>item.source==="marketplace")?.query||searches[0]?.query||plan?.goal||"";
  try{
    const response=await fetch("/api/grounded-search",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        goal:plan?.goal||focus,
        query:focus,
        domain:plan?.domain||"",
        location_text:plan?.location_text||"",
        language:lang
      }),
      signal
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)return [];
    return concreteOnly(data?.results);
  }catch(error){
    if(error?.name==="AbortError")throw error;
    return [];
  }
}

async function officialDataResults(plan,{lang,signal}){
  const text=`${plan?.original_query||""} ${plan?.goal||""} ${(plan?.external_searches||[]).map(item=>item?.query||"").join(" ")}`;
  if(!/курс\s+(?:долар|євро|валют)|\b(?:usd|eur|pln|gbp|chf)\b|exchange\s+rate/iu.test(text))return [];
  try{
    const response=await fetch("/api/official-data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:text,language:lang}),signal});
    const data=await response.json().catch(()=>({}));
    return response.ok?concreteOnly(data?.results):[];
  }catch(error){if(error?.name==="AbortError")throw error;return []}
}

export async function searchExternalSources(plan,{lang="uk",signal}={}){
  const searches=(plan?.external_searches||[]).filter(item=>["web","marketplace","official"].includes(item?.source));
  if(!searches.length)return [];

  const officialData=await officialDataResults(plan,{lang,signal});
  if(officialData.length)return officialData;

  const wantsMarketplace=searches.some(item=>item.source==="marketplace");
  const marketplaceFallback=()=>wantsMarketplace
    ?buildMarketplaceShortcuts({
      goal:plan?.goal||"",
      query:searches.find(item=>item.source==="marketplace")?.query||plan?.goal||"",
      locationText:plan?.location_text||"",
      language:lang
    }).filter(item=>["listing","store_option","search_page"].includes(item?.result_kind))
    :[];

  // Zero-cost mode: skip paid grounded AI web search and use the independent
  // live web retrieval endpoint directly.
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
      const fallback=uniqueResults(marketplaceFallback());
      if(fallback.length)return fallback;
      const error=new Error(data?.error||"external-search-unavailable");
      error.details=data?.details||"";
      error.status=response.status;
      throw error;
    }
    const results=usefulResults(data?.results);
    if(results.length)return uniqueResults(results);

    // Paid fallback is used only after the zero-cost live retrieval found no
    // concrete result. This keeps Luna web-search spend minimal.
    const grounded=await groundedResults(plan,searches,{lang,signal});
    if(grounded.length)return uniqueResults(grounded);

    return uniqueResults(marketplaceFallback());
  }catch(error){
    if(error?.name==="AbortError")throw error;

    const grounded=await groundedResults(plan,searches,{lang,signal}).catch(()=>[]);
    if(grounded.length)return uniqueResults(grounded);

    const fallback=uniqueResults(marketplaceFallback());
    if(fallback.length)return fallback;
    throw error;
  }
}
