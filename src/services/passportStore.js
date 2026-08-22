import supabase from "./supabase";
import {databaseKindForGroup,decodeOpportunityText,encodeOpportunityText} from "./opportunityCodec";
export {opportunityGroups} from "./opportunityCodec";

function decodeOpportunity(row){
  if(!row)return row;
  return {...row,...decodeOpportunityText(row.text,row.kind)};
}

function fail(message){
  const error=new Error(message);
  error.code=message;
  return error;
}

export async function ensureAtlasSession(){
  if(!supabase)throw fail("supabase-unavailable");
  const {data:sessionData,error:sessionError}=await supabase.auth.getSession();
  if(sessionError)throw sessionError;
  if(sessionData?.session?.user)return sessionData.session.user;

  const {data,error}=await supabase.auth.signInAnonymously();
  if(error)throw error;
  if(!data?.user)throw fail("anonymous-auth-unavailable");
  return data.user;
}

function slugBase(value){
  return String(value||"atlas")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9а-яіїєґ]+/gi,"-")
    .replace(/^-+|-+$/g,"")
    .slice(0,48)||"atlas";
}

function createSlug(displayName,userId){
  const suffix=String(userId||crypto.randomUUID()).replace(/-/g,"").slice(0,8);
  return `${slugBase(displayName)}-${suffix}`;
}

async function enrichRequests(rows){
  const requests=rows||[];
  const opportunityIds=[...new Set(requests.map(item=>item.opportunity_id).filter(Boolean))];
  if(!opportunityIds.length)return requests;

  const {data,error}=await supabase
    .from("atlas_opportunities")
    .select("id,kind,text")
    .in("id",opportunityIds);
  if(error)return requests;

  const byId=new Map((data||[]).map(item=>[item.id,item]));
  return requests.map(item=>({...item,opportunity:decodeOpportunity(byId.get(item.opportunity_id)||null)}));
}

export async function loadMyPassport(){
  const user=await ensureAtlasSession();

  const {data:passport,error:passportError}=await supabase
    .from("atlas_passports")
    .select("id,slug,display_name,profession,skills,city,created_at,updated_at")
    .eq("owner_id",user.id)
    .maybeSingle();
  if(passportError)throw passportError;

  const {data:privateRow,error:privateError}=await supabase
    .from("atlas_private_contacts")
    .select("contact")
    .eq("owner_id",user.id)
    .maybeSingle();
  if(privateError)throw privateError;

  let opportunities=[];
  let needs=[];
  if(passport?.id){
    const [opportunityResult,needResult]=await Promise.all([
      supabase
        .from("atlas_opportunities")
        .select("id,kind,text,is_active,created_at")
        .eq("passport_id",passport.id)
        .eq("owner_id",user.id)
        .order("created_at",{ascending:false}),
      supabase
        .from("atlas_needs")
        .select("id,group_key,item_key,quantity,unit,needed_from,needed_until,status,received_at,created_at,updated_at")
        .eq("passport_id",passport.id)
        .eq("owner_id",user.id)
        .order("created_at",{ascending:false})
    ]);
    if(opportunityResult.error)throw opportunityResult.error;
    if(needResult.error)throw needResult.error;
    opportunities=(opportunityResult.data||[]).map(decodeOpportunity);
    needs=needResult.data||[];
  }

  return {user,passport:passport||null,contact:privateRow?.contact||"",opportunities,needs};
}

export async function saveMyPassport({displayName,profession,skills,city,contact}){
  const user=await ensureAtlasSession();
  const cleanName=String(displayName||"").trim();
  const cleanProfession=String(profession||"").trim().slice(0,240);
  const cleanSkills=String(skills||"").trim().slice(0,2000);
  const cleanCity=String(city||"").trim();
  const cleanContact=String(contact||"").trim();
  if(!cleanName)throw fail("display-name-required");
  if(!cleanContact)throw fail("contact-required");

  const {data:existing,error:existingError}=await supabase
    .from("atlas_passports")
    .select("id,slug")
    .eq("owner_id",user.id)
    .maybeSingle();
  if(existingError)throw existingError;

  let passport;
  if(existing?.id){
    const {data,error}=await supabase
      .from("atlas_passports")
      .update({display_name:cleanName,profession:cleanProfession,skills:cleanSkills,city:cleanCity,updated_at:new Date().toISOString()})
      .eq("id",existing.id)
      .eq("owner_id",user.id)
      .select("id,slug,display_name,profession,skills,city,created_at,updated_at")
      .single();
    if(error)throw error;
    passport=data;
  }else{
    const {data,error}=await supabase
      .from("atlas_passports")
      .insert({
        owner_id:user.id,
        slug:createSlug(cleanName,user.id),
        display_name:cleanName,
        profession:cleanProfession,
        skills:cleanSkills,
        city:cleanCity
      })
      .select("id,slug,display_name,profession,skills,city,created_at,updated_at")
      .single();
    if(error)throw error;
    passport=data;
  }

  const {error:contactError}=await supabase
    .from("atlas_private_contacts")
    .upsert({owner_id:user.id,contact:cleanContact,updated_at:new Date().toISOString()},{onConflict:"owner_id"});
  if(contactError)throw contactError;

  return passport;
}

export async function addMyOpportunity(passportId,entry){
  const user=await ensureAtlasSession();
  const cleanText=String(entry?.text||"").trim();
  if(!passportId)throw fail("passport-required");
  if(!cleanText)throw fail("opportunity-required");

  const {data,error}=await supabase
    .from("atlas_opportunities")
    .insert({
      passport_id:passportId,
      owner_id:user.id,
      kind:databaseKindForGroup(entry?.group),
      text:encodeOpportunityText(entry),
      is_active:true
    })
    .select("id,kind,text,is_active,created_at")
    .single();
  if(error)throw error;
  return decodeOpportunity(data);
}

export async function updateMyOpportunity(id,entry){
  const user=await ensureAtlasSession();
  const cleanText=String(entry?.text||"").trim();
  if(!id)throw fail("opportunity-required");
  if(!cleanText)throw fail("opportunity-required");

  const {data,error}=await supabase
    .from("atlas_opportunities")
    .update({kind:databaseKindForGroup(entry?.group),text:encodeOpportunityText(entry)})
    .eq("id",id)
    .eq("owner_id",user.id)
    .select("id,kind,text,is_active,created_at")
    .single();
  if(error)throw error;
  return decodeOpportunity(data);
}

export async function setMyOpportunityActive(id,isActive){
  const user=await ensureAtlasSession();
  const {data,error}=await supabase
    .from("atlas_opportunities")
    .update({is_active:Boolean(isActive)})
    .eq("id",id)
    .eq("owner_id",user.id)
    .select("id,kind,text,is_active,created_at")
    .single();
  if(error)throw error;
  return decodeOpportunity(data);
}

export async function deleteMyOpportunity(id){
  const user=await ensureAtlasSession();
  const {error}=await supabase
    .from("atlas_opportunities")
    .delete()
    .eq("id",id)
    .eq("owner_id",user.id);
  if(error)throw error;
}

export async function addMyNeed(passportId,{groupKey,itemKey,unit,quantity,neededFrom,neededUntil}){
  const user=await ensureAtlasSession();
  const amount=Number(quantity);
  if(!passportId)throw fail("passport-required");
  if(!Number.isFinite(amount)||amount<=0)throw fail("quantity-invalid");
  if(!neededFrom||!neededUntil||neededUntil<neededFrom)throw fail("date-range-invalid");

  const {data,error}=await supabase
    .from("atlas_needs")
    .insert({
      passport_id:passportId,
      owner_id:user.id,
      group_key:String(groupKey||"vegetables"),
      item_key:String(itemKey||"tomatoes"),
      quantity:amount,
      unit:String(unit||"шт").trim().slice(0,12),
      needed_from:neededFrom,
      needed_until:neededUntil,
      status:"not_received"
    })
    .select("id,group_key,item_key,quantity,unit,needed_from,needed_until,status,received_at,created_at,updated_at")
    .single();
  if(error)throw error;
  return data;
}

export async function updateMyNeedStatus(id,status){
  const user=await ensureAtlasSession();
  const nextStatus=status==="received"?"received":"not_received";
  const now=new Date().toISOString();
  const {data,error}=await supabase
    .from("atlas_needs")
    .update({status:nextStatus,received_at:nextStatus==="received"?now:null,updated_at:now})
    .eq("id",id)
    .eq("owner_id",user.id)
    .select("id,status,received_at,updated_at")
    .single();
  if(error)throw error;
  return data;
}

export async function deleteMyNeed(id){
  const user=await ensureAtlasSession();
  const {error}=await supabase
    .from("atlas_needs")
    .delete()
    .eq("id",id)
    .eq("owner_id",user.id);
  if(error)throw error;
}

export async function loadPublicPassport(slug){
  if(!supabase)throw fail("supabase-unavailable");
  const {data:passport,error:passportError}=await supabase
    .from("atlas_passports")
    .select("id,owner_id,slug,display_name,profession,skills,city,created_at")
    .eq("slug",slug)
    .maybeSingle();
  if(passportError)throw passportError;
  if(!passport)return {passport:null,opportunities:[]};

  const {data,error}=await supabase
    .from("atlas_opportunities")
    .select("id,kind,text,created_at")
    .eq("passport_id",passport.id)
    .eq("is_active",true)
    .order("created_at",{ascending:false});
  if(error)throw error;
  return {passport,opportunities:(data||[]).map(decodeOpportunity)};
}

export async function createPassportRequest(passport,opportunity,{message,requesterName=""}){
  const user=await ensureAtlasSession();
  const cleanMessage=String(message||"").trim();
  const cleanName=String(requesterName||"").trim().slice(0,80);
  if(!passport?.id||!passport?.owner_id)throw fail("passport-required");
  if(!opportunity?.id)throw fail("opportunity-required");
  if(!cleanMessage)throw fail("message-required");
  if(user.id===passport.owner_id)throw fail("own-passport-request");

  const {data,error}=await supabase
    .from("atlas_requests")
    .insert({
      passport_id:passport.id,
      opportunity_id:opportunity.id,
      owner_id:passport.owner_id,
      requester_id:user.id,
      requester_name:cleanName,
      message:cleanMessage,
      status:"pending"
    })
    .select("id,passport_id,opportunity_id,requester_name,message,status,owner_contact,created_at,updated_at")
    .single();
  if(error)throw error;
  return {...data,opportunity};
}

export async function loadMyRequestsForPassport(passportId){
  const user=await ensureAtlasSession();
  if(!passportId)return [];
  const {data,error}=await supabase
    .from("atlas_requests")
    .select("id,passport_id,opportunity_id,requester_name,message,status,owner_contact,created_at,updated_at")
    .eq("requester_id",user.id)
    .eq("passport_id",passportId)
    .order("created_at",{ascending:false});
  if(error)throw error;
  return enrichRequests(data||[]);
}

export async function loadIncomingRequests(){
  const user=await ensureAtlasSession();
  const {data,error}=await supabase
    .from("atlas_requests")
    .select("id,passport_id,opportunity_id,requester_name,message,status,created_at,updated_at")
    .eq("owner_id",user.id)
    .order("created_at",{ascending:false});
  if(error)throw error;
  return enrichRequests(data||[]);
}

export async function respondToPassportRequest(id,status){
  const user=await ensureAtlasSession();
  const nextStatus=status==="accepted"?"accepted":"declined";
  let ownerContact=null;

  if(nextStatus==="accepted"){
    const {data,error}=await supabase
      .from("atlas_private_contacts")
      .select("contact")
      .eq("owner_id",user.id)
      .single();
    if(error)throw error;
    ownerContact=String(data?.contact||"").trim();
    if(!ownerContact)throw fail("contact-required");
  }

  const {data,error}=await supabase
    .from("atlas_requests")
    .update({status:nextStatus,owner_contact:ownerContact,updated_at:new Date().toISOString()})
    .eq("id",id)
    .eq("owner_id",user.id)
    .select("id,passport_id,opportunity_id,requester_name,message,status,created_at,updated_at")
    .single();
  if(error)throw error;
  return data;
}
