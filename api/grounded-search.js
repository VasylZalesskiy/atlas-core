function send(res,status,body){
  res.status(status).setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.end(JSON.stringify(body));
}

export default async function handler(req,res){
  if(req.method==="GET")return send(res,200,{
    status:"atlas-grounded-search-disabled",
    configured:false,
    provider:"disabled",
    paid_ai_disabled:true,
    reason:"Atlas is running in zero-cost search mode"
  });
  if(req.method!=="POST")return send(res,405,{error:"method-not-allowed"});
  return send(res,200,{
    results:[],
    configured:false,
    search_status:"paid-ai-disabled",
    source_count:0,
    paid_ai_disabled:true
  });
}
