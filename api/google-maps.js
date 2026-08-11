function send(res,status,body){
  res.status(status).setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.end(JSON.stringify(body));
}

export default async function handler(req,res){
  if(req.method==="GET"){
    return send(res,200,{
      status:"atlas-maps-zero-cost-mode",
      google_maps_key_configured:false,
      paid_google_maps_api_disabled:true,
      fallback_provider:"OpenStreetMap",
      google_maps_links_enabled:true
    });
  }
  if(req.method!=="POST")return send(res,405,{error:"method-not-allowed"});
  return send(res,503,{
    error:"paid-google-maps-api-disabled",
    fallback_provider:"OpenStreetMap",
    google_maps_links_enabled:true
  });
}
