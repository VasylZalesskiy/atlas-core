import supabase from "./supabase";
import {ensureAtlasSession} from "./passportStore";

export async function findNeedsForOpportunity(opportunityId){
  if(!supabase)return {matches:[],error:"supabase-unavailable"};
  await ensureAtlasSession();
  const {data,error}=await supabase.functions.invoke("atlas-match-needs",{body:{opportunityId}});
  if(error)return {matches:[],error:error.message||"match-failed"};
  return {matches:Array.isArray(data?.matches)?data.matches:[],error:data?.error||null};
}

export async function findNeedsForOpportunities(opportunities=[]){
  const active=opportunities.filter(item=>item?.id&&item?.is_active);
  const entries=await Promise.all(active.map(async opportunity=>{
    const result=await findNeedsForOpportunity(opportunity.id);
    return [opportunity.id,{opportunity,matches:result.matches,error:result.error}];
  }));
  return Object.fromEntries(entries);
}
