import supabase from "./supabase";
import {databaseKindForGroup,decodeOpportunityText,encodeOpportunityText} from "./opportunityCodec";
export {opportunityGroups} from "./opportunityCodec";

function decodeOpportunity(row){if(!row)return row;return {...row,...decodeOpportunityText(row.text,row.kind)}}
function fail(message){const error=new Error(message);error.code=message;return error}
export async function ensureAtlasSession(){if(!supabase)throw fail("supabase-unavailable");const {data:sessionData,error:sessionError}=await supabase.auth.getSession();if(sessionError)throw sessionError;if(sessionData?.session?.user)return sessionData.session.user;const {data,error}=await supabase.auth.signInAnonymously();if(error)throw error;if(!data?.user)throw fail("anonymous-auth-unavailable");return data.user}
function slugBase(value){return String(value||"atlas").toLowerCase().normalize("NFKD").replace(/[^a-z0-9а-яіїєґ]+/gi,"-").replace(/^-+|-+$/g,"").slice(0,48)||"atlas"}
function createSlug(displayName){const suffix=crypto.randomUUID().replace(/-/g,"").slice(0,8);return `${slugBase(displayName)}-${suffix}`}
function expiresAtForDuration(duration){
  const date=new Date();
  if(duration==="hour")date.setHours(date.getHours()+1);
  else if(duration==="day")date.setDate(date.getDate()+1);
  else if(duration==="year")date.setFullYear(date.getFullYear()+1);
  else date.setDate(date.getDate()+30);
  return date.toISOString();
}
export async function loadAtlasAccounts(){
  await ensureAtlasSession();
  const {data,error}=await supabase.rpc("atlas_list_my_accounts");
  if(error)throw error;
  return data||[];
}
export async function registerAtlasAccount(login,password){
  await ensureAtlasSession();
  const {data,error}=await supabase.rpc("atlas_register_account",{p_login:String(login||"").trim(),p_password:String(password||"")});
  if(error)throw error;
  return (data||[])[0]||null;
}
export async function loginAtlasAccount(login,password){
  await ensureAtlasSession();
  const {data,error}=await supabase.rpc("atlas_login_account",{p_login:String(login||"").trim(),p_password:String(password||"")});
  if(error)throw error;
  return (data||[])[0]||null;
}
export async function forgetAtlasAccount(accountId){
  await ensureAtlasSession();
  const {error}=await supabase.rpc("atlas_forget_account",{p_account_id:accountId});
  if(error)throw error;
}
function clearAtlasLocalSession(){
  try{
    localStorage.removeItem("atlas-active-passport");
    localStorage.removeItem("atlas-city");
    for(let index=localStorage.length-1;index>=0;index--){
      const key=localStorage.key(index);
      if(key&&/^sb-.*-auth-token$/i.test(key))localStorage.removeItem(key);
    }
  }catch{}
  try{
    for(let index=sessionStorage.length-1;index>=0;index--){
      const key=sessionStorage.key(index);
      if(key&&/^sb-.*-auth-token$/i.test(key))sessionStorage.removeItem(key);
    }
  }catch{}
}

export async function logoutAtlasAccount(){
  clearAtlasLocalSession();
  if(!supabase)return;
  try{
    await Promise.race([
      supabase.auth.signOut({scope:"local"}),
      new Promise(resolve=>setTimeout(resolve,2200))
    ]);
  }catch{}
  clearAtlasLocalSession();
}
export async function loadMyPassports(){
  const user=await ensureAtlasSession();
  const accounts=await loadAtlasAccounts().catch(()=>[]);
  const accountIds=accounts.map(item=>item.account_id).filter(Boolean);
  const select="id,owner_id,account_id,slug,display_name,entity_type,profession,skills,city,created_at,updated_at";
  const rows=[];
  const ownerResult=await supabase.from("atlas_passports").select(select).eq("owner_id",user.id).order("updated_at",{ascending:false});
  if(ownerResult.error)throw ownerResult.error;
  rows.push(...(ownerResult.data||[]));
  if(accountIds.length){
    const accountResult=await supabase.from("atlas_passports").select(select).in("account_id",accountIds).order("updated_at",{ascending:false});
    if(accountResult.error)throw accountResult.error;
    rows.push(...(accountResult.data||[]));
  }
  const passports=[...new Map(rows.map(item=>[item.id,item])).values()].sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at));
  return {user,accounts,passports};
}
async function enrichRequests(rows){const requests=rows||[];const opportunityIds=[...new Set(requests.map(item=>item.opportunity_id).filter(Boolean))];if(!opportunityIds.length)return requests;const {data,error}=await supabase.from("atlas_opportunities").select("id,kind,text,photo_url,photo_label,photo_task").in("id",opportunityIds);if(error)return requests;const byId=new Map((data||[]).map(item=>[item.id,item]));return requests.map(item=>({...item,opportunity:decodeOpportunity(byId.get(item.opportunity_id)||null)}))}

export async function loadMyPassport(passportId=null){
  const {user,accounts,passports}=await loadMyPassports();
  let preferred=passportId;
  if(!preferred){try{preferred=localStorage.getItem("atlas-active-passport")||""}catch{}}
  let passport=passports.find(item=>item.id===preferred)||passports[0]||null;
  if(passport?.id){try{localStorage.setItem("atlas-active-passport",passport.id)}catch{}}
  let contact="",opportunities=[],needs=[];
  if(passport?.id){
    const [contactResult,opportunityResult,needResult]=await Promise.all([
      supabase.from("atlas_passport_contacts").select("contact").eq("passport_id",passport.id).maybeSingle(),
      supabase.from("atlas_opportunities").select("id,kind,text,is_active,visibility_scope,photo_url,photo_label,photo_task,created_at").eq("passport_id",passport.id).order("created_at",{ascending:false}),
      supabase.from("atlas_needs").select("id,group_key,item_key,quantity,unit,needed_from,needed_until,status,received_at,created_at,updated_at").eq("passport_id",passport.id).order("created_at",{ascending:false})
    ]);
    if(contactResult.error)throw contactResult.error;
    if(opportunityResult.error)throw opportunityResult.error;
    if(needResult.error)throw needResult.error;
    contact=contactResult.data?.contact||"";
    opportunities=(opportunityResult.data||[]).map(decodeOpportunity);
    needs=needResult.data||[];
  }
  return {user,accounts,passports,passport,contact,opportunities,needs};
}

export async function saveMyPassport({passportId=null,accountId=null,displayName,entityType="person",profession,skills,city,contact}){
  const user=await ensureAtlasSession();
  const cleanName=String(displayName||"").trim();
  const cleanEntityType=entityType==="company"?"company":"person";
  const cleanProfession=String(profession||"").trim().slice(0,240);
  const cleanSkills=String(skills||"").trim().slice(0,2000);
  const cleanCity=String(city||"").trim();
  const cleanContact=String(contact||"").trim();
  if(!cleanName)throw fail("display-name-required");
  if(!cleanContact)throw fail("contact-required");
  let passport;
  if(passportId){
    const {data,error}=await supabase.from("atlas_passports").update({
      display_name:cleanName,entity_type:cleanEntityType,profession:cleanProfession,skills:cleanSkills,city:cleanCity,updated_at:new Date().toISOString()
    }).eq("id",passportId).select("id,owner_id,account_id,slug,display_name,entity_type,profession,skills,city,created_at,updated_at").single();
    if(error)throw error;
    passport=data;
  }else{
    const {data,error}=await supabase.from("atlas_passports").insert({
      owner_id:user.id,
      account_id:accountId||null,
      slug:createSlug(cleanName),
      display_name:cleanName,
      entity_type:cleanEntityType,
      profession:cleanProfession,
      skills:cleanSkills,
      city:cleanCity
    }).select("id,owner_id,account_id,slug,display_name,entity_type,profession,skills,city,created_at,updated_at").single();
    if(error)throw error;
    passport=data;
  }
  const {error:contactError}=await supabase.from("atlas_passport_contacts").upsert({
    passport_id:passport.id,contact:cleanContact,updated_at:new Date().toISOString()
  },{onConflict:"passport_id"});
  if(contactError)throw contactError;
  try{localStorage.setItem("atlas-active-passport",passport.id)}catch{}
  return passport;
}

export async function uploadOpportunityPhoto(file){
  const user=await ensureAtlasSession();if(!file)throw fail("photo-required");
  const ext=(String(file.name||"").split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,5)||"jpg";
  const path=`${user.id}/${crypto.randomUUID()}.${ext}`;
  const {error}=await supabase.storage.from("opportunity-photos").upload(path,file,{cacheControl:"3600",upsert:false,contentType:file.type||"image/jpeg"});if(error)throw error;
  const {data}=supabase.storage.from("opportunity-photos").getPublicUrl(path);return {url:data.publicUrl,path};
}

export async function addMyOpportunity(passportId,entry){const user=await ensureAtlasSession();const cleanText=String(entry?.text||"").trim();if(!passportId)throw fail("passport-required");if(!cleanText)throw fail("opportunity-required");const {data,error}=await supabase.from("atlas_opportunities").insert({passport_id:passportId,owner_id:user.id,kind:databaseKindForGroup(entry?.group),text:encodeOpportunityText(entry),is_active:true,visibility_scope:["global","groups","both"].includes(entry?.visibilityScope)?entry.visibilityScope:"global",expires_at:expiresAtForDuration(entry?.duration),photo_url:entry?.photoUrl||null,photo_label:entry?.photoLabel||null,photo_task:entry?.photoTask||null}).select("id,kind,text,is_active,visibility_scope,photo_url,photo_label,photo_task,created_at").single();if(error)throw error;return decodeOpportunity(data)}
export async function updateMyOpportunity(id,entry){const user=await ensureAtlasSession();const cleanText=String(entry?.text||"").trim();if(!id||!cleanText)throw fail("opportunity-required");const {data,error}=await supabase.from("atlas_opportunities").update({kind:databaseKindForGroup(entry?.group),text:encodeOpportunityText(entry),photo_url:entry?.photo_url||entry?.photoUrl||null,photo_label:entry?.photo_label||entry?.photoLabel||null,photo_task:entry?.photo_task||entry?.photoTask||null}).eq("id",id).select("id,kind,text,is_active,visibility_scope,photo_url,photo_label,photo_task,created_at").single();if(error)throw error;return decodeOpportunity(data)}
export async function setMyOpportunityActive(id,isActive){await ensureAtlasSession();const {data,error}=await supabase.from("atlas_opportunities").update({is_active:Boolean(isActive)}).eq("id",id).select("id,kind,text,is_active,visibility_scope,photo_url,photo_label,photo_task,created_at").single();if(error)throw error;return decodeOpportunity(data)}
export async function setMyOpportunityCompleted(item,completed){
  await ensureAtlasSession();
  if(!item?.id)throw fail("opportunity-required");
  const updated={is_active:!completed,text:encodeOpportunityText({...item,completedAt:completed?new Date().toISOString():""})};
  if(!completed)updated.expires_at=expiresAtForDuration(item.duration);
  const {data,error}=await supabase.from("atlas_opportunities").update(updated).eq("id",item.id).select("id,kind,text,is_active,visibility_scope,photo_url,photo_label,photo_task,created_at").single();
  if(error)throw error;
  return decodeOpportunity(data);
}
export async function recordMyOpportunityFulfillment(item){
  await ensureAtlasSession();
  if(!item?.id||item.completedAt)throw fail("opportunity-required");
  const text=encodeOpportunityText({...item,fulfillmentCount:(Number(item.fulfillmentCount)||0)+1,lastFulfilledAt:new Date().toISOString()});
  const {data,error}=await supabase.from("atlas_opportunities").update({text}).eq("id",item.id).select("id,kind,text,is_active,visibility_scope,photo_url,photo_label,photo_task,created_at").single();
  if(error)throw error;
  return decodeOpportunity(data);
}
export async function deleteMyOpportunity(id){const user=await ensureAtlasSession();const {error}=await supabase.from("atlas_opportunities").delete().eq("id",id);if(error)throw error}

export async function addMyNeed(passportId,{groupKey,itemKey,unit,quantity,neededFrom,neededUntil}){const user=await ensureAtlasSession();const amount=Number(quantity);if(!passportId)throw fail("passport-required");if(!groupKey||!itemKey)throw fail("catalog-item-required");if(!Number.isFinite(amount)||amount<=0)throw fail("quantity-invalid");if(!neededFrom||!neededUntil||neededUntil<neededFrom)throw fail("date-range-invalid");const {data,error}=await supabase.from("atlas_needs").insert({passport_id:passportId,owner_id:user.id,group_key:String(groupKey),item_key:String(itemKey),quantity:amount,unit:String(unit||"шт").trim().slice(0,12),needed_from:neededFrom,needed_until:neededUntil,status:"not_received"}).select("id,group_key,item_key,quantity,unit,needed_from,needed_until,status,received_at,created_at,updated_at").single();if(error)throw error;return data}
export async function updateMyNeedStatus(id,status){const user=await ensureAtlasSession();const nextStatus=status==="received"?"received":"not_received";const now=new Date().toISOString();const {data,error}=await supabase.from("atlas_needs").update({status:nextStatus,received_at:nextStatus==="received"?now:null,updated_at:now}).eq("id",id).select("id,status,received_at,updated_at").single();if(error)throw error;return data}
export async function deleteMyNeed(id){const user=await ensureAtlasSession();const {error}=await supabase.from("atlas_needs").delete().eq("id",id);if(error)throw error}
export async function loadPublicPassport(slug){
  if(!supabase)throw fail("supabase-unavailable");
  const {data:passport,error:passportError}=await supabase.from("atlas_passports").select("id,owner_id,slug,display_name,entity_type,profession,skills,city,created_at").eq("slug",slug).maybeSingle();
  if(passportError)throw passportError;
  if(!passport)return {passport:null,opportunities:[]};
  const {data,error}=await supabase.from("atlas_opportunities").select("id,kind,text,visibility_scope,photo_url,photo_label,photo_task,created_at").eq("passport_id",passport.id).eq("is_active",true).in("visibility_scope",["global","both"]).order("created_at",{ascending:false});
  if(error)throw error;
  return {passport,opportunities:(data||[]).map(decodeOpportunity)};
}

export async function createPassportRequest(passport,opportunity,{message,requesterName=""}){
  await ensureAtlasSession();
  const cleanMessage=String(message||"").trim();
  const cleanName=String(requesterName||"").trim().slice(0,80);
  if(!passport?.id)throw fail("passport-required");
  if(!opportunity?.id)throw fail("opportunity-required");
  if(!cleanMessage)throw fail("message-required");
  const {data,error}=await supabase.rpc("atlas_create_passport_request",{
    p_passport_id:passport.id,
    p_opportunity_id:opportunity.id,
    p_requester_name:cleanName,
    p_message:cleanMessage
  });
  if(error)throw error;
  const created=(data||[])[0];
  if(!created)throw fail("request-not-created");
  return {...created,opportunity};
}

export async function loadMyRequestsForPassport(passportId){
  const user=await ensureAtlasSession();
  if(!passportId)return [];
  const {data,error}=await supabase.from("atlas_requests").select("id,passport_id,opportunity_id,requester_name,message,status,owner_contact,created_at,updated_at").eq("requester_id",user.id).eq("passport_id",passportId).order("created_at",{ascending:false});
  if(error)throw error;
  return enrichRequests(data||[]);
}

export async function loadIncomingRequests(passportId=null){
  await ensureAtlasSession();
  let query=supabase.from("atlas_requests").select("id,passport_id,opportunity_id,requester_name,message,status,created_at,updated_at").order("created_at",{ascending:false});
  if(passportId)query=query.eq("passport_id",passportId);
  const {data,error}=await query;
  if(error)throw error;
  return enrichRequests(data||[]);
}

export async function respondToPassportRequest(id,status,passportId=null){
  await ensureAtlasSession();
  const next=status==="accepted"?"accepted":"declined";
  let ownerContact=null;
  if(next==="accepted"){
    let resolvedPassportId=passportId;
    if(!resolvedPassportId){
      const {data:request,error:requestError}=await supabase.from("atlas_requests").select("passport_id").eq("id",id).single();
      if(requestError)throw requestError;
      resolvedPassportId=request?.passport_id;
    }
    const {data,error}=await supabase.from("atlas_passport_contacts").select("contact").eq("passport_id",resolvedPassportId).single();
    if(error)throw error;
    ownerContact=String(data?.contact||"").trim();
    if(!ownerContact)throw fail("contact-required");
  }
  const {data,error}=await supabase.from("atlas_requests").update({status:next,owner_contact:ownerContact,updated_at:new Date().toISOString()}).eq("id",id).select("id,passport_id,opportunity_id,requester_name,message,status,created_at,updated_at").single();
  if(error)throw error;
  return data;
}


export async function createAvailabilityCheck({passportId,opportunityId,requesterName="",message=""}){
  await ensureAtlasSession();
  const {data,error}=await supabase.rpc("atlas_create_availability_check",{
    p_passport_id:passportId,
    p_opportunity_id:opportunityId,
    p_requester_name:String(requesterName||"").trim().slice(0,80),
    p_message:String(message||"").trim()
  });
  if(error)throw error;
  const created=(data||[])[0];
  if(!created)throw fail("request-not-created");
  return created;
}
