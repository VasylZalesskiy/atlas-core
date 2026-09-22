function send(res,status,body){
  res.status(status).setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.end(JSON.stringify(body));
}
function clean(value){return String(value||"").replace(/\s+/g," ").trim()}
function toNumber(value){const n=Number(value);return Number.isFinite(n)?n:null}
function radians(value){return value*Math.PI/180}
function distanceKm(a,b){
  const earth=6371,dLat=radians(b.latitude-a.latitude),dLon=radians(b.longitude-a.longitude);
  const lat1=radians(a.latitude),lat2=radians(b.latitude);
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return earth*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
function addressFromTags(tags={}){return [tags["addr:street"],tags["addr:housenumber"],tags["addr:city"]].filter(Boolean).join(", ")}
async function fetchJson(url,options={},timeoutMs=9000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{const response=await fetch(url,{...options,signal:controller.signal});if(!response.ok)throw new Error("http-"+response.status);return await response.json()}
  finally{clearTimeout(timer)}
}
async function geocode(locationText,lang="uk"){
  const params=new URLSearchParams({format:"jsonv2",q:locationText,limit:"1",addressdetails:"1","accept-language":lang==="en"?"en":"uk"});
  const data=await fetchJson("https://nominatim.openstreetmap.org/search?"+params.toString(),{headers:{Accept:"application/json","User-Agent":"Atlas/2.6 atlas-core-two.vercel.app"}});
  const first=data&&data[0];
  return first?{latitude:Number(first.lat),longitude:Number(first.lon),label:locationText}:null;
}
function serviceConfig(query){
  const q=clean(query).toLowerCase();
  if(/шиномонтаж|шини|колес|tire|tyre/.test(q))return {label:"Шиномонтаж",selectors:['["shop"="tyres"]','["shop"="car_repair"]["service:vehicle:tyres"="yes"]','["craft"="car_repair"]["service:vehicle:tyres"="yes"]','["name"~"шиномонтаж|шини|tire|tyre",i]']};
  if(/перукар|barber|hair/.test(q))return {label:"Перукарня",selectors:['["shop"="hairdresser"]']};
  if(/стомат|dent/.test(q))return {label:"Стоматологія",selectors:['["amenity"="dentist"]']};
  if(/аптек|pharmacy/.test(q))return {label:"Аптека",selectors:['["amenity"="pharmacy"]']};
  if(/готел|hotel|hostel/.test(q))return {label:"Готель",selectors:['["tourism"="hotel"]','["tourism"="hostel"]']};
  if(/ресторан|кафе|restaurant|cafe/.test(q))return {label:"Заклад",selectors:['["amenity"="restaurant"]','["amenity"="cafe"]']};
  return {label:clean(query)||"Послуга",selectors:[]};
}
async function overpass(origin,query,radiusKm=25){
  const cfg=serviceConfig(query);
  if(!cfg.selectors.length)return [];
  const radius=Math.min(Math.max(Math.round(Number(radiusKm||25)*1000),1500),50000);
  const statements=[];
  for(const selector of cfg.selectors){
    statements.push("node(around:"+radius+","+origin.latitude+","+origin.longitude+")"+selector+";");
    statements.push("way(around:"+radius+","+origin.latitude+","+origin.longitude+")"+selector+";");
    statements.push("relation(around:"+radius+","+origin.latitude+","+origin.longitude+")"+selector+";");
  }
  const payload="[out:json][timeout:20];("+statements.join("\n")+");out center tags;";
  const endpoints=["https://overpass-api.de/api/interpreter","https://overpass.kumi.systems/api/interpreter"];
  let data=null;
  for(const endpoint of endpoints){try{data=await fetchJson(endpoint,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8","User-Agent":"Atlas/2.6"},body:"data="+encodeURIComponent(payload)},12000);if(data)break}catch{}}
  const seen=new Set();
  return ((data&&data.elements)||[]).map(el=>{
    const latitude=toNumber(el.lat!=null?el.lat:el.center&&el.center.lat),longitude=toNumber(el.lon!=null?el.lon:el.center&&el.center.lon);
    if(latitude===null||longitude===null)return null;
    const tags=el.tags||{},key=Math.round(latitude*10000)+":"+Math.round(longitude*10000)+":"+(tags.name||"");
    if(seen.has(key))return null;seen.add(key);
    const name=tags["name:uk"]||tags.name||cfg.label;
    return {id:"osm-"+el.type+"-"+el.id,name,title:name,latitude,longitude,address:addressFromTags(tags),typeLabel:cfg.label,phone:tags["contact:phone"]||tags.phone||"",website:tags["contact:website"]||tags.website||"",openingHours:tags.opening_hours||"",straightDistanceKm:distanceKm(origin,{latitude,longitude}),source:"OpenStreetMap"};
  }).filter(Boolean).sort((a,b)=>a.straightDistanceKm-b.straightDistanceKm);
}
async function nominatimSearch(query,locationText,origin,lang){
  const variants=[clean(query+" "+locationText)];
  if(/шиномонтаж|шини|колес/i.test(query)){variants.push(clean("автосервіс "+locationText));variants.push(clean("шини "+locationText))}
  const all=[];
  for(const value of variants){
    try{
      const params=new URLSearchParams({format:"jsonv2",q:value,limit:"12",addressdetails:"1",extratags:"1",namedetails:"1","accept-language":lang==="en"?"en":"uk"});
      const data=await fetchJson("https://nominatim.openstreetmap.org/search?"+params.toString(),{headers:{Accept:"application/json","User-Agent":"Atlas/2.6 atlas-core-two.vercel.app"}});
      for(const item of data||[]){
        const latitude=toNumber(item.lat),longitude=toNumber(item.lon);if(latitude===null||longitude===null)continue;
        const extra=item.extratags||{},name=item.name||(item.namedetails&&item.namedetails.name)||String(item.display_name||"").split(",")[0]||query;
        all.push({id:"nom-"+item.place_id,name,title:name,latitude,longitude,address:item.display_name||"",typeLabel:item.type||item.category||"",phone:extra.phone||extra["contact:phone"]||"",website:extra.website||extra["contact:website"]||"",openingHours:extra.opening_hours||"",straightDistanceKm:distanceKm(origin,{latitude,longitude}),source:"OpenStreetMap"});
      }
    }catch{}
  }
  const seen=new Set();return all.filter(item=>{const key=item.latitude+":"+item.longitude+":"+item.name;if(seen.has(key))return false;seen.add(key);return true}).sort((a,b)=>a.straightDistanceKm-b.straightDistanceKm);
}
export default async function handler(req,res){
  if(req.method==="GET")return send(res,200,{status:"atlas-local-search-online"});
  if(req.method!=="POST")return send(res,405,{error:"method-not-allowed"});
  let body={};try{body=typeof req.body==="string"?JSON.parse(req.body||"{}"):req.body||{}}catch{return send(res,400,{error:"invalid-json"})}
  const query=clean(body.query).slice(0,160),locationText=clean(body.location_text).slice(0,160),lang=body.language==="en"?"en":"uk";
  if(!query)return send(res,400,{error:"query-required"});
  let origin=body.origin&&Number.isFinite(Number(body.origin.latitude))&&Number.isFinite(Number(body.origin.longitude))?{latitude:Number(body.origin.latitude),longitude:Number(body.origin.longitude)}:null;
  if(!origin&&locationText)origin=await geocode(locationText,lang).catch(()=>null);
  if(!origin)return send(res,200,{results:[],search_status:"location-required"});
  let results=await overpass(origin,query,body.radius_km||25).catch(()=>[]);
  if(results.length<5){
    const extra=await nominatimSearch(query,locationText||origin.label||"",origin,lang);
    const keyed=new Map(results.map(item=>[(item.latitude+":"+item.longitude+":"+item.name),item]));
    for(const item of extra){const key=item.latitude+":"+item.longitude+":"+item.name;if(!keyed.has(key))keyed.set(key,item)}
    results=[...keyed.values()].sort((a,b)=>a.straightDistanceKm-b.straightDistanceKm);
  }
  return send(res,200,{results:results.slice(0,15),search_status:results.length?"live-results":"no-results",origin});
}
