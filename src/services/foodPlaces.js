const overpassEndpoints=[
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];

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
  const latitude=Number(element.lat??element.center?.lat);
  const longitude=Number(element.lon??element.center?.lon);
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return null;
  return {latitude,longitude};
}

function addressFrom(tags={}){
  return [tags["addr:street"],tags["addr:housenumber"],tags["addr:city"]].filter(Boolean).join(", ");
}

function typeInfo(tags={},lang="uk"){
  const amenity=tags.amenity;
  const shop=tags.shop;
  const labels={
    restaurant:{uk:"Ресторан",en:"Restaurant"},
    cafe:{uk:"Кафе",en:"Cafe"},
    fast_food:{uk:"Швидка їжа",en:"Fast food"},
    food_court:{uk:"Фудкорт",en:"Food court"},
    supermarket:{uk:"Супермаркет",en:"Supermarket"},
    convenience:{uk:"Продукти",en:"Grocery store"},
    bakery:{uk:"Пекарня",en:"Bakery"},
    greengrocer:{uk:"Овочі та фрукти",en:"Greengrocer"}
  };
  const type=amenity||shop||"food";
  return {type,label:labels[type]?.[lang]||labels[type]?.uk|| (lang==="uk"?"Їжа поруч":"Food nearby")};
}

function mapElement(element,origin,lang){
  const location=centerOf(element);
  if(!location)return null;
  const tags=element.tags||{};
  const info=typeInfo(tags,lang);
  return {
    id:`${element.type}-${element.id}`,
    name:tags["name:uk"]||tags.name||info.label,
    type:info.type,
    typeLabel:info.label,
    address:addressFrom(tags),
    cuisine:tags.cuisine||"",
    phone:tags.phone||tags["contact:phone"]||"",
    openingHours:tags.opening_hours||"",
    latitude:location.latitude,
    longitude:location.longitude,
    distanceKm:distanceKm(origin,location)
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

export async function findNearbyFood(location,{radius=7000,lang="uk"}={}){
  if(!location)throw new Error("location-required");
  const lat=Number(location.latitude);
  const lon=Number(location.longitude);
  const query=`[out:json][timeout:15];(
    nwr(around:${radius},${lat},${lon})["amenity"~"^(restaurant|cafe|fast_food|food_court)$"];
    nwr(around:${radius},${lat},${lon})["shop"~"^(supermarket|convenience|bakery|greengrocer)$"];
  );out center tags;`;
  const data=await fetchOverpass(query);
  const seen=new Set();
  const places=(data.elements||[])
    .map(item=>mapElement(item,{latitude:lat,longitude:lon},lang))
    .filter(Boolean)
    .filter(item=>{if(seen.has(item.id))return false;seen.add(item.id);return true})
    .sort((a,b)=>a.distanceKm-b.distanceKm);
  return {
    meals:places.filter(item=>["restaurant","cafe","fast_food","food_court"].includes(item.type)),
    groceries:places.filter(item=>["supermarket","convenience","bakery","greengrocer"].includes(item.type)),
    all:places
  };
}

export function buildOsmDirectionsUrl(origin,destination){
  const route=`${origin.latitude},${origin.longitude};${destination.latitude},${destination.longitude}`;
  const params=new URLSearchParams({engine:"fossgis_osrm_car",route});
  return `https://www.openstreetmap.org/directions?${params.toString()}`;
}

export function openFoodDirections(origin,destination){
  const url=buildOsmDirectionsUrl(origin,destination);
  if(typeof window!=="undefined")window.location.assign(url);
  return url;
}
