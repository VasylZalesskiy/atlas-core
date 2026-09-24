import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS"
};
const requestFields="id,passport_id,requester_passport_id,opportunity_id,need_id,owner_id,requester_id,requester_name,message,subject,request_kind,status,initiator_id,initiator_side,owner_contact,chat_hash,accepted_at,provided_at,completed_at,cancelled_at,created_at,updated_at,last_message_at";
const activeStatuses=["pending","accepted","provided"];

function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...corsHeaders,"Content-Type":"application/json"}})}
function randomHex(bytes:number){const value=crypto.getRandomValues(new Uint8Array(bytes));return Array.from(value,b=>b.toString(16).padStart(2,"0")).join("")}
function createChatHash(){const roomId=`ATLAS-${randomHex(4).toUpperCase()}`;const secret=randomHex(32).toUpperCase();const expiresAt=Date.now()+3600000;return `#chat-${roomId}-${secret}-${expiresAt}`}
function visibleOpportunityText(value:unknown){
  const raw=String(value||"");
  const marker=raw.indexOf("ATLAS_META:");
  const visible=marker>=0?raw.slice(0,marker):raw;
  return visible.replace(/[\u200B-\u200D\u2060\u2062\u2063\uFEFF]+$/gu,"").trim();
}

async function loadPassportAccess(admin:any,userClient:any,userId:string){
  const ids=new Set<string>();
  const {data:owned,error:ownedError}=await admin.from("atlas_passports").select("id").eq("owner_id",userId);
  if(ownedError)throw ownedError;
  for(const item of owned||[])ids.add(item.id);

  const {data:accounts,error:accountsError}=await userClient.rpc("atlas_list_my_accounts");
  if(accountsError)throw accountsError;
  const accountIds=[...new Set((accounts||[]).map((item:any)=>item.account_id).filter(Boolean))];
  if(accountIds.length){
    const {data:linked,error:linkedError}=await admin.from("atlas_passports").select("id").in("account_id",accountIds);
    if(linkedError)throw linkedError;
    for(const item of linked||[])ids.add(item.id);
  }
  return ids;
}

function viewerSide(flow:any,userId:string,passportIds:Set<string>){
  const provider=flow.owner_id===userId||passportIds.has(flow.passport_id);
  const needOwner=flow.requester_id===userId||(flow.requester_passport_id&&passportIds.has(flow.requester_passport_id));
  if(provider&&!needOwner)return "provider";
  if(needOwner&&!provider)return "need_owner";
  if(provider)return "provider";
  if(needOwner)return "need_owner";
  return null;
}

async function insertMessage(admin:any,flow:any,userId:string,side:string,body:string,createdAt:string){
  const text=String(body||"").trim().slice(0,2000);
  if(!text)throw new Error("message-required");
  const {data,error}=await admin.from("atlas_request_messages").insert({
    request_id:flow.id,
    sender_id:userId,
    sender_side:side,
    body:text,
    created_at:createdAt
  }).select("id,request_id,sender_id,sender_side,body,created_at,read_at").single();
  if(error)throw error;
  const {error:updateError}=await admin.from("atlas_requests").update({last_message_at:createdAt,updated_at:createdAt}).eq("id",flow.id);
  if(updateError)throw updateError;
  return data;
}

async function enrichFlows(admin:any,rows:any[],userId:string,passportIds:Set<string>){
  const visibleRows=rows.filter(flow=>viewerSide(flow,userId,passportIds));
  const requestIds=visibleRows.map(flow=>flow.id);
  const opportunityIds=[...new Set(visibleRows.map(flow=>flow.opportunity_id).filter(Boolean))];
  const needIds=[...new Set(visibleRows.map(flow=>flow.need_id).filter(Boolean))];
  const passportIdList=[...new Set(visibleRows.flatMap(flow=>[flow.passport_id,flow.requester_passport_id]).filter(Boolean))];
  let opportunities:any[]=[],needs:any[]=[],passports:any[]=[],messages:any[]=[];
  if(opportunityIds.length){const result=await admin.from("atlas_opportunities").select("id,text,kind").in("id",opportunityIds);if(result.error)throw result.error;opportunities=result.data||[]}
  if(needIds.length){const result=await admin.from("atlas_needs").select("id,passport_id,item_key,quantity,unit,status,needed_until").in("id",needIds);if(result.error)throw result.error;needs=result.data||[];passportIdList.push(...needs.map(need=>need.passport_id).filter(Boolean))}
  const uniquePassportIds=[...new Set(passportIdList)];
  if(uniquePassportIds.length){const result=await admin.from("atlas_passports").select("id,slug,display_name,city").in("id",uniquePassportIds);if(result.error)throw result.error;passports=result.data||[]}
  if(requestIds.length){const result=await admin.from("atlas_request_messages").select("id,request_id,sender_id,sender_side,body,created_at,read_at").in("request_id",requestIds).order("created_at",{ascending:true});if(result.error)throw result.error;messages=result.data||[]}

  const opportunityMap=new Map(opportunities.map(item=>[item.id,item]));
  const needMap=new Map(needs.map(item=>[item.id,item]));
  const passportMap=new Map(passports.map(item=>[item.id,item]));
  const messagesByRequest=new Map<string,any[]>();
  for(const message of messages){if(!messagesByRequest.has(message.request_id))messagesByRequest.set(message.request_id,[]);messagesByRequest.get(message.request_id)!.push(message)}

  return visibleRows.map(flow=>{
    const side=viewerSide(flow,userId,passportIds)!;
    const threadMessages=messagesByRequest.get(flow.id)||[];
    const need=needMap.get(flow.need_id)||null;
    const providerPassport=passportMap.get(flow.passport_id)||null;
    const requesterPassport=passportMap.get(flow.requester_passport_id)|| (need?passportMap.get(need.passport_id)||null:null);
    return {
      ...flow,
      viewer_side:side,
      role:side,
      is_initiator:(flow.initiator_side||((flow.initiator_id||flow.requester_id)===flow.owner_id?"provider":"need_owner"))===side,
      opportunity:opportunityMap.get(flow.opportunity_id)||null,
      need,
      provider_passport:providerPassport,
      need_passport:requesterPassport,
      counterpart:side==="provider"?requesterPassport:providerPassport,
      unread_count:threadMessages.filter(message=>message.sender_side!==side&&!message.read_at).length,
      last_message:threadMessages.at(-1)||null
    };
  }).sort((a,b)=>new Date(b.last_message_at||b.updated_at||b.created_at).getTime()-new Date(a.last_message_at||a.updated_at||a.created_at).getTime());
}

Deno.serve(async request=>{
  if(request.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(request.method!=="POST")return json({error:"method-not-allowed"},405);
  try{
    const token=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();
    if(!token)return json({error:"unauthorized"},401);
    const url=Deno.env.get("SUPABASE_URL")!;
    const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey=Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const userClient=createClient(url,anonKey,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:userData,error:userError}=await admin.auth.getUser(token);
    const user=userData?.user;
    if(userError||!user)return json({error:"unauthorized"},401);

    const body=await request.json().catch(()=>({}));
    const action=String(body?.action||"").trim();
    const now=new Date().toISOString();
    const passportIds=await loadPassportAccess(admin,userClient,user.id);

    if(action==="list"){
      const filters=[`owner_id.eq.${user.id}`,`requester_id.eq.${user.id}`];
      if(passportIds.size){const list=[...passportIds].join(",");filters.push(`passport_id.in.(${list})`,`requester_passport_id.in.(${list})`)}
      const {data,error}=await admin.from("atlas_requests").select(requestFields).or(filters.join(",")).order("last_message_at",{ascending:false}).limit(150);
      if(error)throw error;
      return json({flows:await enrichFlows(admin,data||[],user.id,passportIds)});
    }

    if(action==="thread"){
      const requestId=String(body?.requestId||"").trim();
      const {data:flow,error}=await admin.from("atlas_requests").select(requestFields).eq("id",requestId).maybeSingle();
      if(error)throw error;
      if(!flow||!viewerSide(flow,user.id,passportIds))return json({error:"forbidden"},403);
      const [enriched]=await enrichFlows(admin,[flow],user.id,passportIds);
      const {data:messages,error:messageError}=await admin.from("atlas_request_messages").select("id,request_id,sender_id,sender_side,body,created_at,read_at").eq("request_id",requestId).order("created_at",{ascending:true});
      if(messageError)throw messageError;
      return json({flow:enriched,messages:messages||[]});
    }

    if(action==="passport_request"){
      const passportId=String(body?.passportId||"").trim();
      const requesterPassportId=String(body?.requesterPassportId||"").trim()||null;
      const message=String(body?.message||"").trim().slice(0,1000);
      const subject=String(body?.subject||"").trim().slice(0,240);
      if(!passportId)return json({error:"passport-required"},400);
      if(!message)return json({error:"message-required"},400);
      if(passportIds.has(passportId))return json({error:"own-passport-request"},400);
      if(requesterPassportId&&!passportIds.has(requesterPassportId))return json({error:"requester-passport-forbidden"},403);
      const {data:passport,error:passportError}=await admin.from("atlas_passports").select("id,owner_id,display_name").eq("id",passportId).maybeSingle();
      if(passportError)throw passportError;
      if(!passport)return json({error:"passport-not-found"},404);
      let duplicateQuery=admin.from("atlas_requests").select(requestFields).eq("passport_id",passport.id).is("opportunity_id",null).eq("request_kind","passport_message").in("status",activeStatuses);
      if(requesterPassportId)duplicateQuery=duplicateQuery.eq("requester_passport_id",requesterPassportId);else duplicateQuery=duplicateQuery.eq("requester_id",user.id);
      const {data:existing}=await duplicateQuery.order("created_at",{ascending:false}).limit(1).maybeSingle();
      if(existing)return json({request:existing,duplicate:true});
      const {data:requestRow,error}=await admin.from("atlas_requests").insert({
        passport_id:passport.id,
        requester_passport_id:requesterPassportId,
        opportunity_id:null,
        need_id:null,
        owner_id:passport.owner_id,
        requester_id:user.id,
        requester_name:"",
        message,
        subject:subject||`Розмова з ${passport.display_name}`,
        request_kind:"passport_message",
        status:"pending",
        initiator_id:user.id,
        initiator_side:"need_owner",
        last_message_at:now
      }).select(requestFields).single();
      if(error)throw error;
      await insertMessage(admin,requestRow,user.id,"need_owner",message,now);
      return json({request:requestRow});
    }

    if(action==="request"){
      const opportunityId=String(body?.opportunityId||"").trim();
      const needId=String(body?.needId||"").trim()||null;
      const requestedPassportId=String(body?.requesterPassportId||"").trim()||null;
      const message=String(body?.message||"").trim().slice(0,1000);
      if(!opportunityId)return json({error:"opportunity-required"},400);
      const {data:opportunity,error:opportunityError}=await admin.from("atlas_opportunities").select("id,passport_id,owner_id,text,is_active").eq("id",opportunityId).eq("is_active",true).maybeSingle();
      if(opportunityError)throw opportunityError;
      if(!opportunity)return json({error:"opportunity-not-found"},404);
      if(passportIds.has(opportunity.passport_id)||opportunity.owner_id===user.id)return json({error:"own-opportunity"},400);
      let need:any=null;
      if(needId){const result=await admin.from("atlas_needs").select("id,passport_id,owner_id,item_key,quantity,unit,status,needed_until").eq("id",needId).eq("status","not_received").maybeSingle();if(result.error)throw result.error;if(!result.data||!passportIds.has(result.data.passport_id))return json({error:"need-not-found"},404);need=result.data}
      const requesterPassportId=need?.passport_id||(requestedPassportId&&passportIds.has(requestedPassportId)?requestedPassportId:null);
      const visibleText=visibleOpportunityText(opportunity.text);
      const finalMessage=(message||`Atlas знайшов збіг. Мене цікавить ваша можливість: ${visibleText}`).slice(0,1000);
      let duplicateQuery=admin.from("atlas_requests").select(requestFields).eq("opportunity_id",opportunity.id).in("status",activeStatuses);
      if(needId)duplicateQuery=duplicateQuery.eq("need_id",needId);else if(requesterPassportId)duplicateQuery=duplicateQuery.eq("requester_passport_id",requesterPassportId);else duplicateQuery=duplicateQuery.eq("requester_id",user.id).is("need_id",null);
      const {data:existing}=await duplicateQuery.order("created_at",{ascending:false}).limit(1).maybeSingle();
      if(existing)return json({request:existing,duplicate:true});
      const {data:requestRow,error}=await admin.from("atlas_requests").insert({
        passport_id:opportunity.passport_id,
        requester_passport_id:requesterPassportId,
        opportunity_id:opportunity.id,
        need_id:needId,
        owner_id:opportunity.owner_id,
        requester_id:user.id,
        requester_name:"",
        message:finalMessage,
        subject:String(body?.subject||visibleText).slice(0,240),
        request_kind:"opportunity",
        status:"pending",
        initiator_id:user.id,
        initiator_side:"need_owner",
        last_message_at:now
      }).select(requestFields).single();
      if(error)throw error;
      await insertMessage(admin,requestRow,user.id,"need_owner",finalMessage,now);
      return json({request:requestRow});
    }

    if(action==="offer"){
      const opportunityId=String(body?.opportunityId||"").trim();
      const needId=String(body?.needId||"").trim();
      if(!opportunityId||!needId)return json({error:"match-required"},400);
      const {data:opportunity,error:opportunityError}=await admin.from("atlas_opportunities").select("id,passport_id,owner_id,text,is_active").eq("id",opportunityId).eq("is_active",true).maybeSingle();
      if(opportunityError)throw opportunityError;
      if(!opportunity||!passportIds.has(opportunity.passport_id))return json({error:"opportunity-not-found"},404);
      const today=new Date().toISOString().slice(0,10);
      const {data:need,error:needError}=await admin.from("atlas_needs").select("id,passport_id,owner_id,item_key,quantity,unit,status,needed_until").eq("id",needId).eq("status","not_received").gte("needed_until",today).maybeSingle();
      if(needError)throw needError;
      if(!need)return json({error:"need-not-found"},404);
      if(passportIds.has(need.passport_id))return json({error:"own-need"},400);
      const {data:existing}=await admin.from("atlas_requests").select(requestFields).eq("opportunity_id",opportunity.id).eq("need_id",need.id).in("status",activeStatuses).order("created_at",{ascending:false}).limit(1).maybeSingle();
      if(existing)return json({request:existing,duplicate:true});
      const message=`Atlas знайшов збіг. Я можу допомогти з вашою потребою: ${visibleOpportunityText(opportunity.text)}`.slice(0,1000);
      const {data:requestRow,error}=await admin.from("atlas_requests").insert({
        passport_id:opportunity.passport_id,
        requester_passport_id:need.passport_id,
        opportunity_id:opportunity.id,
        need_id:need.id,
        owner_id:opportunity.owner_id,
        requester_id:need.owner_id,
        requester_name:"",
        message,
        subject:visibleOpportunityText(opportunity.text).slice(0,240),
        request_kind:"opportunity",
        status:"pending",
        initiator_id:user.id,
        initiator_side:"provider",
        last_message_at:now
      }).select(requestFields).single();
      if(error)throw error;
      await insertMessage(admin,requestRow,user.id,"provider",message,now);
      return json({request:requestRow});
    }

    const requestId=String(body?.requestId||"").trim();
    if(!requestId)return json({error:"request-required"},400);
    const {data:flow,error:flowError}=await admin.from("atlas_requests").select(requestFields).eq("id",requestId).maybeSingle();
    if(flowError)throw flowError;
    if(!flow)return json({error:"request-not-found"},404);
    const side=viewerSide(flow,user.id,passportIds);
    if(!side)return json({error:"forbidden"},403);

    if(action==="message"){
      if(!activeStatuses.includes(flow.status))return json({error:"conversation-closed"},409);
      const message=await insertMessage(admin,flow,user.id,side,String(body?.message||""),now);
      return json({message});
    }
    if(action==="mark_read"){
      const {error}=await admin.from("atlas_request_messages").update({read_at:now}).eq("request_id",flow.id).neq("sender_side",side).is("read_at",null);
      if(error)throw error;
      return json({ok:true});
    }
    if(action==="respond"){
      if(flow.status!=="pending")return json({error:"request-not-pending"},409);
      const initiatorSide=flow.initiator_side||((flow.initiator_id||flow.requester_id)===flow.owner_id?"provider":"need_owner");
      if(side===initiatorSide)return json({error:"only-recipient-can-respond"},403);
      const decision=body?.decision==="accepted"?"accepted":"declined";
      let ownerContact:null|string=null,chatHash:null|string=null;
      if(decision==="accepted"){
        const {data:contact}=await admin.from("atlas_passport_contacts").select("contact").eq("passport_id",flow.passport_id).maybeSingle();
        ownerContact=String(contact?.contact||"").trim()||null;
        chatHash=createChatHash();
      }
      const payload=decision==="accepted"?{status:"accepted",owner_contact:ownerContact,chat_hash:chatHash,accepted_at:now,updated_at:now}:{status:"declined",updated_at:now};
      const {data,error}=await admin.from("atlas_requests").update(payload).eq("id",flow.id).select(requestFields).single();
      if(error)throw error;
      return json({request:data});
    }
    if(action==="provided"){
      if(side!=="provider")return json({error:"only-provider-can-mark-provided"},403);
      if(!["accepted","provided"].includes(flow.status))return json({error:"request-not-active"},409);
      const {data,error}=await admin.from("atlas_requests").update({status:"provided",provided_at:flow.provided_at||now,updated_at:now}).eq("id",flow.id).select(requestFields).single();
      if(error)throw error;
      return json({request:data});
    }
    if(action==="complete"){
      if(side!=="need_owner")return json({error:"only-need-owner-can-complete"},403);
      if(!["accepted","provided","completed"].includes(flow.status))return json({error:"request-not-active"},409);
      const {data,error}=await admin.from("atlas_requests").update({status:"completed",completed_at:flow.completed_at||now,updated_at:now}).eq("id",flow.id).select(requestFields).single();
      if(error)throw error;
      if(flow.need_id)await admin.from("atlas_needs").update({status:"received",received_at:now,updated_at:now}).eq("id",flow.need_id);
      return json({request:data});
    }
    if(action==="cancel"){
      if(["completed","declined","cancelled"].includes(flow.status))return json({error:"request-closed"},409);
      const {data,error}=await admin.from("atlas_requests").update({status:"cancelled",cancelled_at:now,updated_at:now}).eq("id",flow.id).select(requestFields).single();
      if(error)throw error;
      return json({request:data});
    }
    return json({error:"unknown-action"},400);
  }catch(error){
    console.error("atlas-solution-flow",error);
    return json({error:error instanceof Error?error.message:"solution-flow-failed"},500);
  }
});
