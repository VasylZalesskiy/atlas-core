import supabase from "./supabase";
import {ensureAtlasSession} from "./passportStore";

async function invoke(action,payload={}){
  if(!supabase)throw new Error("supabase-unavailable");
  await ensureAtlasSession();
  const {data,error}=await supabase.functions.invoke("atlas-solution-flow",{body:{action,...payload}});
  if(error)throw new Error(error.message||"solution-flow-failed");
  if(data?.error)throw new Error(data.error);
  return data||{};
}

export async function loadSolutionFlows(){
  const data=await invoke("list");
  return Array.isArray(data.flows)?data.flows:[];
}

export async function startOpportunityRequest({opportunityId,needId=null,message=""}){
  return invoke("request",{opportunityId,needId,message});
}

export async function offerOpportunityToNeed({opportunityId,needId}){
  return invoke("offer",{opportunityId,needId});
}

export async function respondToSolutionFlow(requestId,decision){
  return invoke("respond",{requestId,decision});
}

export async function markSolutionProvided(requestId){
  return invoke("provided",{requestId});
}

export async function completeSolutionFlow(requestId){
  return invoke("complete",{requestId});
}

export async function cancelSolutionFlow(requestId){
  return invoke("cancel",{requestId});
}
