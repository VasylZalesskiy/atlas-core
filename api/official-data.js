function send(res,status,body){
  res.status(status).setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.end(JSON.stringify(body));
}

function clean(value){return String(value||"").replace(/\s+/g," ").trim()}

function currencyCode(text){
  const q=String(text||"").toLowerCase();
  if(/\b(?:usd|долар|доллар)\b/u.test(q))return "USD";
  if(/\b(?:eur|євро|евро)\b/u.test(q))return "EUR";
  if(/\b(?:pln|злот)/u.test(q))return "PLN";
  if(/\b(?:gbp|фунт)/u.test(q))return "GBP";
  if(/\b(?:chf|франк)/u.test(q))return "CHF";
  return "";
}

async function nbuRate(code){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),7000);
  try{
    const response=await fetch(`https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json&valcode=${encodeURIComponent(code)}`,{
      headers:{Accept:"application/json"},
      signal:controller.signal
    });
    if(!response.ok)throw new Error(`nbu-${response.status}`);
    const data=await response.json();
    const row=(Array.isArray(data)?data:[]).find(item=>String(item?.cc||"").toUpperCase()===code);
    if(!row||!Number.isFinite(Number(row.rate)))throw new Error("nbu-empty");
    return row;
  }finally{clearTimeout(timer)}
}

export default async function handler(req,res){
  if(req.method==="GET"&&!req.query?.q)return send(res,200,{status:"atlas-official-data-online",providers:["NBU"]});
  if(!["GET","POST"].includes(req.method))return send(res,405,{error:"method-not-allowed"});
  let body={};
  if(req.method==="POST"){
    try{body=typeof req.body==="string"?JSON.parse(req.body||"{}"):req.body||{}}catch{return send(res,400,{error:"invalid-json"})}
  }
  const query=clean(req.method==="GET"?req.query?.q:body.query||body.goal);
  const language=(req.method==="GET"?req.query?.lang:body.language)==="en"?"en":"uk";
  const code=currencyCode(query);
  if(!code)return send(res,200,{results:[],search_status:"unsupported-official-query"});
  try{
    const row=await nbuRate(code);
    const rate=Number(row.rate);
    const date=String(row.exchangedate||"");
    const name=String(row.txt||code);
    const snippet=language==="uk"
      ?`Офіційний курс НБУ: 1 ${code} = ${rate.toFixed(4)} грн. Дата курсу: ${date}.`
      :`Official NBU rate: 1 ${code} = UAH ${rate.toFixed(4)}. Rate date: ${date}.`;
    return send(res,200,{results:[{
      title:language==="uk"?`Офіційний курс ${code} — НБУ`:`Official ${code} rate — NBU`,
      snippet,
      url:`https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json&valcode=${code}`,
      source_type:"official",
      source_name:language==="uk"?"Національний банк України":"National Bank of Ukraine",
      source_group:"official-data",
      result_kind:"official_result",
      price_text:"",
      location_text:"",
      quantity_tonnes:null,
      quantity_text:"",
      verification_text:language==="uk"?`Дані отримані напряму з API НБУ. ${name}.`:`Data received directly from the NBU API. ${name}.`
    }],search_status:"official-result",provider:"NBU",currency:code,rate,date});
  }catch(error){
    return send(res,502,{results:[],search_status:"official-provider-unavailable",provider:"NBU",error:String(error?.message||"nbu-error")});
  }
}
