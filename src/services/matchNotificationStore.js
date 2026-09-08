import supabase from "./supabase";
import {ensureAtlasSession} from "./passportStore";

export async function loadMatchNotifications(){
  if(!supabase)return [];
  await ensureAtlasSession();
  const {data,error}=await supabase.from("atlas_match_notifications")
    .select("id,kind,status,title,body,need_id,opportunity_id,created_at,read_at")
    .order("created_at",{ascending:false})
    .limit(50);
  if(error)throw error;
  return data||[];
}

export async function markMatchNotificationRead(id){
  if(!supabase||!id)return;
  await ensureAtlasSession();
  const now=new Date().toISOString();
  const {error}=await supabase.from("atlas_match_notifications")
    .update({status:"read",read_at:now})
    .eq("id",id)
    .eq("status","unread");
  if(error)throw error;
}

export function getSoundEnabled(){
  try{return localStorage.getItem("atlas-match-sound")!=="off"}catch{return true}
}

export function setSoundEnabled(enabled){
  try{localStorage.setItem("atlas-match-sound",enabled?"on":"off")}catch{}
}

export async function setAppBadge(count){
  try{
    if(count>0&&navigator.setAppBadge)await navigator.setAppBadge(count);
    else if(count<=0&&navigator.clearAppBadge)await navigator.clearAppBadge();
  }catch{}
}

export async function askNotificationPermission(){
  if(!("Notification" in window))return "unsupported";
  if(Notification.permission==="granted")return "granted";
  return Notification.requestPermission();
}

export function playMatchSound(){
  if(!getSoundEnabled())return;
  try{
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext)return;
    const ctx=new AudioContext();
    const now=ctx.currentTime;
    [0,0.16].forEach((offset,index)=>{
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.type="sine";
      osc.frequency.value=index?880:660;
      gain.gain.setValueAtTime(0.0001,now+offset);
      gain.gain.exponentialRampToValueAtTime(0.12,now+offset+0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001,now+offset+0.14);
      osc.connect(gain);gain.connect(ctx.destination);
      osc.start(now+offset);osc.stop(now+offset+0.15);
    });
    setTimeout(()=>ctx.close().catch(()=>{}),700);
  }catch{}
}
