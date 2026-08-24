import {loadNeedCatalog} from "./catalogStore";
import {getOviOffers} from "./oviOfferStore";

const STOP_WORDS=new Set([
  "потрібно","потрібен","потрібна","потрібні","треба","хочу","шукаю","знайти","купити","придбати","замовити",
  "мені","для","та","і","у","в","на","по","до","від","кг","кілограм","кілограмів","тонна","тонни","тонн","т",
  "need","needed","want","find","buy","order","for","with","kg","kilogram","kilograms","ton","tons","tonne","tonnes"
]);

function clean(value){return String(value||"").toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu," ").replace(/\s+/g," ").trim()}
function stem(word){return word.length>5?word.slice(0,5):word}
function words(value){return clean(value).split(" ").filter(word=>word.length>2&&!STOP_WORDS.has(word)&&!/^[0-9]+(?:[.,][0-9]+)?$/.test(word)).map(stem)}

function scoreItem(taskTokens,item){
  const itemTokens=new Set(words(`${item.name_uk||""} ${item.name_en||""}`));
  if(!itemTokens.size)return 0;
  return taskTokens.reduce((score,token)=>score+(itemTokens.has(token)?1:0),0);
}

function parseNumber(raw){
  const normalized=String(raw||"").replace(/\s+/g,"").replace(",",".");
  const value=Number(normalized);
  return Number.isFinite(value)&&value>0?value:0;
}

function requestedQuantity(task,targetUnit){
  const text=clean(task);
  const match=text.match(/(\d+(?:[\s.]\d{3})*(?:[.,]\d+)?)\s*(кг|kg|кілограм(?:ів|и|а)?|т|тонн(?:а|и|у)?|tonnes?|tons?|шт|штук(?:а|и)?|pcs?|pieces?)/iu);
  if(!match)return 0;
  const value=parseNumber(match[1]);
  if(!value)return 0;
  const sourceUnit=String(match[2]||"").toLowerCase();
  if(targetUnit==="кг"){
    if(/^(т|тонн|ton)/iu.test(sourceUnit))return value*1000;
    if(/^(кг|kg|кілограм)/iu.test(sourceUnit))return value;
  }
  if(targetUnit==="т"){
    if(/^(кг|kg|кілограм)/iu.test(sourceUnit))return value/1000;
    if(/^(т|тонн|ton)/iu.test(sourceUnit))return value;
  }
  if(targetUnit==="шт"&&/^(шт|штук|pcs?|pieces?)/iu.test(sourceUnit))return value;
  return value;
}

function oviResult(item,provider,lang){
  const uk=lang!=="en";
  const enough=Boolean(item.can_fulfill_from_stock);
  const available=Number(item.available_qty||0);
  const requested=Number(item.requested_qty||0);
  const hasRequestedQuantity=requested>0;
  const stockText=hasRequestedQuantity
    ?`${available.toLocaleString(uk?"uk-UA":"en-GB")} ${item.unit} / ${requested.toLocaleString(uk?"uk-UA":"en-GB")} ${item.unit}`
    :`${available.toLocaleString(uk?"uk-UA":"en-GB")} ${item.unit}`;
  return {
    title:item.name,
    snippet:enough
      ?(uk?`OVI має достатній поточний залишок: ${stockText}.`:`OVI has enough current stock: ${stockText}.`)
      :(uk?`OVI має ціну, але поточного залишку недостатньо: ${stockText}. Потрібне підтвердження постачання.`:`OVI has a price, but current stock is insufficient: ${stockText}. Supply confirmation is required.`),
    url:"https://ovi-order-system.vercel.app/",
    source_type:"ovi",
    source_name:"OVI",
    source_group:"ovi-direct",
    result_kind:enough?"store_option":"store_option_pending",
    price_text:`${Number(item.price||0).toLocaleString(uk?"uk-UA":"en-GB",{minimumFractionDigits:2,maximumFractionDigits:2})} грн / ${item.unit}`,
    price_value:Number(item.price||0),
    price_unit:item.unit||"",
    currency:"UAH",
    location_text:provider?.city||"",
    quantity_tonnes:item.unit==="кг"?available/1000:null,
    quantity_text:stockText,
    verification_text:enough
      ?(uk?"Залишок і ціна отримані безпосередньо з OVI.":"Stock and price were received directly from OVI.")
      :(uk?"Ціна та поточний залишок отримані з OVI; потрібну кількість зараз не підтверджено.":"Price and current stock came from OVI; the requested quantity is not currently confirmed."),
    google_maps_url:""
  };
}

export async function searchOviForTask(task,{lang="uk",location=null}={}){
  const taskTokens=words(task);
  if(!taskTokens.length)return [];
  let catalog;
  try{catalog=await loadNeedCatalog()}catch{return []}
  const activeItems=(catalog?.items||[]).filter(item=>item.is_active&&(item.canonical_code||item.family_code));
  const ranked=activeItems
    .map(item=>({item,score:scoreItem(taskTokens,item)}))
    .filter(entry=>entry.score>0)
    .sort((a,b)=>b.score-a.score);
  if(!ranked.length)return [];
  const best=ranked[0].item;
  const quantity=requestedQuantity(task,best.unit||"кг");
  try{
    const data=await getOviOffers({
      canonicalCode:best.family_code?"":best.canonical_code||"",
      familyCode:best.family_code||"",
      quantity,
      location:location?{lat:location.latitude,lng:location.longitude}:null
    });
    return (data?.items||[]).map(item=>oviResult(item,data?.provider,lang));
  }catch{return []}
}
