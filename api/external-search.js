import {
  buildMarketplaceShortcuts,extractListingQuantityTonnes,extractPriceText,extractRequestedTonnes,
  hostname,inferSourceType,isProductTransaction,marketplaceSearchTerm,rankMarketplaceResults,resultKind,sourceGroupsFor,sourceName
} from "./_search-utils.js";

function send(res,status,body){
  res.status(status).setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.end(JSON.stringify(body));
}

function cleanText(value){return String(value||"").replace(/\s+/g," ").trim()}
function logAnalytics(event,data={}){console.log(JSON.stringify({level:"info",message:"atlas-analytics",event,...data}))}

function decodeEntities(value){
  return String(value||"")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1")
    .replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'")
    .replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(Number(code)||32))
    .replace(/&#x([0-9a-f]+);/gi,(_,code)=>String.fromCodePoint(parseInt(code,16)||32));
}

function stripHtml(value){return cleanText(decodeEntities(String(value||"").replace(/<[^>]+>/g," ")))}

function safeHttpUrl(value){
  try{
    const url=new URL(decodeEntities(value));
    if(!/^https?:$/.test(url.protocol))return "";
    return url.toString();
  }catch{return ""}
}

function unwrapDuckUrl(value){
  const url=safeHttpUrl(value.startsWith("//")?`https:${value}`:value);
  if(!url)return "";
  try{
    const parsed=new URL(url);
    if(/duckduckgo\.com$/i.test(parsed.hostname)&&parsed.pathname.startsWith("/l/")){
      return safeHttpUrl(decodeURIComponent(parsed.searchParams.get("uddg")||""));
    }
  }catch{}
  return url;
}

async function fetchText(url,{language="uk",timeoutMs=5200,browserLike=false}={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(url,{
      headers:{
        "User-Agent":browserLike
          ?"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36"
          :"Mozilla/5.0 (compatible; AtlasSolutionBot/1.0; +https://atlas-core-two.vercel.app/)",
        "Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language":language==="uk"?"uk-UA,uk;q=0.9,en;q=0.6":"en-US,en;q=0.9"
      },
      signal:controller.signal
    });
    if(!response.ok)throw new Error(`search-http-${response.status}`);
    return await response.text();
  }finally{clearTimeout(timer)}
}

function parseBingRss(xml){
  const items=[];
  const blocks=String(xml||"").match(/<item>[\s\S]*?<\/item>/gi)||[];
  for(const block of blocks){
    const title=stripHtml(block.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||"");
    const link=safeHttpUrl(stripHtml(block.match(/<link>([\s\S]*?)<\/link>/i)?.[1]||""));
    const snippet=stripHtml(block.match(/<description>([\s\S]*?)<\/description>/i)?.[1]||"");
    if(title&&link)items.push({title,url:link,snippet});
  }
  return items;
}

function parseDuckHtml(html){
  const anchors=[...String(html||"").matchAll(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  const snippets=[...String(html||"").matchAll(/<(?:a|div)[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div)>/gi)];
  return anchors.map((match,index)=>({
    title:stripHtml(match[2]),
    url:unwrapDuckUrl(match[1]),
    snippet:stripHtml(snippets[index]?.[1]||"")
  })).filter(item=>item.title&&item.url);
}

function googleResultUrl(raw){
  const value=decodeEntities(raw||"");
  if(value.startsWith("/url?")){
    try{
      const parsed=new URL(`https://www.google.com${value}`);
      return safeHttpUrl(parsed.searchParams.get("q")||parsed.searchParams.get("url")||"");
    }catch{return ""}
  }
  return safeHttpUrl(value);
}

function parseGoogleHtml(html){
  const text=String(html||"");
  const items=[];
  const direct=/<a[^>]+href="(https?:\/\/[^"#]+)"[^>]*>[\s\S]{0,700}?<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  const redirect=/<a[^>]+href="(\/url\?[^"#]+)"[^>]*>[\s\S]{0,700}?<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  for(const pattern of [direct,redirect]){
    for(const match of text.matchAll(pattern)){
      const url=googleResultUrl(match[1]);
      const title=stripHtml(match[2]);
      if(!url||!title)continue;
      const tail=text.slice((match.index||0)+match[0].length,(match.index||0)+match[0].length+1800);
      const snippet=stripHtml(tail.match(/<(?:div|span)[^>]+class="[^"]*(?:VwiC3b|yXK7lf|aCOpRe)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|span)>/i)?.[1]||"");
      items.push({title,url,snippet});
    }
  }
  return items;
}

const SEARCH_STOP=new Set([
  "який","яка","яке","які","як","що","де","коли","хто","для","мені","потрібно","потрібен","потрібна","потрібні",
  "купити","куплю","продати","продам","знайти","україна","україні","україни","у","в","на","по","до","від","та","і","або",
  "what","how","where","when","who","need","find","buy","sell","for","the","and","or","in","on","to","from","ukraine",
  "site","com","ua","net","org"
]);

function relevanceTokens(query){
  return String(query||"").toLowerCase()
    .replace(/site:\S+/g," ")
    .replace(/[^\p{L}\p{N}\s-]/gu," ")
    .split(/\s+/)
    .filter(word=>word.length>2&&!SEARCH_STOP.has(word)&&!/^[0-9]+(?:[.,][0-9]+)?$/.test(word))
    .map(word=>word.length>5?word.slice(0,5):word)
    .slice(0,8);
}

function resultRelevance(item,query){
  const tokens=relevanceTokens(query);
  if(!tokens.length)return 1;
  const hay=`${item?.title||""} ${item?.snippet||""}`.toLowerCase();
  let hits=0;
  for(const token of tokens){if(hay.includes(token))hits+=1}
  return hits;
}

function hostMatchesDomain(url,domain){
  const host=hostname(url);
  const target=String(domain||"").replace(/^www\./,"").toLowerCase();
  return Boolean(host&&target&&(host===target||host.endsWith(`.${target}`)));
}

function filterSearchResults(items,query,{expectedDomain="",limit=8}={}){
  const seen=new Set();
  return (items||[])
    .map(item=>({...item,relevance:resultRelevance(item,query)}))
    .filter(item=>item.relevance>0)
    .filter(item=>!expectedDomain||hostMatchesDomain(item.url,expectedDomain))
    .filter(item=>{
      const host=hostname(item.url);
      if(!host||/^(?:www\.)?(?:bing\.com|duckduckgo\.com|google\.com)$/i.test(host))return false;
      const key=item.url.replace(/[#?].*$/,"_");
      if(seen.has(key))return false;
      seen.add(key);return true;
    })
    .sort((a,b)=>b.relevance-a.relevance)
    .slice(0,limit)
    .map(({relevance,...item})=>item);
}

async function liveWebSearch(query,{language="uk",limit=8,expectedDomain=""}={}){
  const q=cleanText(query).slice(0,450);
  if(!q)return [];
  const out=[];

  try{
    const region=language==="uk"?"ua-uk":"us-en";
    const html=await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}&kl=${region}`,{language});
    out.push(...parseDuckHtml(html));
  }catch{}

  let filtered=filterSearchResults(out,q,{expectedDomain,limit});
  if(filtered.length>=Math.min(3,limit))return filtered;

  try{
    const google=await fetchText(`https://www.google.com/search?hl=${language==="uk"?"uk":"en"}&gl=${language==="uk"?"ua":"us"}&num=10&filter=0&q=${encodeURIComponent(q)}`,{language,browserLike:true});
    out.push(...parseGoogleHtml(google));
  }catch{}

  filtered=filterSearchResults(out,q,{expectedDomain,limit});
  if(filtered.length>=Math.min(3,limit))return filtered;

  try{
    const rss=await fetchText(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(q)}&setlang=${language==="uk"?"uk-UA":"en-US"}&cc=${language==="uk"?"UA":"US"}`,{language});
    out.push(...parseBingRss(rss));
  }catch{}

  return filterSearchResults(out,q,{expectedDomain,limit});
}

function concreteSearchResult(item,{sourceGroup="open-web",language="uk",official=false,commerce=false}={}){
  const text=`${item.title} ${item.snippet}`;
  const type=inferSourceType(item.url);
  const kind=commerce?resultKind(item.url):(official||type==="official"?"official_result":"web_result");
  return {
    title:item.title,
    snippet:item.snippet,
    url:item.url,
    source_type:official?"official":type,
    source_name:sourceName(item.url),
    source_group:sourceGroup,
    result_kind:kind,
    price_text:extractPriceText(text),
    location_text:"",
    quantity_tonnes:extractListingQuantityTonnes(text),
    quantity_text:"",
    verification_text:language==="uk"
      ?"Atlas знайшов цю конкретну сторінку у веб-пошуку. Перевірте актуальність деталей у першоджерелі."
      :"Atlas found this concrete page in web search. Confirm current details at the source."
  };
}

function uniqueResults(items){
  const seen=new Set();
  return items.filter(item=>{
    const key=(item?.url||"").replace(/[#?].*$/,"_")||`${item?.source_name}:${item?.title}`;
    if(seen.has(key))return false;
    seen.add(key);return true;
  });
}

function commerceTargets(groups,limit=14){
  const targets=[];
  let depth=0;
  while(targets.length<limit){
    let added=false;
    for(const group of groups){
      const domain=group.domains?.[depth];
      if(!domain)continue;
      targets.push({group,domain});added=true;
      if(targets.length>=limit)break;
    }
    if(!added)break;
    depth+=1;
  }
  return targets;
}

async function searchCommerce({goal,query,domain,locationText,language}){
  const groups=sourceGroupsFor({source:"marketplace",goal,query,domain}).slice(0,4);
  const term=marketplaceSearchTerm(query)||marketplaceSearchTerm(goal)||cleanText(query||goal);
  const targets=commerceTargets(groups,14);
  const searches=targets.map(async({group,domain:targetDomain})=>{
    const found=await liveWebSearch(`${term} site:${targetDomain}`,{language,limit:6,expectedDomain:targetDomain});
    return found
      .map(item=>concreteSearchResult(item,{sourceGroup:group.id,language,commerce:true}))
      .filter(item=>item.result_kind==="listing");
  });
  let live=[];
  try{live=(await Promise.all(searches)).flat()}catch{}
  live=uniqueResults(live);
  const prepared=buildMarketplaceShortcuts({goal,query,locationText,language});
  const representedSources=new Set(live.map(item=>item.source_name).filter(Boolean));
  const missingSources=prepared.filter(item=>!representedSources.has(item.source_name));
  return rankMarketplaceResults([...live,...missingSources],{
    requestedTonnes:extractRequestedTonnes(`${goal} ${query}`),limit:16
  });
}

async function searchGeneral(allowed,{language}){
  const groups=await Promise.all(allowed.map(async item=>{
    const official=item.source==="official";
    const query=official?`site:gov.ua ${item.query}`:item.query;
    const found=await liveWebSearch(query,{language,limit:6,expectedDomain:official?"gov.ua":""});
    return found.map(result=>concreteSearchResult(result,{
      sourceGroup:official?"official-web":"open-web",language,official,commerce:false
    }));
  }));
  return uniqueResults(groups.flat()).slice(0,12);
}

async function runSearch({goal,domain,locationText,language,allowed}){
  const commerceTask=allowed.some(item=>item.source==="marketplace")||isProductTransaction(`${goal} ${domain} ${allowed.map(item=>item.query).join(" ")}`);
  if(commerceTask){
    const marketplaceQuery=allowed.find(item=>item.source==="marketplace")?.query||allowed[0]?.query||goal;
    const results=await searchCommerce({goal,query:marketplaceQuery,domain,locationText,language});
    return {results,commerceTask};
  }
  return {results:await searchGeneral(allowed,{language}),commerceTask};
}

export default async function handler(req,res){
  const startedAt=Date.now();
  if(req.method==="GET"){
    const q=cleanText(req.query?.q).slice(0,450);
    if(!q)return send(res,200,{
      status:"atlas-external-search-endpoint-online",
      mode:"live-zero-cost-web-search",
      paid_search_disabled:true,
      sources:["duckduckgo-html","google-html","bing-rss-fallback"],
      relevance_filter:true
    });
    const language=req.query?.lang==="en"?"en":"uk";
    const {results}=await runSearch({goal:q,domain:"",locationText:"",language,allowed:[{source:"web",query:q,reason:"debug"}]});
    return send(res,200,{results,search_status:results.length?"live-web-results":"no-live-results",attempts:1,paid_search_disabled:true});
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

  const {results,commerceTask}=await runSearch({goal,domain,locationText,language,allowed});
  const sourcesChecked=[...new Set(results.map(result=>hostname(result.url)).filter(Boolean))];
  logAnalytics("atlas_external_search_completed",{
    mode:"live-zero-cost-web-search",commerce:commerceTask,result_count:results.length,duration_ms:Date.now()-startedAt
  });
  return send(res,200,{
    results,
    sources_checked:sourcesChecked,
    requested_quantity_tonnes:extractRequestedTonnes(`${goal} ${allowed.map(item=>item.query).join(" ")}`),
    search_status:results.length?"live-results":"no-live-results",
    attempts:1,
    paid_search_disabled:true
  });
}
