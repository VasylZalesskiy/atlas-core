import supabase from "./supabase";
import {addMyOpportunity,deleteMyOpportunity,ensureAtlasSession,loadMyPassport} from "./passportStore";
import {decodeOpportunityText,opportunityGroups} from "./opportunityCodec";

function fail(message){const error=new Error(message);error.code=message;return error}
function clean(value){return String(value||"").replace(/\s+/g," ").trim()}

export {opportunityGroups};

export async function loadGroupIdentity(){
  await ensureAtlasSession();
  return loadMyPassport();
}

export async function loadMyGroups(){
  await ensureAtlasSession();
  const {data,error}=await supabase
    .from("atlas_groups")
    .select("id,name,group_type,description,city,invite_code,is_active,created_at,updated_at")
    .eq("is_active",true)
    .order("updated_at",{ascending:false});
  if(error)throw error;
  return data||[];
}

export async function createAtlasGroup({accountId,passportId,name,groupType="community",description="",city=""}){
  await ensureAtlasSession();
  if(!accountId)throw fail("account-required");
  if(!passportId)throw fail("passport-required");
  const {data,error}=await supabase.rpc("atlas_create_group",{
    p_account_id:accountId,
    p_passport_id:passportId,
    p_name:clean(name),
    p_group_type:groupType,
    p_description:clean(description),
    p_city:clean(city)
  });
  if(error)throw error;
  return (data||[])[0]||null;
}

export async function joinAtlasGroup({accountId,passportId,inviteCode}){
  await ensureAtlasSession();
  if(!accountId)throw fail("account-required");
  if(!passportId)throw fail("passport-required");
  const {data,error}=await supabase.rpc("atlas_join_group",{
    p_account_id:accountId,
    p_passport_id:passportId,
    p_invite_code:clean(inviteCode)
  });
  if(error)throw error;
  return (data||[])[0]||null;
}

export async function regenerateGroupInvite(groupId){
  await ensureAtlasSession();
  const {data,error}=await supabase.rpc("atlas_regenerate_group_invite",{p_group_id:groupId});
  if(error)throw error;
  return data||"";
}

export async function loadAtlasGroup(groupId){
  await ensureAtlasSession();
  if(!groupId)throw fail("group-required");

  const [groupResult,membersResult,linksResult]=await Promise.all([
    supabase
      .from("atlas_groups")
      .select("id,name,group_type,description,city,invite_code,is_active,created_at,updated_at")
      .eq("id",groupId)
      .single(),
    supabase
      .from("atlas_group_members")
      .select("group_id,account_id,passport_id,role,joined_at,passport:atlas_passports!atlas_group_members_passport_id_fkey(id,slug,display_name,entity_type,city)")
      .eq("group_id",groupId)
      .order("joined_at",{ascending:true}),
    supabase
      .from("atlas_group_opportunities")
      .select("group_id,opportunity_id,passport_id,added_by_account_id,created_at,opportunity:atlas_opportunities!atlas_group_opportunities_opportunity_id_fkey(id,kind,text,is_active,visibility_scope,expires_at,photo_url,photo_label,photo_task,created_at),passport:atlas_passports!atlas_group_opportunities_passport_id_fkey(id,slug,display_name,entity_type,city)")
      .eq("group_id",groupId)
      .order("created_at",{ascending:false})
  ]);

  if(groupResult.error)throw groupResult.error;
  if(membersResult.error)throw membersResult.error;
  if(linksResult.error)throw linksResult.error;

  const opportunities=(linksResult.data||[])
    .map(link=>({
      ...link,
      opportunity:link.opportunity?{...link.opportunity,...decodeOpportunityText(link.opportunity.text,link.opportunity.kind)}:null
    }))
    .filter(item=>item.opportunity&&item.opportunity.is_active!==false&&(!item.opportunity.expires_at||new Date(item.opportunity.expires_at)>new Date()));

  return {group:groupResult.data,members:membersResult.data||[],opportunities};
}

export async function addGroupOpportunity({groupId,accountId,passportId,text,group="have"}){
  await ensureAtlasSession();
  const cleanText=clean(text);
  if(!groupId)throw fail("group-required");
  if(!accountId)throw fail("account-required");
  if(!passportId)throw fail("passport-required");
  if(!cleanText)throw fail("opportunity-required");

  const opportunity=await addMyOpportunity(passportId,{
    text:cleanText,
    group,
    duration:"month",
    place:"",
    radiusValue:"",
    radiusUnit:"км",
    online:false,
    paymentType:group==="sell"?"paid":"free",
    priceValue:"",
    priceUnit:"шт.",
    currency:"UAH",
    saleQuantity:"",
    saleUnit:"кг",
    validUntil:"",
    catalogGroupKey:"",
    catalogItemKey:"",
    catalogItemName:"",
    minimumQuantity:"",
    deliveryIncluded:false
  });

  const {error}=await supabase.from("atlas_group_opportunities").insert({
    group_id:groupId,
    opportunity_id:opportunity.id,
    passport_id:passportId,
    added_by_account_id:accountId
  });

  if(error){
    await deleteMyOpportunity(opportunity.id).catch(()=>{});
    throw error;
  }
  return opportunity;
}

export async function removeOpportunityFromGroup(groupId,opportunityId){
  await ensureAtlasSession();
  const {error}=await supabase
    .from("atlas_group_opportunities")
    .delete()
    .eq("group_id",groupId)
    .eq("opportunity_id",opportunityId);
  if(error)throw error;
}

export async function leaveAtlasGroup(groupId,accountId){
  await ensureAtlasSession();
  const {error}=await supabase
    .from("atlas_group_members")
    .delete()
    .eq("group_id",groupId)
    .eq("account_id",accountId);
  if(error)throw error;
}


export async function setOpportunityVisibility({opportunityId,visibilityScope="global",groupIds=[]}){
  await ensureAtlasSession();
  const scope=["global","groups","both"].includes(visibilityScope)?visibilityScope:"global";
  const ids=Array.isArray(groupIds)?groupIds.filter(Boolean):[];
  const {data,error}=await supabase.rpc("atlas_set_opportunity_visibility",{
    p_opportunity_id:opportunityId,
    p_visibility_scope:scope,
    p_group_ids:ids
  });
  if(error)throw error;
  return (data||[])[0]||null;
}

export async function loadOpportunityGroupMap(opportunityIds=[]){
  await ensureAtlasSession();
  const ids=[...new Set((opportunityIds||[]).filter(Boolean))];
  if(!ids.length)return new Map();
  const {data,error}=await supabase
    .from("atlas_group_opportunities")
    .select("opportunity_id,group_id")
    .in("opportunity_id",ids);
  if(error)throw error;
  const map=new Map();
  for(const row of data||[]){
    if(!map.has(row.opportunity_id))map.set(row.opportunity_id,[]);
    map.get(row.opportunity_id).push(row.group_id);
  }
  return map;
}
