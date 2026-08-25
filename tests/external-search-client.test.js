import test from "node:test";
import assert from "node:assert/strict";
import {searchExternalSources} from "../src/services/externalSearch.js";

const commercePlan={
  goal:"100 кг гороху",
  domain:"agriculture",
  location_text:"Тернопіль",
  external_searches:[{source:"marketplace",query:"купити 100 кг гороху",reason:"придбати"}]
};

test("keeps prepared known-source actions when live commerce pages are unavailable",async()=>{
  const originalFetch=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async url=>{
    calls.push(String(url));
    if(String(url)==="/api/grounded-search"){
      return new Response(JSON.stringify({results:[]}),{status:200,headers:{"Content-Type":"application/json"}});
    }
    if(String(url)==="/api/external-search"){
      return new Response(JSON.stringify({results:[
        {title:"Горох — Rozetka",url:"https://rozetka.com.ua/ua/search/?text=goroh",source_name:"Rozetka",source_type:"marketplace",result_kind:"search_page"},
        {title:"Магазини: горох",url:"https://www.google.com/maps/search/?api=1&query=goroh",source_name:"Google Maps",source_type:"maps",result_kind:"maps_search"}
      ]}),{status:200,headers:{"Content-Type":"application/json"}});
    }
    throw new Error(`unexpected-url:${url}`);
  };
  try{
    const results=await searchExternalSources(commercePlan,{lang:"uk"});
    assert.deepEqual(calls,["/api/grounded-search","/api/external-search"]);
    assert.ok(results.some(item=>item.source_name==="Rozetka"&&item.result_kind==="search_page"));
    assert.ok(results.some(item=>item.source_name==="Google Maps"&&item.result_kind==="maps_search"));
  }finally{
    globalThis.fetch=originalFetch;
  }
});

test("adds known marketplace actions after a concrete grounded result",async()=>{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async url=>{
    assert.equal(String(url),"/api/grounded-search");
    return new Response(JSON.stringify({results:[{
      title:"Горох колотий 1 кг",
      url:"https://example.com/products/goroh-1kg",
      source_name:"Example",
      source_type:"marketplace",
      result_kind:"listing"
    }]}),{status:200,headers:{"Content-Type":"application/json"}});
  };
  try{
    const results=await searchExternalSources(commercePlan,{lang:"uk"});
    assert.equal(results[0].result_kind,"listing");
    assert.ok(results.some(item=>item.source_name==="Сільпо"&&item.result_kind==="search_page"));
    assert.ok(results.some(item=>item.source_name==="OLX"&&item.result_kind==="search_page"));
  }finally{
    globalThis.fetch=originalFetch;
  }
});
