const overpassEndpoints=[
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];

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

export async function findNearbyVehicleDealers(location,{radius=25000,lang="uk"}={}){
  if(!location)throw new Error("location-required");
  const lat=Number(location.latitude);
  const lon=Number(location.longitude);
  const query=`[out:json][timeout:15];(
    nwr(around:${radius},${lat},${lon})["shop"="car"];
  );out center tags;`;
  const data=await fetchOverpass(query);
  const seen=new Set();
  return (data.elements||[]).map(element=>{
    const point=centerOf(element);
    if(!point)return null;
    const tags=element.tags||{};
    const id=`${element.type}-${element.id}`;
    if(seen.has(id))return null;
    seen.add(id);
    return {
      id,
      latitude:point.latitude,
      longitude:point.longitude,
      name:tags.name||tags["name:uk"]||(lang==="uk"?"Автосалон":"Car dealer"),
      typeLabel:lang==="uk"?"Автосалон / майданчик":"Car dealer",
      address:addressFrom(tags),
      phone:tags.phone||tags["contact:phone"]||"",
      website:tags.website||tags["contact:website"]||"",
      openingHours:tags.opening_hours||"",
      straightDistanceKm:distanceKm({latitude:lat,longitude:lon},point)
    };
  }).filter(Boolean).sort((a,b)=>a.straightDistanceKm-b.straightDistanceKm);
}
