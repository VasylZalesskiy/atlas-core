import supabase from "./supabase";
import {ensureAtlasSession} from "./passportStore";

function clean(value){return String(value||"").replace(/\s+/g," ").trim()}

async function expandNeedTerms(query){
  try{
    const response=await fetch("/api/query-expand",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({query})
    });
    if(!response.ok)return [];
    const data=await response.json().catch(()=>({}));
    return Array.isArray(data?.terms)?data.terms.map(clean).filter(Boolean).slice(0,20):[];
  }catch{return []}
}

export async function searchAtlasNeeds(query,{limit=12}={}){
  const cleanQuery=clean(query);
  if(!cleanQuery||!supabase)return {matches:[],error:cleanQuery?"supabase-unavailable":"query-required"};
  await ensureAtlasSession();
  const expanded=await expandNeedTerms(cleanQuery);
  const {data,error}=await supabase.functions.invoke("atlas-search-needs",{
    body:{query:cleanQuery,terms:expanded,limit}
  });
  if(error)return {matches:[],error:error.message||"need-search-failed"};
  return {matches:Array.isArray(data?.matches)?data.matches:[],error:data?.error||null};
}
