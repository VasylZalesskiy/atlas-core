function send(res,status,body){
  res.status(status).setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.end(JSON.stringify(body));
}

function key(){return process.env.GOOGLE_MAPS_API_KEY||process.env.GOOGLE_PLACES_API_KEY||""}

function cleanNumber(value){
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}

function normalizeGooglePlace(place,origin){
  const latitude=cleanNumber(place?.location?.latitude);
  const longitude=cleanNumber(place?.location?.longitude);
  if(latitude===null||longitude===null)return null;
  const toRad=value=>value*Math.PI/180;
  let straightDistanceKm=null;
  if(origin?.latitude!=null&&origin?.longitude!=null){
    const a={latitude:Number(origin.latitude),longitude:Number(origin.longitude)};
    const earth=6371;
    const dLat=toRad(latitude-a.latitude),dLon=toRad(longitude-a.longitude);
    const h=Math.sin(dLat/2)**2+Math.cos(toRad(a.latitude))*Math.cos(toRad(latitude))*Math.sin(dLon/2)**2;
    straightDistanceKm=earth*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
  }
  return {
    id:place.id||place.name,
    placeId:place.id||"",
    name:place.displayName?.text||place.formattedAddress||"Google Maps",
    title:place.displayName?.text||place.formattedAddress||"Google Maps",
    latitude,
    longitude,
    address:place.formattedAddress||"",
    typeLabel:place.primaryTypeDisplayName?.text||place.googleMapsTypeLabel?.text||"",
    googleMapsUri:place.googleMapsUri||"",
    straightDistanceKm,
    source:"Google Maps"
  };
}

async function googleTextSearch({origin,query,lang="uk",radiusKm=30,limit=12}){
  const apiKey=key();
  if(!apiKey)throw Object.assign(new Error("google-maps-key-missing"),{status:503});
  const max=Math.min(Math.max(Number(limit)||12,1),20);
  const body={
    textQuery:String(query||"").trim(),
    pageSize:max,
    languageCode:lang==="en"?"en":"uk",
    regionCode:"UA"
  };
  if(origin?.latitude!=null&&origin?.longitude!=null){
    body.locationBias={circle:{
      center:{latitude:Number(origin.latitude),longitude:Number(origin.longitude)},
      radius:Math.min(Math.max((Number(radiusKm)||30)*1000,500),50000)
    }};
  }
  const response=await fetch("https://places.googleapis.com/v1/places:searchText",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "X-Goog-Api-Key":apiKey,
      "X-Goog-FieldMask":"places.id,places.displayName,places.formattedAddress,places.location,places.primaryTypeDisplayName,places.googleMapsUri"
    },
    body:JSON.stringify(body)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const error=new Error(data?.error?.message||"google-places-search-failed");
    error.status=response.status;
    throw error;
  }
  return (data.places||[]).map(place=>normalizeGooglePlace(place,origin)).filter(Boolean).sort((a,b)=>(a.straightDistanceKm??Infinity)-(b.straightDistanceKm??Infinity));
}

export default async function handler(req,res){
  const apiKey=key();
  if(req.method==="GET"){
    return send(res,200,{
      status:apiKey?"google-places-enabled":"atlas-maps-fallback-mode",
      google_maps_key_configured:Boolean(apiKey),
      paid_google_maps_api_disabled:!apiKey,
      fallback_provider:"OpenStreetMap",
      google_maps_links_enabled:true
    });
  }
  if(req.method!=="POST")return send(res,405,{error:"method-not-allowed"});
  const body=req.body||{};
  if(body.action==="places"){
    try{
      const results=await googleTextSearch({
        origin:body.origin||null,
        query:body.query,
        lang:body.lang||"uk",
        radiusKm:body.radiusKm||30,
        limit:body.limit||12
      });
      return send(res,200,{provider:"google",results});
    }catch(error){
      return send(res,error?.status||503,{error:error?.message||"google-places-unavailable"});
    }
  }
  return send(res,503,{
    error:"google-route-not-configured",
    fallback_provider:"OpenStreetMap",
    google_maps_links_enabled:true
  });
}