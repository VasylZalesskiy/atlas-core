import {
  buildMarketplaceShortcuts,extractRequestedTonnes,hostname,isProductTransaction,rankMarketplaceResults
} from "./_search-utils.js";

function send(res,status,body){
  res.status(status).setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.end(JSON.stringify(body));
}

function cleanText(value){return String(value||"").replace(/\s+/g," ").trim()}
function logAnalytics(event,data={}){console.log(JSON.stringify({level:"info",message:"atlas-analytics",event,...data}))}

function webSearchAction(query,{official=false,language="uk"}={}){
  const searchQuery=official?`site:gov.ua ${query}`:query;
  const url=`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
  return {
    title:official
      ?(language==="uk"?"Пошук в офіційних джерелах":"Search official sources")
      :(language==="uk"?"Пошук у відкритому інтернеті":"Search the open web"),
    snippet:language==="uk"
      ?"Готовий пошук без вигаданих результатів — перевірте актуальність інформації у відкритому джерелі"
      :"Prepared search without invented results — verify current information in the source",
    url,
    source_type:official?"official":"web",
    source_name:"Google Search",
    source_group:official?"official-web":"open-web",
    result_kind:"search_page",
    price_text:"",
    location_text:"",
    quantity_tonnes:null,
    quantity_text:"",
    verification_text:language==="uk"?"Це посилання на пошук, а не твердження про знайдений результат":"This is a search link, not a claim that a result was found"
  };
}

export default async function handler(req,res){
  const startedAt=Date.now();
  if(req.method==="GET"){
    return send(res,200,{
      status:"atlas-external-search-endpoint-online",
      mode:"zero-cost-actions",
      paid_search_disabled:true,
      sources:["marketplace-links","google-maps-links","google-search-links"]
    });
  }
  if(req.method!=="POST")return send(res,405,{error:"method-not-allowed"});

  let body={};
  try{body=typeof req.body==="string"?JSON.parse(req.body||"{}"):req.body||{}}
  catch{return send(res,400,{error:"invalid-json"})}

  const searches=Array.isArray(body.searches)?body.searches.slice(0,4):[];
  const goal=cleanText(body.goal).slice(0,700);
  const domain=cleanText(body.domain).slice(0,160);
  const locationText=cleanText(body.location_text).slice(0,200);
  const language=body.language==="en"?"en":"uk";
  const allowed=searches.filter(item=>item&&["web","marketplace","official"].includes(item.source)).map(item=>({
    source:item.source,query:cleanText(item.query).slice(0,400),reason:cleanText(item.reason).slice(0,300)
  })).filter(item=>item.query);

  if(!goal||!allowed.length)return send(res,200,{results:[],sources_checked:[],search_status:"no-searches",attempts:0});

  const commerceTask=allowed.some(item=>item.source==="marketplace")||isProductTransaction(`${goal} ${domain} ${allowed.map(item=>item.query).join(" ")}`);
  let results=[];
  if(commerceTask){
    const marketplaceQuery=allowed.find(item=>item.source==="marketplace")?.query||allowed[0]?.query||goal;
    results=buildMarketplaceShortcuts({goal,query:marketplaceQuery,locationText,language});
    results=rankMarketplaceResults(results,{requestedTonnes:extractRequestedTonnes(`${goal} ${marketplaceQuery}`),limit:12});
  }else{
    results=allowed.map(item=>webSearchAction(item.query,{official:item.source==="official",language}));
  }

  const sourcesChecked=[...new Set(results.map(result=>hostname(result.url)).filter(Boolean))];
  logAnalytics("atlas_external_search_completed",{
    mode:"zero-cost-actions",commerce:commerceTask,result_count:results.length,duration_ms:Date.now()-startedAt
  });
  return send(res,200,{
    results,
    sources_checked:sourcesChecked,
    requested_quantity_tonnes:extractRequestedTonnes(`${goal} ${allowed.map(item=>item.query).join(" ")}`),
    search_status:commerceTask?"prepared-marketplace-actions":"prepared-web-actions",
    attempts:0,
    paid_search_disabled:true
  });
}
