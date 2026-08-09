import {searchDestination as searchOsmDestination,searchNearbyPlaces as searchOsmNearby} from "./genericPlaces";
import {getDrivingRoute as getOsmDrivingRoute} from "./medicalPlaces";

async function atlasMapsRequest(body,signal){
  const response=await fetch("/api/google-maps",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body),
    signal
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const error=new Error(data?.error||`google-maps-${response.status}`);
    error.status=response.status;
    error.details=data?.details||"";
    throw error;
  }
  return data;
}

function canFallback(error){
  return error?.status===503||/google-maps-key-missing|google-maps-/i.test(String(error?.message||""));
}

export async function searchNearbyPlaces(location,query,{lang="uk",radiusKm=30,limit=5,signal}={}){
  try{
    const data=await atlasMapsRequest({action:"places",mode:"nearby",origin:location,query,lang,radiusKm,limit},signal);
    return data.results||[];
  }catch(error){
    if(error?.name==="AbortError")throw error;
    if(!canFallback(error))throw error;
    return searchOsmNearby(location,query,{lang,radiusKm,limit,signal});
  }
}

export async function searchDestination(location,query,{lang="uk",limit=3,signal}={}){
  try{
    const data=await atlasMapsRequest({action:"places",mode:"destination",origin:location,query,lang,limit},signal);
    return data.results||[];
  }catch(error){
    if(error?.name==="AbortError")throw error;
    if(!canFallback(error))throw error;
    return searchOsmDestination(location,query,{lang,limit,signal});
  }
}

export async function getDrivingRoute(origin,destination,{lang="uk",signal}={}){
  try{
    const data=await atlasMapsRequest({action:"route",origin,destination,lang},signal);
    return data.route||null;
  }catch(error){
    if(error?.name==="AbortError")throw error;
    if(!canFallback(error))throw error;
    return getOsmDrivingRoute(origin,destination);
  }
}

export function buildGoogleDirectionsUrl(origin,destination){
  const params=new URLSearchParams({api:"1",travelmode:"driving",dir_action:"navigate"});
  if(origin?.latitude!=null&&origin?.longitude!=null){
    params.set("origin",`${origin.latitude},${origin.longitude}`);
  }
  const destinationText=destination?.latitude!=null&&destination?.longitude!=null
    ?`${destination.latitude},${destination.longitude}`
    :String(destination?.name||destination?.title||"");
  if(destinationText)params.set("destination",destinationText);
  if(destination?.placeId){
    params.set("destination_place_id",destination.placeId);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function openGoogleDirections(origin,destination){
  const url=buildGoogleDirectionsUrl(origin,destination);
  if(typeof window!=="undefined")window.location.assign(url);
  return url;
}
