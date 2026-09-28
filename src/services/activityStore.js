import supabase from "./supabase";
import adminSupabase from "./adminSupabase";

const SESSION_KEY="atlas-activity-session";

function clean(value,max=500){
  return String(value??"").replace(/\s+/g," ").trim().slice(0,max);
}

function getSessionId(){
  try{
    let value=localStorage.getItem(SESSION_KEY);
    if(!value){
      value=crypto.randomUUID();
      localStorage.setItem(SESSION_KEY,value);
    }
    return value;
  }catch{
    return crypto.randomUUID();
  }
}

function safeMeta(meta={}){
  const out={};
  for(const [key,value] of Object.entries(meta||{})){
    if(value==null||["string","number","boolean"].includes(typeof value)){
      out[clean(key,60)]=typeof value==="string"?clean(value,240):value;
    }
  }
  return out;
}

export function recordAtlasActivity(eventName,{label="",path="",meta={}}={}){
  if(!supabase||typeof window==="undefined")return;
  const payload={
    session_id:getSessionId(),
    event_name:clean(eventName,80)||"activity",
    path:clean(path||window.location.pathname,240),
    label:clean(label,500),
    meta:safeMeta(meta)
  };
  Promise.resolve(supabase.from("atlas_activity_events").insert(payload)).catch(()=>{});
}

function requireAdmin(){
  if(!adminSupabase)throw new Error("supabase-unavailable");
  return adminSupabase;
}

export async function loadActivityAdminState(){
  const client=requireAdmin();
  const {data:userData,error:userError}=await client.auth.getUser();
  if(userError&&!/session.*missing/i.test(String(userError.message||"")))throw userError;
  const user=userData?.user||null;
  if(!user)return {user:null,isAdmin:false};
  const {data,error}=await client.from("atlas_catalog_admins").select("email_hash").maybeSingle();
  if(error)throw error;
  return {user,isAdmin:Boolean(data)};
}

export async function requestActivityAdminLink(email){
  const client=requireAdmin();
  const value=clean(email,254).toLowerCase();
  if(!value||!value.includes("@"))throw new Error("email-required");
  const {error}=await client.auth.signInWithOtp({
    email:value,
    options:{emailRedirectTo:`${window.location.origin}/admin/stats`,shouldCreateUser:true}
  });
  if(error)throw error;
}

export async function signOutActivityAdmin(){
  const client=requireAdmin();
  const {error}=await client.auth.signOut();
  if(error)throw error;
}

export function watchActivityAdminAuth(callback){
  const client=requireAdmin();
  const {data}=client.auth.onAuthStateChange(()=>callback());
  return ()=>data.subscription.unsubscribe();
}

export async function loadActivityEvents({days=7,limit=1200}={}){
  const client=requireAdmin();
  const since=new Date(Date.now()-Math.max(1,Number(days)||7)*86400000).toISOString();
  const {data,error}=await client
    .from("atlas_activity_events")
    .select("id,created_at,session_id,event_name,path,label,meta")
    .gte("created_at",since)
    .order("created_at",{ascending:false})
    .limit(Math.min(2000,Math.max(100,Number(limit)||1200)));
  if(error)throw error;
  return data||[];
}
