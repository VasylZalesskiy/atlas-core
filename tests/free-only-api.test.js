import test from "node:test";
import assert from "node:assert/strict";
import brainHandler from "../api/brain.js";
import externalSearchHandler from "../api/external-search.js";
import googleMapsHandler from "../api/google-maps.js";
import {isExplicitlyFreeModel} from "../api/_free-ai.js";

function recorder(){
  return {
    statusCode:0,
    headers:{},
    body:null,
    status(code){this.statusCode=code;return this},
    setHeader(name,value){this.headers[name]=value;return this},
    end(value){this.body=JSON.parse(value);return this}
  };
}

test("accepts only approved models whose catalog price is zero",()=>{
  assert.equal(isExplicitlyFreeModel({id:"inclusionai/ling-3.0-tiny-free",tags:["free"],pricing:{}}),true);
  assert.equal(isExplicitlyFreeModel({id:"poolside/laguna-s-2.1-free",tags:[],pricing:{input:"0",output:"0"}}),true);
  assert.equal(isExplicitlyFreeModel({id:"poolside/laguna-s-2.1-free",tags:[],pricing:{input:"0",output:"0.1"}}),false);
  assert.equal(isExplicitlyFreeModel({id:"openai/gpt-paid",tags:["free"],pricing:{}}),false);
});

test("Brain never uses a legacy OpenAI key and falls back with HTTP 200",async()=>{
  const originalFetch=globalThis.fetch;
  const previous={
    oidc:process.env.VERCEL_OIDC_TOKEN,
    gateway:process.env.AI_GATEWAY_API_KEY,
    openai:process.env.OPENAI_API_KEY
  };
  delete process.env.VERCEL_OIDC_TOKEN;
  delete process.env.AI_GATEWAY_API_KEY;
  process.env.OPENAI_API_KEY="must-not-be-used";
  globalThis.fetch=async()=>{throw new Error("unexpected-network-call")};
  try{
    const res=recorder();
    await brainHandler({method:"POST",body:{query:"100 кг гороху",language:"uk",location_text:"Тернопіль"},headers:{}},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.ai_status,"fallback");
    assert.equal(res.body.model,"deterministic/free");
    assert.ok(res.body.plan.external_searches.some(item=>item.source==="marketplace"));
    assert.ok(res.body.plan.external_searches.some(item=>item.source==="maps"));
  }finally{
    globalThis.fetch=originalFetch;
    if(previous.oidc===undefined)delete process.env.VERCEL_OIDC_TOKEN;else process.env.VERCEL_OIDC_TOKEN=previous.oidc;
    if(previous.gateway===undefined)delete process.env.AI_GATEWAY_API_KEY;else process.env.AI_GATEWAY_API_KEY=previous.gateway;
    if(previous.openai===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous.openai;
  }
});

test("external commerce search returns OLX, Rozetka, Prom and Google Maps without an API call",async()=>{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>{throw new Error("unexpected-network-call")};
  try{
    const res=recorder();
    await externalSearchHandler({
      method:"POST",
      body:{
        goal:"100 кг гороху",
        domain:"agriculture",
        location_text:"Тернопіль",
        language:"uk",
        searches:[{source:"marketplace",query:"купити 100 кг гороху",reason:"придбати"}]
      }
    },res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.paid_search_disabled,true);
    assert.deepEqual(new Set(res.body.results.map(item=>item.source_name)),new Set(["OLX","Rozetka","Prom.ua","Google Maps"]));
  }finally{
    globalThis.fetch=originalFetch;
  }
});

test("paid Google Places API remains disabled even when a key exists",async()=>{
  const previous=process.env.GOOGLE_MAPS_API_KEY;
  process.env.GOOGLE_MAPS_API_KEY="must-not-be-used";
  try{
    const res=recorder();
    await googleMapsHandler({method:"GET"},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.google_maps_key_configured,false);
    assert.equal(res.body.paid_google_maps_api_disabled,true);
    assert.equal(res.body.google_maps_links_enabled,true);
  }finally{
    if(previous===undefined)delete process.env.GOOGLE_MAPS_API_KEY;else process.env.GOOGLE_MAPS_API_KEY=previous;
  }
});
