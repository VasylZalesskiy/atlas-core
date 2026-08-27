import supabase from "./supabase";
import {ensureAtlasSession} from "./passportStore";

function shortId(value){return String(value||"").replace(/-/g,"").slice(-4).toUpperCase()||"----"}

export async function joinAtlasPresence({page="/"}={}){
  if(!supabase)throw new Error("supabase-unavailable");
  const user=await ensureAtlasSession();
  let displayName="";
  try{
    const {data}=await supabase.from("atlas_passports").select("display_name").eq("owner_id",user.id).maybeSingle();
    displayName=String(data?.display_name||"").trim();
  }catch{}

  const channel=supabase.channel("atlas:online",{config:{presence:{key:user.id}}});
  const me={
    userId:user.id,
    displayName:displayName||`Гість ${shortId(user.id)}`,
    page:String(page||"/").slice(0,80),
    onlineAt:new Date().toISOString()
  };
  return {channel,me};
}

export function presenceUsers(channel){
  if(!channel)return [];
  const state=channel.presenceState?.()||{};
  const users=[];
  for(const [key,presences] of Object.entries(state)){
    const item=Array.isArray(presences)?presences[presences.length-1]:null;
    if(!item)continue;
    users.push({
      key,
      userId:item.userId||key,
      displayName:item.displayName||`Гість ${shortId(key)}`,
      page:item.page||"/",
      onlineAt:item.onlineAt||""
    });
  }
  return users.sort((a,b)=>String(a.displayName).localeCompare(String(b.displayName),"uk"));
}
