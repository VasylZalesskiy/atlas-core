import supabase from "./supabase";
import adminSupabase from "./adminSupabase";
import {ensureAtlasSession} from "./passportStore";

export const TOMATO_PILOT_SLUG="building-170-tomatoes";
export const TOMATO_ORDER_STATUSES=["requested","ready","received","cancelled"];

function fail(message){
  const error=new Error(message);
  error.code=message;
  return error;
}

function requireClient(client=supabase){
  if(!client)throw fail("supabase-unavailable");
  return client;
}

function cleanName(value){return String(value||"").trim().replace(/\s+/g," ").slice(0,80)}

function withAvailability(pilot){
  if(!pilot)return null;
  const total=Number(pilot.total_kg)||0;
  const reserved=Number(pilot.reserved_kg)||0;
  const quantity=Number(pilot.kg_per_apartment)||5;
  const remaining=Math.max(0,total-reserved);
  return {
    ...pilot,
    total_kg:total,
    reserved_kg:reserved,
    received_kg:Number(pilot.received_kg)||0,
    kg_per_apartment:quantity,
    order_count:Number(pilot.order_count)||0,
    remaining_kg:remaining,
    remaining_apartments:quantity?Math.floor(remaining/quantity):0,
    pickup_slots:Array.isArray(pilot.pickup_slots)?pilot.pickup_slots:[]
  };
}

const pilotFields="slug,enabled,building_apartments,kg_per_apartment,total_kg,pickup_title_uk,pickup_title_en,pickup_details_uk,pickup_details_en,pickup_slots,reserved_kg,received_kg,order_count,updated_at";
const orderFields="id,pilot_slug,owner_id,customer_name,apartment_number,quantity_kg,pickup_slot,status,received_at,created_at,updated_at";

export async function loadTomatoPilot(){
  const client=requireClient();
  const pilotPromise=client.from("atlas_tomato_pilots").select(pilotFields).eq("slug",TOMATO_PILOT_SLUG).maybeSingle();
  const user=await ensureAtlasSession();
  const [pilotResult,orderResult]=await Promise.all([
    pilotPromise,
    client.from("atlas_tomato_orders").select(orderFields).eq("pilot_slug",TOMATO_PILOT_SLUG).eq("owner_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle()
  ]);
  if(pilotResult.error)throw pilotResult.error;
  if(orderResult.error)throw orderResult.error;
  if(!pilotResult.data)throw fail("tomato-pilot-not-found");
  return {pilot:withAvailability(pilotResult.data),order:orderResult.data||null,user};
}

export async function createTomatoOrder({customerName,apartmentNumber,pickupSlot}){
  const client=requireClient();
  const user=await ensureAtlasSession();
  const name=cleanName(customerName);
  const apartment=Number(apartmentNumber);
  const slot=String(pickupSlot||"").trim();
  if(name.length<2)throw fail("tomato-name-required");
  if(!Number.isInteger(apartment)||apartment<1||apartment>170)throw fail("tomato-apartment-invalid");
  if(!slot)throw fail("tomato-pickup-slot-invalid");

  const {data,error}=await client.from("atlas_tomato_orders").insert({
    pilot_slug:TOMATO_PILOT_SLUG,
    owner_id:user.id,
    customer_name:name,
    apartment_number:apartment,
    quantity_kg:5,
    pickup_slot:slot,
    status:"requested"
  }).select(orderFields).single();
  if(error)throw error;
  return data;
}

export async function cancelMyTomatoOrder(orderId){
  const client=requireClient();
  const user=await ensureAtlasSession();
  const {data,error}=await client.from("atlas_tomato_orders")
    .update({status:"cancelled"})
    .eq("id",orderId)
    .eq("owner_id",user.id)
    .select(orderFields)
    .single();
  if(error)throw error;
  return data;
}

export async function loadTomatoPilotAdmin(){
  const client=requireClient(adminSupabase);
  const [pilotResult,ordersResult]=await Promise.all([
    client.from("atlas_tomato_pilots").select(pilotFields).eq("slug",TOMATO_PILOT_SLUG).maybeSingle(),
    client.from("atlas_tomato_orders").select(orderFields).eq("pilot_slug",TOMATO_PILOT_SLUG).order("created_at",{ascending:true})
  ]);
  if(pilotResult.error)throw pilotResult.error;
  if(ordersResult.error)throw ordersResult.error;
  return {pilot:withAvailability(pilotResult.data),orders:ordersResult.data||[]};
}

export async function setTomatoPilotEnabled(enabled){
  const client=requireClient(adminSupabase);
  const {data,error}=await client.from("atlas_tomato_pilots")
    .update({enabled:Boolean(enabled)})
    .eq("slug",TOMATO_PILOT_SLUG)
    .select(pilotFields)
    .single();
  if(error)throw error;
  return withAvailability(data);
}

export async function updateTomatoOrderStatus(orderId,status){
  const client=requireClient(adminSupabase);
  if(!TOMATO_ORDER_STATUSES.includes(status))throw fail("tomato-status-invalid");
  const {data,error}=await client.from("atlas_tomato_orders")
    .update({status})
    .eq("id",orderId)
    .select(orderFields)
    .single();
  if(error)throw error;
  return data;
}

export function tomatoPilotErrorMessage(error,lang="uk"){
  const uk=lang!=="en";
  const text=String(error?.message||error?.code||error||"");
  if(/tomato-name-required/i.test(text))return uk?"Вкажіть ім’я (щонайменше 2 символи).":"Enter a name (at least 2 characters).";
  if(/tomato-apartment-invalid/i.test(text))return uk?"Вкажіть номер квартири від 1 до 170.":"Enter an apartment number from 1 to 170.";
  if(/tomato-pickup-slot-invalid/i.test(text))return uk?"Оберіть час видачі.":"Choose a pickup time.";
  if(/atlas_tomato_active_apartment_uidx/i.test(text))return uk?"Для цієї квартири вже є активна заявка.":"This apartment already has an active request.";
  if(/atlas_tomato_active_owner_uidx/i.test(text))return uk?"На цьому пристрої вже створено активну заявку.":"This device already has an active request.";
  if(/tomato-pilot-sold-out/i.test(text))return uk?"Усі 850 кг уже зарезервовано.":"All 850 kg have already been reserved.";
  if(/tomato-pilot-closed/i.test(text))return uk?"Прийом заявок тимчасово призупинено.":"Requests are temporarily paused.";
  if(/atlas_tomato_pilots|atlas_tomato_orders|tomato-pilot-not-found|relation .*does not exist/i.test(text))return uk?"Сценарій видачі ще активується. Спробуйте трохи пізніше.":"The pickup flow is still being activated. Try again shortly.";
  if(/supabase-unavailable/i.test(text))return uk?"Немає з’єднання зі сховищем заявок.":"The request storage is unavailable.";
  return uk?"Не вдалося зберегти заявку. Спробуйте ще раз.":"Could not save the request. Please try again.";
}
