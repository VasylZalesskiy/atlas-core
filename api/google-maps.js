const PLACES_URL="https://places.googleapis.com/v1/places:searchText";
const ROUTES_URL="https://routes.googleapis.com/directions/v2:computeRoutes";

function send(res,status,body){
  res.status(status).setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.end(JSON.stringify(body));
}

function cleanText(value,max=500){return String(value||"").replace(/\s+/g," ").trim().slice(0,max)}
function logAnalytics(event,data={}){console.log(JSON.stringify({level:"info",message:"atlas-analytics",event,...data}))}
function logAnalyticsError(event,error,data={}){console.error(JSON.stringify({level:"error",message:"atlas-analytics",event,error:String(error?.message||error||"unknown").slice(0,300),...data}))}
function number(value){const n=Number(value);return Number.isFinite(n)?n:null}
function point(value){
  const latitude=number(value?.latitude);
  const longitude=number(value?.longitude);
  return latitude===null||longitude===null?null:{latitude,longitude};
}
function radians(value){return value*Math.PI/180}
function distanceKm(a,b){
  if(!a||!b)return null;
  const earth=6371;
  const dLat=radians(b.latitude-a.latitude);
  const dLon=radians(b.longitude-a.longitude);
  const lat1=radians(a.latitude);
  const lat2=radians(b.latitude);
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return earth*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
function parseDuration(value){
  const seconds=parseFloat(String(value||"").replace(/s$/,""));
  return Number.isFinite(seconds)?seconds/60:null;
}

async function googleFetch(url,{apiKey,body,fieldMask}){
  const response=await fetch(url,{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "X-Goog-Api-Key":apiKey,
      "X-Goog-FieldMask":fieldMask
    },
    body:JSON.stringify(body)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const error=new Error(data?.error?.message||`google-maps-${response.status}`);
    error.status=response.status;
    error.code=data?.error?.status||"google-maps-error";
    throw error;
  }
  return data;
}

async function searchPlaces(apiKey,input){
  const query=cleanText(input.query,300);
  if(!query)return [];
  const origin=point(input.origin);
  const mode=input.mode==="destination"?"destination":"nearby";
  const lang=input.lang==="en"?"en":"uk";
  const pageSize=Math.min(Math.max(Number(input.limit)||5,1),8);
  const request={textQuery:query,pageSize,languageCode:lang};

  if(mode==="nearby"&&origin){
    const radiusKm=Math.min(Math.max(Number(input.radiusKm)||30,1),50);
    request.locationBias={circle:{center:origin,radius:radiusKm*1000}};
  }

  const data=await googleFetch(PLACES_URL,{
    apiKey,
    body:request,
    fieldMask:[
      "places.id",
      "places.displayName",
      "places.formattedAddress",
      "places.location",
      "places.primaryTypeDisplayName",
      "places.googleMapsUri",
      "places.nationalPhoneNumber",
      "places.websiteUri",
      "places.currentOpeningHours"
    ].join(",")
  });

  const results=(data.places||[]).map(place=>{
    const location=point(place.location);
    if(!location)return null;
    return {
      id:place.id,
      placeId:place.id,
      name:cleanText(place.displayName?.text||query,180),
      title:cleanText(place.displayName?.text||query,180),
      latitude:location.latitude,
      longitude:location.longitude,
      address:cleanText(place.formattedAddress,300),
      typeLabel:cleanText(place.primaryTypeDisplayName?.text,120),
      phone:cleanText(place.nationalPhoneNumber,80),
      website:cleanText(place.websiteUri,500),
      googleMapsUri:cleanText(place.googleMapsUri,700),
      openNow:typeof place.currentOpeningHours?.openNow==="boolean"?place.currentOpeningHours.openNow:null,
      openingHours:Array.isArray(place.currentOpeningHours?.weekdayDescriptions)?place.currentOpeningHours.weekdayDescriptions:[],
      straightDistanceKm:origin?distanceKm(origin,location):null,
      source:"Google Maps"
    };
  }).filter(Boolean);

  if(mode==="nearby"&&origin){
    results.sort((a,b)=>(a.straightDistanceKm??Infinity)-(b.straightDistanceKm??Infinity));
  }
  return results;
}

async function computeRoute(apiKey,input){
  const origin=point(input.origin);
  const destination=point(input.destination);
  if(!origin||!destination)throw Object.assign(new Error("route-points-required"),{status:400});

  const data=await googleFetch(ROUTES_URL,{
    apiKey,
    body:{
      origin:{location:{latLng:origin}},
      destination:{location:{latLng:destination}},
      travelMode:"DRIVE",
      routingPreference:"TRAFFIC_AWARE",
      computeAlternativeRoutes:false,
      languageCode:input.lang==="en"?"en-US":"uk-UA",
      units:"METRIC"
    },
    fieldMask:"routes.duration,routes.distanceMeters"
  });
  const route=data.routes?.[0];
  if(!route)return null;
  return {
    distanceKm:Number.isFinite(Number(route.distanceMeters))?Number(route.distanceMeters)/1000:null,
    minutes:parseDuration(route.duration),
    source:"Google Maps"
  };
}

export default async function handler(req,res){
  const startedAt=Date.now();
  const apiKey=process.env.GOOGLE_MAPS_API_KEY;

  if(req.method==="GET"){
    return send(res,200,{status:"atlas-google-maps-endpoint-online",google_maps_key_configured:Boolean(apiKey)});
  }
  if(req.method!=="POST")return send(res,405,{error:"method-not-allowed"});
  if(!apiKey)return send(res,503,{error:"google-maps-key-missing"});

  let body={};
  try{body=typeof req.body==="string"?JSON.parse(req.body||"{}"):req.body||{}}
  catch{return send(res,400,{error:"invalid-json"})}

  try{
    if(body.action==="places"){
      const results=await searchPlaces(apiKey,body);
      logAnalytics("atlas_nearby_search_completed",{result_count:results.length,mode:body.mode==="destination"?"destination":"nearby",duration_ms:Date.now()-startedAt});
      return send(res,200,{results});
    }
    if(body.action==="route"){
      const route=await computeRoute(apiKey,body);
      logAnalytics("atlas_route_completed",{route_found:Boolean(route),duration_ms:Date.now()-startedAt});
      return send(res,200,{route});
    }
    return send(res,400,{error:"unsupported-action"});
  }catch(error){
    const status=Number(error?.status)||502;
    logAnalyticsError("atlas_maps_failed",error,{action:String(body.action||"unknown").slice(0,40),status,duration_ms:Date.now()-startedAt});
    return send(res,status,{error:error?.code||"google-maps-failed",details:error?.message||"Google Maps request failed"});
  }
}
