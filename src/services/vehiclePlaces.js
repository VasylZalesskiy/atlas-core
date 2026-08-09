const overpassEndpoints=[
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];
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
function centerOf(element){
  const latitude=toNumber(element.lat??element.center?.lat);
  const longitude=toNumber(element.lon??element.center?.lon);
  return latitude===null||longitude===null?null:{latitude,longitude};
}
function addressFrom(tags={}){
  return [tags["addr:street"],tags["addr:housenumber"],tags["addr:city"]].filter(Boolean).join(", ");
}
function normalizeDealer(item,origin,lang){
  return {
    id:item.id,
    latitude:item.latitude,
    longitude:item.longitude,
    name:item.name||(lang==="uk"?"Автосалон":"Car dealer"),
    typeLabel:lang==="uk"?"Автосалон / майданчик":"Car dealer",
    address:item.address||"",
    phone:item.phone||"",
    website:item.website||"",
    openingHours:item.openingHours||"",
    straightDistanceKm:distanceKm(origin,item)
  };
}
async function fetchOverpass(query){
  let lastError=null;
  for(const endpoint of overpassEndpoints){
    try{
      const response=await fetch(`${endpoint}?data=${encodeURIComponent(query)}`,{headers:{Accept:"application/json"}});
      if(!response.ok)throw new Error(`overpass-${response.status}`);
      return await response.json();
    }catch(error){lastError=error}
  }
  throw lastError||new Error("overpass-unavailable");
}

function boxFor(lat,lon,radiusKm){
  const dLat=radiusKm/111;
  const dLon=radiusKm/(111*Math.max(.2,Math.cos(radians(lat))));
  return `${lon-dLon},${lat+dLat},${lon+dLon},${lat-dLat}`;
}

async function findWithNominatim(origin,{radius=25000,lang="uk"}={}){
  const radiusKm=radius/1000;
  const queries=lang==="uk"?["автосалон","car dealer"]:["car dealer","автосалон"];
  const found=[];
  const seen=new Set();
  for(const q of queries){
    try{
      const params=new URLSearchParams({format:"jsonv2",q,limit:"12",addressdetails:"1",viewbox:boxFor(origin.latitude,origin.longitude,radiusKm),bounded:"1",accept_language:lang==="uk"?"uk":"en"});
      const response=await fetch(`${nominatimBase}?${params.toString()}`,{headers:{Accept:"application/json"}});
      if(!response.ok)continue;
      const data=await response.json();
      for(const item of data||[]){
        const latitude=toNumber(item.lat);const longitude=toNumber(item.lon);
        if(latitude===null||longitude===null)continue;
        const id=`nominatim-${item.place_id}`;
        if(seen.has(id))continue;seen.add(id);
        const address=item.display_name||"";
        const dealer=normalizeDealer({id,latitude,longitude,name:item.name||String(item.display_name||"").split(",")[0],address},origin,lang);
        if(dealer.straightDistanceKm<=radiusKm*1.25)found.push(dealer);
      }
      if(found.length>=3)break;
    }catch{}
  }
  return found.sort((a,b)=>a.straightDistanceKm-b.straightDistanceKm);
}

export async function findNearbyVehicleDealers(location,{radius=25000,lang="uk"}={}){
  if(!location)throw new Error("location-required");
  const lat=Number(location.latitude);
  const lon=Number(location.longitude);
  const origin={latitude:lat,longitude:lon};
  const query=`[out:json][timeout:15];(
    nwr(around:${radius},${lat},${lon})["shop"="car"];
    nwr(around:${radius},${lat},${lon})["shop"="car_repair"]["name"~"авто|auto|motor|car",i];
  );out center tags;`;

  let overpassDealers=[];
  try{
    const data=await fetchOverpass(query);
    const seen=new Set();
    overpassDealers=(data.elements||[]).map(element=>{
      const point=centerOf(element);if(!point)return null;
      const tags=element.tags||{};const id=`${element.type}-${element.id}`;
      if(seen.has(id))return null;seen.add(id);
      return normalizeDealer({
        id,latitude:point.latitude,longitude:point.longitude,
        name:tags.name||tags["name:uk"]||(lang==="uk"?"Автосалон":"Car dealer"),
        address:addressFrom(tags),phone:tags.phone||tags["contact:phone"]||"",
        website:tags.website||tags["contact:website"]||"",openingHours:tags.opening_hours||""
      },origin,lang);
    }).filter(Boolean).sort((a,b)=>a.straightDistanceKm-b.straightDistanceKm);
  }catch{}

  if(overpassDealers.length)return overpassDealers;
  const fallback=await findWithNominatim(origin,{radius,lang});
  if(fallback.length)return fallback;
  throw new Error("vehicle-places-not-found");
}
