const nominatimBase="https://nominatim.openstreetmap.org/search";

function toNumber(value){const n=Number(value);return Number.isFinite(n)?n:null}
function radians(value){return value*Math.PI/180}
function distanceKm(a,b){
  const earth=6371;
  const dLat=radians(b.latitude-a.latitude);
  const dLon=radians(b.longitude-a.longitude);
  const lat1=radians(a.latitude);
  const lat2=radians(b.latitude);
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return earth*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}

const overpassEndpoints=["https://overpass-api.de/api/interpreter","https://overpass.kumi.systems/api/interpreter"];

function addressFromTags(tags={}){
  return [tags["addr:street"],tags["addr:housenumber"],tags["addr:city"]].filter(Boolean).join(", ");
}

async function overpassSearch(query,signal){
  let lastError=null;
  for(const endpoint of overpassEndpoints){
    try{
      const response=await fetch(endpoint,{
        method:"POST",
        headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8",Accept:"application/json"},
        body:"data="+encodeURIComponent(query),
        signal
      });
      if(!response.ok)throw new Error("overpass-"+response.status);
      return await response.json();
    }catch(error){
      if(error?.name==="AbortError")throw error;
      lastError=error;
    }
  }
  throw lastError||new Error("overpass-unavailable");
}

async function searchTyreServices(origin,{radiusKm=30,limit=12,lang="uk",signal}={}){
  const radius=Math.min(Math.max(Math.round(radiusKm*1000),1000),50000);
  const q=`[out:json][timeout:18];(
    nwr(around:${radius},${origin.latitude},${origin.longitude})["shop"="car_repair"]["service:vehicle:tyres"="yes"];
    nwr(around:${radius},${origin.latitude},${origin.longitude})["shop"="tyres"];
    nwr(around:${radius},${origin.latitude},${origin.longitude})["name"~"шиномонтаж|шини|tire|tyre",i];
  );out center tags;`;
  const data=await overpassSearch(q,signal);
  const seen=new Set();
  return (data.elements||[]).map(element=>{
    const latitude=toNumber(element.lat??element.center?.lat);
    const longitude=toNumber(element.lon??element.center?.lon);
    if(latitude===null||longitude===null)return null;
    const id=element.type+"-"+element.id;
    if(seen.has(id))return null;
    seen.add(id);
    const tags=element.tags||{};
    const point={latitude,longitude};
    const name=tags.name||tags["name:uk"]||(lang==="en"?"Tyre service":"Шиномонтаж");
    return {
      id:"overpass-"+id,
      name,
      title:name,
      latitude,
      longitude,
      address:addressFromTags(tags),
      typeLabel:lang==="en"?"Tyre service":"Шиномонтаж",
      phone:tags.phone||tags["contact:phone"]||"",
      website:tags.website||tags["contact:website"]||"",
      openingHours:tags.opening_hours||"",
      straightDistanceKm:distanceKm(origin,point),
      source:"OpenStreetMap"
    };
  }).filter(Boolean).sort((a,b)=>a.straightDistanceKm-b.straightDistanceKm).slice(0,limit);
}

function boxFor(lat,lon,radiusKm){
  const dLat=radiusKm/111;
  const dLon=radiusKm/(111*Math.max(.2,Math.cos(radians(lat))));
  return `${lon-dLon},${lat+dLat},${lon+dLon},${lat-dLat}`;
}

function practicalNearbyQuery(query,lang){
  const q=String(query||"").trim();
  const text=q.toLowerCase();
  const uk=lang!=="en";
  if(/продуктов\w*\s+магазин|магазин\w*\s+продукт|супермаркет|grocer|grocery|supermarket/i.test(text)){
    return uk?"супермаркет":"supermarket";
  }
  if(/пробил\w*\s+колес|спустил\w*\s+колес|прокол\w*\s+колес|шиномонтаж|flat\s+tire|flat\s+tyre|puncture/i.test(text)){
    return uk?"шиномонтаж":"tyre repair";
  }
  if(/евакуатор|зламал\w*\s+авто|машин\w*\s+не\s+завод|tow\s+truck|car\s+won.?t\s+start|car\s+broken/i.test(text)){
    return uk?"автодопомога евакуатор":"roadside assistance tow truck";
  }
  if(/аптек|ліки\s+поруч|pharmacy|drugstore/i.test(text)){
    return uk?"аптека":"pharmacy";
  }
  return q;
}

function normalizePlace(item,origin,fallbackName){
  const latitude=toNumber(item?.lat);
  const longitude=toNumber(item?.lon);
  if(latitude===null||longitude===null)return null;
  const extra=item.extratags||{};
  const name=item.name||item.namedetails?.name||String(item.display_name||"").split(",")[0]||fallbackName;
  const point={latitude,longitude};
  return {
    id:`place-${item.place_id}`,
    name,
    title:name,
    latitude,
    longitude,
    address:item.display_name||"",
    typeLabel:item.type||item.category||"",
    phone:extra.phone||extra["contact:phone"]||"",
    website:extra.website||extra["contact:website"]||"",
    openingHours:extra.opening_hours||"",
    straightDistanceKm:origin?distanceKm(origin,point):null,
    source:"OpenStreetMap"
  };
}

async function nominatimSearch(params,signal){
  const response=await fetch(`${nominatimBase}?${params.toString()}`,{headers:{Accept:"application/json"},signal});
  if(!response.ok)throw new Error(`place-search-${response.status}`);
  return await response.json();
}

export async function searchNearbyPlaces(location,query,{lang="uk",radiusKm=30,limit=12,signal}={}){
  if(!location)throw new Error("location-required");
  const q=practicalNearbyQuery(query,lang);
  if(!q)return [];
  const origin={latitude:Number(location.latitude),longitude:Number(location.longitude)};
  try{
    const response=await fetch("/api/local-search",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({query:q,origin,location_text:location?.label||"",language:lang,radius_km:radiusKm,limit}),
      signal
    });
    const data=await response.json().catch(()=>({}));
    if(response.ok&&Array.isArray(data?.results)&&data.results.length){
      return data.results.slice(0,Math.min(Math.max(limit,1),15));
    }
  }catch(error){if(error?.name==="AbortError")throw error}
  if(/шиномонтаж|tyre repair|tire repair/i.test(q)){
    try{
      const tyreResults=await searchTyreServices(origin,{radiusKm,limit:Math.min(Math.max(limit,1),15),lang,signal});
      if(tyreResults.length>=3)return tyreResults;
    }catch(error){if(error?.name==="AbortError")throw error}
  }
  const params=new URLSearchParams({
    format:"jsonv2",
    q,
    limit:String(Math.min(Math.max(limit,1),15)),
    addressdetails:"1",
    extratags:"1",
    namedetails:"1",
    viewbox:boxFor(origin.latitude,origin.longitude,radiusKm),
    bounded:"1",
    accept_language:lang==="en"?"en":"uk"
  });
  const data=await nominatimSearch(params,signal);
  return (data||[])
    .map(item=>normalizePlace(item,origin,q))
    .filter(Boolean)
    .sort((a,b)=>(a.straightDistanceKm??Infinity)-(b.straightDistanceKm??Infinity));
}

export async function searchDestination(location,query,{lang="uk",limit=3,signal}={}){
  const q=String(query||"").trim();
  if(!q)return [];
  const origin=location?{latitude:Number(location.latitude),longitude:Number(location.longitude)}:null;
  const params=new URLSearchParams({
    format:"jsonv2",
    q,
    limit:String(Math.min(Math.max(limit,1),6)),
    addressdetails:"1",
    extratags:"1",
    namedetails:"1",
    accept_language:lang==="en"?"en":"uk"
  });
  const data=await nominatimSearch(params,signal);
  return (data||[]).map(item=>normalizePlace(item,origin,q)).filter(Boolean);
}
