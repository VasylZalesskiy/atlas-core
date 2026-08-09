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

export async function searchNearbyPlaces(location,query,{lang="uk",radiusKm=30,limit=5,signal}={}){
  if(!location)throw new Error("location-required");
  const q=String(query||"").trim();
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
  const response=await fetch(`${nominatimBase}?${params.toString()}`,{headers:{Accept:"application/json"},signal});
  if(!response.ok)throw new Error(`place-search-${response.status}`);
  const data=await response.json();
  return (data||[]).map(item=>{
    const latitude=toNumber(item.lat);const longitude=toNumber(item.lon);
    if(latitude===null||longitude===null)return null;
    const extra=item.extratags||{};
    const name=item.name||item.namedetails?.name||String(item.display_name||"").split(",")[0]||q;
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
      straightDistanceKm:distanceKm(origin,point),
      source:"OpenStreetMap"
    };
  }).filter(Boolean).sort((a,b)=>a.straightDistanceKm-b.straightDistanceKm);
}
