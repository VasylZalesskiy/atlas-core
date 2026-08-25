const MARKETPLACE_HOSTS=new Set([
  "upwork.com","freelancehunt.com","work.ua","robota.ua","linkedin.com","indeed.com",
  "olx.ua","auto.ria.com","dom.ria.com","prom.ua","etsy.com","fiverr.com",
  "atbmarket.com","rozetka.com.ua","silpo.ua","metro.zakaz.ua","novus.zakaz.ua","auchan.zakaz.ua","zakaz.ua",
  "flagma.ua","agro-ukraine.com","agrotorg.net","agrotender.com.ua","clunya.com","prod.ua"
]);

const SOURCE_NAMES={
  "olx.ua":"OLX",
  "prom.ua":"Prom.ua",
  "atbmarket.com":"АТБ",
  "rozetka.com.ua":"Rozetka",
  "silpo.ua":"Сільпо",
  "metro.zakaz.ua":"METRO",
  "novus.zakaz.ua":"NOVUS",
  "auchan.zakaz.ua":"Auchan",
  "zakaz.ua":"Zakaz.ua",
  "flagma.ua":"Flagma",
  "agro-ukraine.com":"Agro-Ukraine",
  "agrotorg.net":"Agrotorg",
  "agrotender.com.ua":"Agrotender",
  "clunya.com":"Clunya",
  "prod.ua":"Prod.ua",
  "work.ua":"Work.ua",
  "robota.ua":"Robota.ua",
  "freelancehunt.com":"Freelancehunt"
};

export function hostname(url){
  try{return new URL(url).hostname.replace(/^www\./,"").toLowerCase()}catch{return ""}
}

export function sourceName(url){
  const host=hostname(url);
  return SOURCE_NAMES[host]||host||"Інтернет";
}

export function inferSourceType(url){
  const host=hostname(url);
  if(/(^|\.)gov\.|(^|\.)gov$|\.gov\.ua$|diia\.gov\.ua$|kmu\.gov\.ua$|msp\.gov\.ua$/i.test(host))return "official";
  if(MARKETPLACE_HOSTS.has(host))return "marketplace";
  return "web";
}

function normalizedNumber(value){
  const compact=String(value||"").replace(/\s/g,"").replace(",",".");
  const number=Number(compact);
  return Number.isFinite(number)&&number>0?number:null;
}

function collectQuantitiesKilograms(text){
  const value=String(text||"").toLowerCase();
  const quantities=[];
  const tonnes=/(\d+(?:[\s.]\d{3})*(?:[.,]\d+)?)\s*(?:тонн(?:а|и|у)?|тон(?!\p{L})|т(?!\p{L})|tonnes?\b)/giu;
  const kilograms=/(\d+(?:[\s.]\d{3})*(?:[.,]\d+)?)\s*(?:кг(?!\p{L})|kg\b|кілограм(?:ів|и|а)?)/giu;
  for(const match of value.matchAll(tonnes)){
    const amount=normalizedNumber(match[1]);
    if(amount)quantities.push(amount*1000);
  }
  for(const match of value.matchAll(kilograms)){
    const amount=normalizedNumber(match[1]);
    if(amount)quantities.push(amount);
  }
  return quantities;
}

export function extractRequestedTonnes(text){
  const kilograms=extractRequestedKilograms(text);
  return kilograms===null?null:kilograms/1000;
}

export function extractRequestedKilograms(text){
  return collectQuantitiesKilograms(text)[0]??null;
}

export function extractListingQuantityTonnes(text){
  const quantities=collectQuantitiesKilograms(text);
  return quantities.length?Math.max(...quantities)/1000:null;
}

export function extractPriceText(text){
  const value=String(text||"").replace(/\s+/g," ");
  const patterns=[
    /\b\d[\d\s]*(?:[.,]\d+)?\s*(?:грн|₴)\s*\/\s*(?:кг|т|тонн(?:у|а)?|шт)\b/iu,
    /\b\d[\d\s]*(?:[.,]\d+)?\s*(?:грн|₴)\b/iu,
    /\b\d[\d\s]*(?:[.,]\d+)?\s*(?:USD|EUR|дол(?:ар(?:ів|и)?)?|євро)\b/iu
  ];
  for(const pattern of patterns){
    const match=value.match(pattern);
    if(match)return match[0].trim();
  }
  return "";
}

function isAgriculture(text){
  return /агро|agri|сільськ|ферм|врожай|картоп|горох|бобов|круп|овоч|фрукт|зерн|пшени|кукурудз|соняш|буряк|морк|цибул|капуст|яблук|ягод|насін|добрив|комбікорм|food|produce|peas?/i.test(String(text||""));
}

export function isProductTransaction(text){
  return /куп|прод|товар|продукт|постач|опт|гурт|тонн|кілограм|кг(?!\p{L})|достав|оренд|buy|sell|supplier|wholesale|bulk|product|delivery/iu.test(String(text||""));
}

export function sourceGroupsFor({source="web",goal="",query="",domain=""}={}){
  if(source!=="marketplace")return [{id:source==="official"?"official-web":"open-web",label:"відкритий інтернет",domains:[]}];
  const context=`${goal} ${query} ${domain}`;
  const requestedKilograms=extractRequestedKilograms(context);
  if(isAgriculture(context)){
    const bulk=[
      {id:"agriculture",label:"профільні агродошки",domains:["agro-ukraine.com","agrotorg.net","agrotender.com.ua","clunya.com","prod.ua"]},
      {id:"olx",label:"OLX",domains:["olx.ua"]},
      {id:"business-classifieds",label:"бізнес-оголошення",domains:["flagma.ua"]}
    ];
    if(requestedKilograms!==null&&requestedKilograms<=250){
      return [
        {id:"retail-stores",label:"магазини та маркетплейси",domains:["atbmarket.com","rozetka.com.ua","silpo.ua","metro.zakaz.ua","novus.zakaz.ua","auchan.zakaz.ua","prom.ua"]},
        {id:"olx",label:"OLX",domains:["olx.ua"]},
        ...bulk.slice(0,1)
      ];
    }
    return bulk;
  }
  if(isProductTransaction(context))return [
    {id:"retail-stores",label:"магазини та маркетплейси",domains:["atbmarket.com","rozetka.com.ua","silpo.ua","metro.zakaz.ua","novus.zakaz.ua","auchan.zakaz.ua","prom.ua"]},
    {id:"marketplaces",label:"маркетплейси",domains:["olx.ua","prom.ua","rozetka.com.ua"]},
    {id:"business-classifieds",label:"бізнес-оголошення",domains:["flagma.ua"]}
  ];
  return [{id:"marketplace-web",label:"маркетплейси та дошки оголошень",domains:[]}];
}

export function looksLikeCategory(url){
  return /\/list\/q-|\/uk\/list|\/products?\/q|\/trade\/r-|\/board\/r-|\/search[/?]|[?&](?:q|query|search)=/i.test(String(url||""));
}

export function looksLikeConcreteListing(url){
  const path=(()=>{try{return new URL(url).pathname}catch{return ""}})();
  return /\/d\/|\/obyavlenie\/|\/offer\/|\/offers\/|\/order\/|\/orders\/[^/]+|\/products?\/[^/]+|\/product\/[^/]+|\/p\d+\/?$/i.test(path)||path.split("/").filter(Boolean).length>=3;
}

export function resultKind(url){
  if(looksLikeConcreteListing(url))return "listing";
  if(looksLikeCategory(url))return "search_page";
  return "source_page";
}

export function isActionableCommerceResult(result){
  const host=hostname(result?.url);
  if(!MARKETPLACE_HOSTS.has(host))return false;
  return resultKind(result.url)!=="source_page"||["retail-stores","agriculture","olx","marketplaces","business-classifieds"].includes(result?.source_group);
}

const SEARCH_STOP_WORDS=new Set([
  "потрібно","потрібен","потрібна","потрібні","треба","шукаю","хочу","купити","куплю","продати","продам",
  "знайти","доставка","доставкою","оптом","гуртом","мені","для","або","та","і","у","в","на","по",
  "продаж","оголошення","пропозиція","пропозиції","маркетплейс","україна","україні","ua","olx","rozetka","prom",
  "agroboard","agriaffaires","need","want","find","buy","sell","with","delivery","wholesale","marketplace","listing",
  "ukraine","for","the","a","an"
]);

const SEARCH_WORD_ALIASES={гороху:"горох",гороха:"горох",картоплі:"картопля"};

export function marketplaceSearchTerm(text){
  const withoutQuantity=String(text||"")
    .toLowerCase()
    .replace(/\d+(?:[\s.]*\d)*(?:[.,]\d+)?\s*(?:тонн(?:а|и|у)?|тон(?!\p{L})|т(?!\p{L})|кг(?!\p{L})|kg\b|кілограм(?:ів|и|а)?|tonnes?\b)/giu," ")
    .replace(/[^\p{L}\p{N}\s-]/gu," ");
  const seen=new Set();
  const words=withoutQuantity.split(/\s+/).filter(Boolean).filter(word=>!SEARCH_STOP_WORDS.has(word)).map(word=>SEARCH_WORD_ALIASES[word]||word).filter(word=>{
    const key=word.length>5?word.slice(0,5):word;
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  });
  return words.slice(0,6).join(" ").trim();
}

export function googleMapsSearchUrl(query,locationText=""){
  const text=[String(query||"").trim(),"магазин",String(locationText||"").trim()].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
}

export function googleMapsDirectionsUrl(destination,locationText=""){
  const text=[String(destination||"").trim(),String(locationText||"").trim()].filter(Boolean).join(" ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(text)}`;
}

function googleSiteSearchUrl(domain,query){
  return `https://www.google.com/search?q=${encodeURIComponent(`site:${domain} ${query}`)}`;
}

function sourceSearchShortcut({sourceName:displayName,url,term,locationText,language="uk",maps=false,sourceGroup="retail-stores"}){
  const label=term.charAt(0).toUpperCase()+term.slice(1);
  return {
    title:`${label} — ${displayName}`,
    snippet:language==="uk"
      ?`Готовий пошук пропозицій за джерелом ${displayName} — відкрийте актуальні товари та перевірте ціну й наявність`
      :`Prepared offer search for ${displayName} — open current products and confirm price and availability`,
    url,
    source_type:"marketplace",
    source_name:displayName,
    source_group:sourceGroup,
    result_kind:"search_page",
    price_text:"",
    location_text:locationText,
    quantity_tonnes:null,
    quantity_text:"",
    verification_text:language==="uk"
      ?"Це готовий пошук за відомим джерелом; наявність, кількість, ціну й доставку потрібно підтвердити на сторінці продавця"
      :"This is a prepared search in a known source; confirm availability, quantity, price and delivery on the seller page",
    google_maps_url:maps?googleMapsSearchUrl(`${displayName} ${term}`,locationText):""
  };
}

export function buildMarketplaceShortcuts({goal="",query="",locationText="",language="uk"}={}){
  const term=marketplaceSearchTerm(query)||marketplaceSearchTerm(goal)||String(query||goal||"").trim();
  if(!term)return [];
  const label=term.charAt(0).toUpperCase()+term.slice(1);
  const encoded=encodeURIComponent(term);
  const olxSlug=encodeURIComponent(term.replace(/\s+/g,"-"));
  const verification=language==="uk"
    ?"Готовий пошук — відкрийте актуальні пропозиції та перевірте кількість, ціну й доставку у продавця"
    :"Prepared search — open current offers and confirm quantity, price and delivery with the seller";
  const requestedKilograms=extractRequestedKilograms(`${goal} ${query}`);
  const requestedAmount=requestedKilograms?`${requestedKilograms} кг`:language==="uk"?"потрібну кількість":"the required quantity";
  const agriculture=isAgriculture(`${goal} ${query}`);
  const retailQuantity=requestedKilograms===null||requestedKilograms<=250;
  const retailerOptions=/горох|peas?/i.test(term)?[{
    title:language==="uk"?"Горох 1 кг — АТБ":"Peas 1 kg — ATB",
    snippet:language==="uk"
      ?`АТБ продає фасований горох. Відкрийте найближчий магазин і перевірте, чи можна зібрати ${requestedAmount}.`
      :`ATB sells packaged peas. Open the nearest store and confirm whether ${requestedAmount} can be assembled.`,
    url:"https://www.atbmarket.com/catalog/395-krupi/f/vid-krup%3Dgoroh",
    source_type:"marketplace",
    source_name:"АТБ",
    source_group:"retail-stores",
    result_kind:"store_option",
    price_text:"",
    location_text:locationText,
    quantity_tonnes:null,
    quantity_text:"1 кг / упаковка",
    verification_text:language==="uk"
      ?`Товар є в каталозі АТБ; залишок ${requestedAmount} у конкретному магазині потрібно підтвердити перед поїздкою.`
      :`The product is listed by ATB; confirm store-level stock for ${requestedAmount} before travelling.`,
    google_maps_url:googleMapsDirectionsUrl("АТБ",locationText)
  }]:[];
  const commonMarketplaces=[
    {title:`${label} — OLX`,snippet:language==="uk"?"Актуальні оголошення продавців на OLX":"Current seller listings on OLX",url:`https://www.olx.ua/uk/list/q-${olxSlug}/`,source_type:"marketplace",source_name:"OLX",source_group:"olx",result_kind:"search_page",price_text:"",location_text:locationText,quantity_tonnes:null,quantity_text:"",verification_text:verification},
    {title:`${label} — Rozetka`,snippet:language==="uk"?"Товари та продавці на Rozetka":"Products and sellers on Rozetka",url:`https://rozetka.com.ua/ua/search/?text=${encoded}`,source_type:"marketplace",source_name:"Rozetka",source_group:"retail-stores",result_kind:"search_page",price_text:"",location_text:locationText,quantity_tonnes:null,quantity_text:"",verification_text:verification,google_maps_url:googleMapsSearchUrl(`Rozetka ${term}`,locationText)},
    {title:`${label} — Prom.ua`,snippet:language==="uk"?"Пропозиції магазинів і постачальників на Prom.ua":"Shop and supplier offers on Prom.ua",url:`https://prom.ua/ua/search?search_term=${encoded}`,source_type:"marketplace",source_name:"Prom.ua",source_group:"retail-stores",result_kind:"search_page",price_text:"",location_text:locationText,quantity_tonnes:null,quantity_text:"",verification_text:verification},
    sourceSearchShortcut({sourceName:"Flagma",url:`https://flagma.ua/uk/products/q=${encoded}/`,term,locationText,language,sourceGroup:"business-classifieds"})
  ];
  const retailStores=agriculture&&retailQuantity?[
    ...(/горох|peas?/i.test(term)?[]:[sourceSearchShortcut({sourceName:"АТБ",url:googleSiteSearchUrl("atbmarket.com",term),term,locationText,language,maps:true})]),
    sourceSearchShortcut({sourceName:"Сільпо",url:`https://silpo.ua/search?find=${encoded}`,term,locationText,language,maps:true}),
    sourceSearchShortcut({sourceName:"METRO",url:`https://metro.zakaz.ua/uk/search/?q=${encoded}`,term,locationText,language,maps:true}),
    sourceSearchShortcut({sourceName:"NOVUS",url:`https://novus.zakaz.ua/uk/search/?q=${encoded}`,term,locationText,language,maps:true}),
    sourceSearchShortcut({sourceName:"Auchan",url:`https://auchan.zakaz.ua/uk/search/?q=${encoded}`,term,locationText,language,maps:true})
  ]:[];
  const bulkAgriculture=agriculture&&!retailQuantity?[
    sourceSearchShortcut({sourceName:"Agro-Ukraine",url:googleSiteSearchUrl("agro-ukraine.com",term),term,locationText,language,sourceGroup:"agriculture"}),
    sourceSearchShortcut({sourceName:"Agrotorg",url:googleSiteSearchUrl("agrotorg.net",term),term,locationText,language,sourceGroup:"agriculture"}),
    sourceSearchShortcut({sourceName:"Agrotender",url:googleSiteSearchUrl("agrotender.com.ua",term),term,locationText,language,sourceGroup:"agriculture"})
  ]:[];
  const ordered=bulkAgriculture.length
    ?[commonMarketplaces[3],...bulkAgriculture,commonMarketplaces[0],commonMarketplaces[2]]
    :[...retailerOptions,...retailStores,commonMarketplaces[1],commonMarketplaces[0],commonMarketplaces[2],commonMarketplaces[3]];
  return [...ordered,{
    title:language==="uk"?`Магазини: ${term}`:`Stores: ${term}`,
    snippet:language==="uk"?"Відкрити магазини поблизу одразу в Google Maps":"Open nearby stores directly in Google Maps",
    url:googleMapsSearchUrl(term,locationText),source_type:"maps",source_name:"Google Maps",source_group:"maps",result_kind:"maps_search",
    price_text:"",location_text:locationText,quantity_tonnes:null,quantity_text:"",
    verification_text:language==="uk"?"Google Maps показує місця; наявність товару потрібно підтвердити у магазині":"Google Maps shows places; confirm product availability with the store"
  }];
}

export function actionabilityScore(result,{requestedTonnes=null}={}){
  const hay=`${result.title||""} ${result.snippet||""} ${result.url||""}`.toLowerCase();
  const quantity=Number(result.quantity_tonnes);
  let score=0;
  if(result.result_kind==="store_option")score+=30;
  if(/продам|пропозиці|в наявності|постачаль|опт|гурт|купити|ціна|достав|sell|offer|supplier|wholesale|bulk|marketplace|apply|vacanc|project/.test(hay))score+=4;
  if(looksLikeConcreteListing(result.url))score+=4;
  if(["agriculture","business-classifieds"].includes(result.source_group))score+=2;
  if(Number.isFinite(quantity))score+=4;
  if(Number.isFinite(requestedTonnes)&&Number.isFinite(quantity)){
    if(quantity>=requestedTonnes)score+=12;
    else score+=Math.max(0,Math.round(5*quantity/requestedTonnes));
  }
  if(result.source_type==="official")score+=2;
  if(looksLikeCategory(result.url))score-=3;
  if(/how[- ]?to|beginner|guide|blog|academy|learn|resources?|help\/|article|порад|новин|аналітик/.test(hay))score-=6;
  if(/login|signup|register/.test(hay))score-=2;
  return score;
}

export function rankMarketplaceResults(results,{requestedTonnes=null,limit=12}={}){
  return (Array.isArray(results)?results:[])
    .map((result,index)=>({...result,_index:index,_score:actionabilityScore(result,{requestedTonnes})}))
    .sort((a,b)=>b._score-a._score||a._index-b._index)
    .slice(0,limit)
    .map(({_score,_index,...result})=>result);
}

