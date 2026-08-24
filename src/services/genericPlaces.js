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
function boxFor(lat,lon,radiusKm){
  const dLat=radiusKm/111;
  const dLon=radiusKm/(111*Math.max(.2,Math.cos(radians(lat))));
  return `${lon-dLon},${lat+dLat},${lon+dLon},${lat-dLat}`;
}

function practicalNearbyQuery(query,lang){
  const q=String(query||"").trim();
  const text=q.toLowerCase();
  const uk=lang!=="en";
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

export async function searchNearbyPlaces(location,query,{lang="uk",radiusKm=30,limit=5,signal}={}){
  if(!location)throw new Error("location-required");
  const q=practicalNearbyQuery(query,lang);
  if(!q)return [];
  const origin={latitude:Number(location.latitude),longitude:Number(location.longitude)};
  const params=new URLSearchParams({
    format:"jsonv2",
    q,
    limit:String(Math.min(Math.max(limit,1),8)),
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

// Resolve a named destination globally rather than restricting the search to the
// user's nearby radius. This is used for requests such as travelling to a city,
// address, venue or other explicitly named destination.
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
