import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS"
};

function send(status:number,body:unknown){
  return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
}
function normalize(value:unknown){
  return String(value||"").toLowerCase().replace(/[.,!?;:()]/g," ").replace(/\s+/g," ").trim();
}
const stop=new Set(["потрібно","потрібна","потрібен","потрібні","шукаю","треба","хочу","купити","знайти","мені","для","та","або","кг","кілограм","кілограмів","need","want","find","buy","for","kg"]);
function tokens(value:unknown){
  return normalize(value).split(" ")
    .map(word=>word.replace(/[^a-zа-яіїєґ0-9-]/gi,""))
    .filter(word=>word.length>=3&&!stop.has(word)&&!/^[0-9]+$/.test(word))
    .map(word=>word.length>5?word.slice(0,5):word);
}
function scoreNeed(need:any,searchTokens:Set<string>){
  const hay=tokens([need.description,need.item_key,need.group_key,need.unit].filter(Boolean).join(" "));
  let score=0;
  const matched:string[]=[];
  for(const token of hay){
    if(searchTokens.has(token)){score+=8;if(!matched.includes(token))matched.push(token)}
  }
  const description=normalize(need.description);
  for(const token of searchTokens){
    if(description.includes(token)){score+=3;if(!matched.includes(token))matched.push(token)}
  }
  return {score,matched};
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return send(405,{error:"method-not-allowed"});

  let body:any={};
  try{body=await req.json()}catch{return send(400,{error:"invalid-json"})}
  const query=String(body?.query||"").trim().slice(0,1000);
  const supplied=Array.isArray(body?.terms)?body.terms:[];
  if(!query)return send(200,{matches:[]});

  const authHeader=req.headers.get("Authorization")||"";
  const url=Deno.env.get("SUPABASE_URL")||"";
  const anon=Deno.env.get("SUPABASE_ANON_KEY")||"";
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!url||!anon||!serviceKey)return send(500,{error:"server-not-configured"});

  const authClient=createClient(url,anon,{global:{headers:{Authorization:authHeader}}});
  const {data:{user}}=await authClient.auth.getUser();
  if(!user)return send(401,{error:"unauthorized"});

  const service=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const today=new Date().toISOString().slice(0,10);
  const {data:needs,error}=await service.from("atlas_needs")
    .select("id,passport_id,owner_id,group_key,item_key,description,quantity,unit,needed_from,needed_until,status,created_at")
    .eq("status","not_received")
    .gte("needed_until",today)
    .neq("owner_id",user.id)
    .order("created_at",{ascending:false})
    .limit(300);
  if(error)return send(500,{error:error.message});

  const searchTokens=new Set(tokens([query,...supplied].join(" ")));
  const ranked=(needs||[]).map(need=>({...need,...scoreNeed(need,searchTokens)}))
    .filter(item=>item.score>0)
    .sort((a,b)=>b.score-a.score)
    .slice(0,Math.max(1,Math.min(Number(body?.limit)||12,30)));

  const ids=[...new Set(ranked.map(item=>item.passport_id).filter(Boolean))];
  let passports:any[]=[];
  if(ids.length){
    const {data,error:passportError}=await service.from("atlas_passports")
      .select("id,slug,display_name,city,profession")
      .in("id",ids);
    if(passportError)return send(500,{error:passportError.message});
    passports=passports||data||[];
  }
  const byId=new Map(passports.map(item=>[item.id,item]));
  const matches=ranked.map(item=>{
    const passport=byId.get(item.passport_id)||{};
    return {
      need_id:item.id,
      passport_id:item.passport_id,
      passport_slug:passport.slug||"",
      display_name:passport.display_name||"",
      city:passport.city||"",
      profession:passport.profession||"",
      description:item.description||"",
      group_key:item.group_key||"",
      item_key:item.item_key||"",
      quantity:item.quantity,
      unit:item.unit||"",
      needed_until:item.needed_until||"",
      score:item.score,
      matched:item.matched
    };
  });

  return send(200,{matches});
});