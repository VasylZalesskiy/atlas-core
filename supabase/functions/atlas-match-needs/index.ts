import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS"
};

const metaMarker="\u2063ATLAS_META:";

function normalize(value:string){
  return String(value||"").toLowerCase().replace(/[.,!?;:()]/g," ").replace(/\s+/g," ").trim();
}

function decodeMeta(text:string){
  const raw=String(text||"");
  const index=raw.lastIndexOf(metaMarker);
  if(index<0)return {plain:raw,meta:null};
  const plain=raw.slice(0,index).trim();
  try{return {plain,meta:JSON.parse(decodeURIComponent(raw.slice(index+metaMarker.length)))};}catch{return {plain,meta:null};}
}

function legacyMatches(text:string,itemKey:string){
  const haystack=normalize(text);
  const aliases:Record<string,string[]>={
    tomatoes:["томат","томати","помідор","помідори","tomato","tomatoes"],
    potatoes:["картоп","картопля","potato","potatoes"],
    onions:["цибул","цибуля","onion","onions"],
    carrots:["моркв","морква","carrot","carrots"],
    cabbage:["капуст","капуста","cabbage"],
    beet:["буряк","буряки","beet","beets"]
  };
  const terms=aliases[itemKey]||[];
  return terms.some(term=>haystack.includes(normalize(term)));
}

const freeTextStopWords=new Set(["потрібно","потрібна","потрібен","потрібні","шукаю","треба","можу","можемо","маю","продаю","продам","надам","допоможу","послуга","послуги","товар","товари","need","looking","provide","offer","have","with","from","this","that","для","мені","нам","ваша","вашою","свою","своїми"]);
function freeTextTokens(value:string){
  return normalize(value).split(" ").map(word=>word.replace(/[^a-zа-яіїєґ0-9-]/gi,"")).filter(word=>word.length>=4&&!freeTextStopWords.has(word)).map(word=>word.length>5?word.slice(0,5):word);
}
function freeTextMatches(opportunityText:string,needText:string){
  const opportunityTokens=freeTextTokens(opportunityText);
  const needTokens=new Set(freeTextTokens(needText));
  if(!opportunityTokens.length||!needTokens.size)return false;
  return opportunityTokens.some(token=>needTokens.has(token));
}

function quantityInNeedUnit(quantity:number|null|undefined,saleUnit:string,needUnit:string){
  if(!Number.isFinite(Number(quantity)))return null;
  const q=Number(quantity);
  const from=String(saleUnit||"").toLowerCase().replace("шт.","шт");
  const to=String(needUnit||"").toLowerCase().replace("шт.","шт");
  if(from===to)return q;
  if(from==="т"&&(to==="кг"||to==="kg"))return q*1000;
  if((from==="кг"||from==="kg")&&to==="т")return q/1000;
  return null;
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return new Response(JSON.stringify({error:"method-not-allowed"}),{status:405,headers:{...corsHeaders,"Content-Type":"application/json"}});

  try{
    const authHeader=req.headers.get("Authorization")||"";
    const token=authHeader.replace(/^Bearer\s+/i,"").trim();
    if(!token)return new Response(JSON.stringify({error:"unauthorized"}),{status:401,headers:{...corsHeaders,"Content-Type":"application/json"}});

    const url=Deno.env.get("SUPABASE_URL")!;
    const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:userData,error:userError}=await supabase.auth.getUser(token);
    if(userError||!userData?.user)return new Response(JSON.stringify({error:"unauthorized"}),{status:401,headers:{...corsHeaders,"Content-Type":"application/json"}});

    const body=await req.json().catch(()=>({}));
    const opportunityId=String(body?.opportunityId||"").trim();
    if(!opportunityId)return new Response(JSON.stringify({error:"opportunity-required"}),{status:400,headers:{...corsHeaders,"Content-Type":"application/json"}});

    const now=new Date().toISOString();
    const today=now.slice(0,10);
    const {data:opportunity,error:opportunityError}=await supabase
      .from("atlas_opportunities")
      .select("id,owner_id,text,is_active,expires_at")
      .eq("id",opportunityId)
      .eq("owner_id",userData.user.id)
      .eq("is_active",true)
      .gt("expires_at",now)
      .maybeSingle();
    if(opportunityError)throw opportunityError;
    if(!opportunity)return new Response(JSON.stringify({matches:[]}),{headers:{...corsHeaders,"Content-Type":"application/json"}});

    const decoded=decodeMeta(opportunity.text);
    const catalogItemKey=String(decoded.meta?.catalogItemKey||"");
    const catalogGroupKey=String(decoded.meta?.catalogGroupKey||"");
    const saleQuantity=Number(decoded.meta?.saleQuantity);
    const saleUnit=String(decoded.meta?.saleUnit||"");
    const validUntil=String(decoded.meta?.validUntil||"");
    if(validUntil&&validUntil<today)return new Response(JSON.stringify({matches:[]}),{headers:{...corsHeaders,"Content-Type":"application/json"}});

    let opportunityFamily="";
    if(catalogItemKey){
      const {data:item}=await supabase.from("atlas_need_items").select("family_code").eq("item_key",catalogItemKey).maybeSingle();
      opportunityFamily=String(item?.family_code||"");
    }

    const {data:needs,error:needsError}=await supabase
      .from("atlas_needs")
      .select("id,passport_id,group_key,item_key,description,quantity,unit,needed_from,needed_until,status")
      .eq("status","not_received")
      .lte("needed_from",today)
      .gte("needed_until",today)
      .neq("owner_id",userData.user.id)
      .limit(300);
    if(needsError)throw needsError;

    const needKeys=[...new Set((needs||[]).map(need=>need.item_key).filter(Boolean))];
    let needFamilies=new Map<string,string>();
    if(needKeys.length){
      const {data:catalogRows}=await supabase.from("atlas_need_items").select("item_key,family_code").in("item_key",needKeys);
      needFamilies=new Map((catalogRows||[]).map(row=>[String(row.item_key),String(row.family_code||"")]));
    }

    const matching=(needs||[]).filter(need=>{
      const freeDescription=String(need.description||"").trim();
      if(freeDescription)return freeTextMatches(decoded.plain,freeDescription);
      if(catalogItemKey){
        if(need.item_key===catalogItemKey)return !catalogGroupKey||need.group_key===catalogGroupKey;
        const needFamily=needFamilies.get(String(need.item_key))||"";
        if(opportunityFamily&&needFamily&&opportunityFamily===needFamily)return !catalogGroupKey||need.group_key===catalogGroupKey;
        return false;
      }
      return legacyMatches(decoded.plain,need.item_key);
    });

    const passportIds=[...new Set(matching.map(need=>need.passport_id).filter(Boolean))];
    let passports:any[]=[];
    if(passportIds.length){
      const {data,error}=await supabase.from("atlas_passports").select("id,slug,display_name,city").in("id",passportIds);
      if(error)throw error;
      passports=data||[];
    }
    const byPassport=new Map(passports.map(item=>[item.id,item]));

    const matches=matching.map(need=>{
      const passport=byPassport.get(need.passport_id);
      const available=quantityInNeedUnit(saleQuantity,saleUnit,need.unit);
      return {
        need_id:need.id,
        passport_slug:passport?.slug||"",
        display_name:passport?.display_name||"Користувач Atlas",
        city:passport?.city||"",
        group_key:need.group_key,
        item_key:need.item_key,
        description:need.description||"",
        matched_by:need.description?"free_text":catalogItemKey?(need.item_key===catalogItemKey?"item_id":"family_id"):"legacy_text",
        opportunity_item_key:catalogItemKey||null,
        quantity:Number(need.quantity),
        unit:need.unit,
        needed_from:need.needed_from,
        needed_until:need.needed_until,
        available_quantity:available,
        coverage:available==null?"unknown":available>=Number(need.quantity)?"full":"partial"
      };
    }).filter(item=>item.passport_slug);

    return new Response(JSON.stringify({matches}),{headers:{...corsHeaders,"Content-Type":"application/json"}});
  }catch(error){
    console.error("atlas-match-needs",error);
    return new Response(JSON.stringify({error:"match-failed"}),{status:500,headers:{...corsHeaders,"Content-Type":"application/json"}});
  }
});