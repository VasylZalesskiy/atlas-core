const overpassEndpoints=[
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];
const osrmBase="https://router.project-osrm.org";

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
  if(latitude===null||longitude===null)return null;
  return {latitude,longitude};
}

function normalizeType(tags={}){
  const amenity=tags.amenity;
  const healthcare=tags.healthcare;
  const value=amenity||healthcare||"medical";
  if(value==="hospital")return "hospital";
  if(value==="clinic")return "clinic";
  if(value==="doctors"||value==="doctor")return "doctors";
  if(value==="pharmacy")return "pharmacy";
  if(value==="health_post")return "health_post";
  return "medical";
}

function labelFor(type,lang="uk"){
  const labels={
    hospital:{uk:"Лікарня",en:"Hospital"},
    clinic:{uk:"Клініка",en:"Clinic"},
    doctors:{uk:"Лікар / амбулаторія",en:"Doctor / medical office"},
    pharmacy:{uk:"Аптека",en:"Pharmacy"},
    health_post:{uk:"Медичний пункт",en:"Health post"},
    medical:{uk:"Медичний заклад",en:"Medical facility"}
  };
  return labels[type]?.[lang]||labels[type]?.uk||labels.medical.uk;
}

function addressFrom(tags={}){
  return [tags["addr:street"],tags["addr:housenumber"],tags["addr:city"]].filter(Boolean).join(", ");
}

function mapElement(element,origin,lang){
  const location=centerOf(element);
  if(!location)return null;
  const tags=element.tags||{};
  const type=normalizeType(tags);
  return {
    id:`${element.type}-${element.id}`,
    osmType:element.type,
    osmId:element.id,
    type,
    typeLabel:labelFor(type,lang),
    name:tags.name||tags["name:uk"]||labelFor(type,lang),
    address:addressFrom(tags),
    phone:tags.phone||tags["contact:phone"]||"",
    openingHours:tags.opening_hours||"",
    emergency:tags.emergency||"",
    website:tags.website||tags["contact:website"]||"",
    speciality:tags["healthcare:speciality"]||"",
    latitude:location.latitude,
    longitude:location.longitude,
    straightDistanceKm:distanceKm(origin,location)
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

export async function findNearbyMedical(location,{radius=25000,lang="uk"}={}){
  if(!location)throw new Error("location-required");
  const lat=Number(location.latitude);
  const lon=Number(location.longitude);
  const query=`[out:json][timeout:15];(
    nwr(around:${radius},${lat},${lon})["amenity"~"^(hospital|clinic|doctors|pharmacy)$"];
    nwr(around:${radius},${lat},${lon})["healthcare"~"^(hospital|clinic|doctor|pharmacy|health_post)$"];
  );out center tags;`;
  const data=await fetchOverpass(query);
  const seen=new Set();
  const places=(data.elements||[])
    .map(item=>mapElement(item,{latitude:lat,longitude:lon},lang))
    .filter(Boolean)
    .filter(item=>{if(seen.has(item.id))return false;seen.add(item.id);return true})
    .sort((a,b)=>a.straightDistanceKm-b.straightDistanceKm);

  const hospitals=places.filter(item=>item.type==="hospital");
  const otherCare=places.filter(item=>["clinic","doctors","health_post"].includes(item.type));
  const pharmacies=places.filter(item=>item.type==="pharmacy");
  return {hospitals,otherCare,pharmacies,all:places};
}

export async function getDrivingRoute(origin,destination){
  if(!origin||!destination)throw new Error("route-points-required");
  const coords=`${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const response=await fetch(`${osrmBase}/route/v1/driving/${coords}?overview=false&steps=false`);
  if(!response.ok)throw new Error(`route-${response.status}`);
  const data=await response.json();
  const route=data.routes?.[0];
  if(!route)throw new Error("route-not-found");
  return {distanceKm:route.distance/1000,minutes:route.duration/60};
}

export function buildOsmDirectionsUrl(origin,destination){
  const route=`${origin.latitude},${origin.longitude};${destination.latitude},${destination.longitude}`;
  const params=new URLSearchParams({engine:"fossgis_osrm_car",route});
  return `https://www.openstreetmap.org/directions?${params.toString()}`;
}

export function openOsmDirections(origin,destination){
  const url=buildOsmDirectionsUrl(origin,destination);
  if(typeof window!=="undefined")window.location.assign(url);
  return url;
}
