export const DEFAULT_PILOT_STATUS={
  slug:"building-170",
  enabled:true,
  starts_at:null,
  ends_at:null,
  message_uk:"Тест Atlas у вашому будинку тимчасово призупинено.",
  message_en:"The Atlas building pilot is temporarily paused."
};

export function evaluatePilotStatus(row=DEFAULT_PILOT_STATUS,now=new Date()){
  const startsAt=row.starts_at?new Date(row.starts_at):null;
  const endsAt=row.ends_at?new Date(row.ends_at):null;
  const beforeStart=startsAt&&!Number.isNaN(startsAt.getTime())&&now<startsAt;
  const afterEnd=endsAt&&!Number.isNaN(endsAt.getTime())&&now>=endsAt;
  return {...DEFAULT_PILOT_STATUS,...row,active:Boolean(row.enabled)&&!beforeStart&&!afterEnd,beforeStart:Boolean(beforeStart),afterEnd:Boolean(afterEnd)};
}

export async function loadPilotStatus(){
  const url=import.meta.env.VITE_SUPABASE_URL;
  const key=import.meta.env.VITE_SUPABASE_ANON_KEY;
  if(!url||!key)return evaluatePilotStatus(DEFAULT_PILOT_STATUS);
  const endpoint=new URL("/rest/v1/atlas_pilot_config",url);
  endpoint.searchParams.set("select","slug,enabled,starts_at,ends_at,message_uk,message_en,updated_at");
  endpoint.searchParams.set("slug","eq.building-170");
  endpoint.searchParams.set("limit","1");
  const response=await fetch(endpoint,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
  if(!response.ok){
    const message=await response.text();
    if(response.status===401||response.status===404||/atlas_pilot_config|relation .*does not exist|permission denied/i.test(message))return evaluatePilotStatus(DEFAULT_PILOT_STATUS);
    throw new Error(message||`pilot-status-${response.status}`);
  }
  const data=await response.json();
  return evaluatePilotStatus(data?.[0]||DEFAULT_PILOT_STATUS);
}
