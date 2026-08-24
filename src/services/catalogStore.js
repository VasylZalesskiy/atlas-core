import supabase from "./supabase";
import adminSupabase from "./adminSupabase";

function fail(message){
  const error=new Error(message);
  error.code=message;
  return error;
}

function cleanText(value,max=120){
  return String(value||"").trim().slice(0,max);
}

function cleanCode(value){
  return cleanText(value,64).toUpperCase().replace(/[^A-Z0-9-]/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"");
}

function makeKey(prefix){
  return `${prefix}-${crypto.randomUUID().replace(/-/g,"").slice(0,12)}`;
}

function requireAdminClient(){
  if(!adminSupabase)throw fail("supabase-unavailable");
  return adminSupabase;
}

export async function loadNeedCatalog(){
  if(!supabase)throw fail("supabase-unavailable");
  const [groupResult,itemResult]=await Promise.all([
    supabase.from("atlas_need_groups").select("group_key,name_uk,name_en,icon,is_active,sort_order,created_at,updated_at").order("sort_order",{ascending:true}).order("name_uk",{ascending:true}),
    supabase.from("atlas_need_items").select("group_key,item_key,name_uk,name_en,icon,unit,is_active,sort_order,canonical_code,family_code,created_at,updated_at").order("sort_order",{ascending:true}).order("name_uk",{ascending:true})
  ]);
  if(groupResult.error)throw groupResult.error;
  if(itemResult.error)throw itemResult.error;
  return {groups:groupResult.data||[],items:itemResult.data||[]};
}

export async function loadCatalogAdminState(){
  const client=requireAdminClient();
  const {data:userData,error:userError}=await client.auth.getUser();
  if(userError&&!/session.*missing/i.test(String(userError.message||"")))throw userError;
  const user=userData?.user||null;
  if(!user)return {user:null,isAdmin:false};

  const {data,error}=await client.from("atlas_catalog_admins").select("email_hash").maybeSingle();
  if(error)throw error;
  return {user,isAdmin:Boolean(data)};
}

export async function requestCatalogAdminLink(email){
  const client=requireAdminClient();
  const cleanEmail=cleanText(email,254).toLowerCase();
  if(!cleanEmail||!cleanEmail.includes("@"))throw fail("email-required");
  const {error}=await client.auth.signInWithOtp({
    email:cleanEmail,
    options:{emailRedirectTo:`${window.location.origin}/admin/catalog`,shouldCreateUser:true}
  });
  if(error)throw error;
}

export async function signOutCatalogAdmin(){
  const client=requireAdminClient();
  const {error}=await client.auth.signOut();
  if(error)throw error;
}

export function watchCatalogAdminAuth(callback){
  const client=requireAdminClient();
  const {data}=client.auth.onAuthStateChange(()=>callback());
  return ()=>data.subscription.unsubscribe();
}

export async function addCatalogGroup({nameUk,nameEn,icon,isActive,sortOrder}){
  const client=requireAdminClient();
  const payload={
    group_key:makeKey("group"),
    name_uk:cleanText(nameUk,80),
    name_en:cleanText(nameEn,80),
    icon:cleanText(icon,8)||"📦",
    is_active:Boolean(isActive),
    sort_order:Number.isFinite(Number(sortOrder))?Number(sortOrder):100
  };
  if(!payload.name_uk)throw fail("name-required");
  const {data,error}=await client.from("atlas_need_groups").insert(payload).select().single();
  if(error)throw error;
  return data;
}

export async function updateCatalogGroup(groupKey,{nameUk,nameEn,icon,isActive,sortOrder}){
  const client=requireAdminClient();
  const payload={
    name_uk:cleanText(nameUk,80),
    name_en:cleanText(nameEn,80),
    icon:cleanText(icon,8)||"📦",
    is_active:Boolean(isActive),
    sort_order:Number.isFinite(Number(sortOrder))?Number(sortOrder):100,
    updated_at:new Date().toISOString()
  };
  if(!payload.name_uk)throw fail("name-required");
  const {data,error}=await client.from("atlas_need_groups").update(payload).eq("group_key",groupKey).select().single();
  if(error)throw error;
  return data;
}

export async function deleteCatalogGroup(groupKey){
  const client=requireAdminClient();
  const {error}=await client.from("atlas_need_groups").delete().eq("group_key",groupKey);
  if(error)throw error;
}

export async function addCatalogItem({groupKey,nameUk,nameEn,icon,unit,isActive,sortOrder,canonicalCode,familyCode}){
  const client=requireAdminClient();
  const payload={
    group_key:groupKey,
    item_key:makeKey("item"),
    name_uk:cleanText(nameUk,80),
    name_en:cleanText(nameEn,80),
    icon:cleanText(icon,8)||"📦",
    unit:cleanText(unit,12)||"шт",
    is_active:Boolean(isActive),
    sort_order:Number.isFinite(Number(sortOrder))?Number(sortOrder):100,
    canonical_code:cleanCode(canonicalCode)||null,
    family_code:cleanCode(familyCode)||null
  };
  if(!payload.group_key)throw fail("group-required");
  if(!payload.name_uk)throw fail("name-required");
  const {data,error}=await client.from("atlas_need_items").insert(payload).select().single();
  if(error)throw error;
  return data;
}

export async function updateCatalogItem(groupKey,itemKey,{nameUk,nameEn,icon,unit,isActive,sortOrder,canonicalCode,familyCode}){
  const client=requireAdminClient();
  const payload={
    name_uk:cleanText(nameUk,80),
    name_en:cleanText(nameEn,80),
    icon:cleanText(icon,8)||"📦",
    unit:cleanText(unit,12)||"шт",
    is_active:Boolean(isActive),
    sort_order:Number.isFinite(Number(sortOrder))?Number(sortOrder):100,
    canonical_code:cleanCode(canonicalCode)||null,
    family_code:cleanCode(familyCode)||null,
    updated_at:new Date().toISOString()
  };
  if(!payload.name_uk)throw fail("name-required");
  const {data,error}=await client.from("atlas_need_items").update(payload).eq("group_key",groupKey).eq("item_key",itemKey).select().single();
  if(error)throw error;
  return data;
}

export async function deleteCatalogItem(groupKey,itemKey){
  const client=requireAdminClient();
  const {error}=await client.from("atlas_need_items").delete().eq("group_key",groupKey).eq("item_key",itemKey);
  if(error)throw error;
}
