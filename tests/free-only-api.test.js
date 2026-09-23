import test from "node:test";
import assert from "node:assert/strict";
import brainHandler from "../api/brain.js";
import externalSearchHandler from "../api/external-search.js";
import groundedSearchHandler from "../api/grounded-search.js";
import googleMapsHandler from "../api/google-maps.js";
import {FREE_AI_MODEL} from "../api/_free-ai.js";
import {OPENAI_AI_MODEL} from "../api/_openai-ai.js";

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

test("pins Atlas to the Gemini model documented for the free tier",()=>{
  assert.equal(FREE_AI_MODEL,"gemini-3.5-flash-lite");
});

test("pins Atlas Brain to the current OpenAI provider by default",()=>{
  assert.equal(OPENAI_AI_MODEL,"gpt-6-sol");
});

test("Brain never calls Qwen when the OpenAI key is unavailable",async()=>{
  const originalFetch=globalThis.fetch;
  const previous={
    openai:process.env.OPENAI_API_KEY,
    gemini:process.env.GEMINI_FREE_TIER_API_KEY,
    qwen:process.env.DASHSCOPE_API_KEY
  };
  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_FREE_TIER_API_KEY;
  process.env.DASHSCOPE_API_KEY="must-not-be-used";
  globalThis.fetch=async()=>{throw new Error("unexpected-network-call")};
  try{
    const res=recorder();
    await brainHandler({method:"POST",body:{query:"100 кг гороху",language:"uk",location_text:"Тернопіль"},headers:{}},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.ai_status,"fallback");
    assert.equal(res.body.model,"deterministic/free");
    assert.ok(res.body.plan.external_searches.some(item=>item.source==="marketplace"));
  }finally{
    globalThis.fetch=originalFetch;
    if(previous.openai===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous.openai;
    if(previous.gemini===undefined)delete process.env.GEMINI_FREE_TIER_API_KEY;else process.env.GEMINI_FREE_TIER_API_KEY=previous.gemini;
    if(previous.qwen===undefined)delete process.env.DASHSCOPE_API_KEY;else process.env.DASHSCOPE_API_KEY=previous.qwen;
  }
});

test("Brain always uses deterministic safety triage for a bodily symptom",async()=>{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>{throw new Error("unexpected-network-call")};
  try{
    const res=recorder();
    await brainHandler({method:"POST",body:{query:"болить живіт",language:"uk"},headers:{}},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.ai_status,"safety");
    assert.equal(res.body.model,"deterministic/safety");
    assert.equal(res.body.plan.domain,"health");
    assert.equal(res.body.plan.clarification.required,true);
    assert.equal(res.body.plan.external_searches.length,0);
  }finally{
    globalThis.fetch=originalFetch;
  }
});

test("Brain uses Gemini fallback only when OpenAI is unavailable",async()=>{
  const originalFetch=globalThis.fetch;
  const previous={openai:process.env.OPENAI_API_KEY,gemini:process.env.GEMINI_FREE_TIER_API_KEY};
  delete process.env.OPENAI_API_KEY;
  process.env.GEMINI_FREE_TIER_API_KEY="gemini-free-key";
  const calls=[];
  const plan={
    understood:true,goal:"100 кг гороху",intent:"buy",domain:"agriculture",solution_scope:"transaction",urgency:"planned",needs_location:true,
    clarification:{required:false,question:"",options:[]},
    passport_search:{terms:["горох"],capability_description:"Постачальники гороху"},
    solution_steps:[{id:"buy",title:"Знайти горох",purpose:"Придбати 100 кг гороху",passport_terms:["горох"],nearby_query:"горох магазин",internet_query:"купити 100 кг гороху",nearby_relevant:true,internet_relevant:true}],
    external_searches:[{source:"maps",mode:"nearby",query:"горох магазин",reason:"знайти поруч"},{source:"marketplace",mode:"standard",query:"купити 100 кг гороху",reason:"знайти пропозиції"}],
    safety:{level:"none",message:""},result_strategy:"Паспорти, магазини поруч, маркетплейси"
  };
  globalThis.fetch=async(url,options={})=>{
    calls.push({url:String(url),apiKey:options.headers?.["x-goog-api-key"]||""});
    if(String(url).includes("generativelanguage.googleapis.com"))return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(plan)}]}}]}),{status:200,headers:{"Content-Type":"application/json"}});
    throw new Error("unexpected-url");
  };
  try{
    const res=recorder();
    await brainHandler({method:"POST",body:{query:"100 кг гороху",language:"uk"},headers:{}},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.ai_status,"free-ai");
    assert.equal(res.body.model,"gemini-3.5-flash-lite");
    assert.ok(calls.some(call=>call.url.includes("generativelanguage.googleapis.com")&&call.apiKey==="gemini-free-key"));
    assert.ok(calls.every(call=>!call.url.includes("api.openai.com")));
  }finally{
    globalThis.fetch=originalFetch;
    if(previous.openai===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous.openai;
    if(previous.gemini===undefined)delete process.env.GEMINI_FREE_TIER_API_KEY;else process.env.GEMINI_FREE_TIER_API_KEY=previous.gemini;
  }
});

test("Brain uses OpenAI Responses as the primary Atlas provider",async()=>{
  const originalFetch=globalThis.fetch;
  const previous={
    openai:process.env.OPENAI_API_KEY,
    model:process.env.OPENAI_MODEL,
    gemini:process.env.GEMINI_FREE_TIER_API_KEY,
    qwen:process.env.DASHSCOPE_API_KEY
  };
  process.env.OPENAI_API_KEY="openai-test-key";
  process.env.OPENAI_MODEL="gpt-6-sol";
  process.env.GEMINI_FREE_TIER_API_KEY="must-not-be-used";
  process.env.DASHSCOPE_API_KEY="must-not-be-used";
  const plan={
    understood:true,goal:"100 кг гороху",intent:"buy",domain:"agriculture",solution_scope:"transaction",urgency:"planned",needs_location:true,
    clarification:{required:false,question:"",options:[]},
    passport_search:{terms:["горох"],capability_description:"Постачальники гороху"},
    solution_steps:[{id:"buy",title:"Знайти горох",purpose:"Придбати 100 кг гороху",passport_terms:["горох"],nearby_query:"",internet_query:"купити 100 кг гороху",nearby_relevant:false,internet_relevant:true}],
    external_searches:[{source:"marketplace",mode:"standard",query:"купити 100 кг гороху",reason:"знайти пропозиції"}],
    safety:{level:"none",message:""},result_strategy:"Паспорти, потім перевірені пропозиції",answer:""
  };
  const calls=[];
  globalThis.fetch=async(url,options={})=>{
    calls.push({url:String(url),headers:options.headers||{},body:JSON.parse(options.body||"{}")});
    if(String(url)==="https://api.openai.com/v1/responses"){
      return new Response(JSON.stringify({status:"completed",model:"gpt-6-sol",output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(plan)}]}]}),{status:200,headers:{"Content-Type":"application/json"}});
    }
    throw new Error(`unexpected-url:${url}`);
  };
  try{
    const res=recorder();
    await brainHandler({method:"POST",body:{query:"100 кг гороху",language:"uk",location_text:"Тернопіль"},headers:{}},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.ai_status,"openai");
    assert.equal(res.body.model,"gpt-6-sol");
    assert.equal(calls.length,1);
    assert.equal(calls[0].headers.Authorization,"Bearer openai-test-key");
    assert.equal(calls[0].body.text.format.type,"json_schema");
    assert.equal(calls[0].body.text.format.name,"atlas_brain_plan");
    assert.equal(calls[0].body.model,"gpt-6-sol");
  }finally{
    globalThis.fetch=originalFetch;
    if(previous.openai===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous.openai;
    if(previous.model===undefined)delete process.env.OPENAI_MODEL;else process.env.OPENAI_MODEL=previous.model;
    if(previous.gemini===undefined)delete process.env.GEMINI_FREE_TIER_API_KEY;else process.env.GEMINI_FREE_TIER_API_KEY=previous.gemini;
    if(previous.qwen===undefined)delete process.env.DASHSCOPE_API_KEY;else process.env.DASHSCOPE_API_KEY=previous.qwen;
  }
});

test("grounded search uses OpenAI web_search and returns cited sources",async()=>{
  const originalFetch=globalThis.fetch;
  const previous=process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY="openai-test-key";
  let requestBody=null;
  globalThis.fetch=async(url,options={})=>{
    assert.equal(String(url),"https://api.openai.com/v1/responses");
    requestBody=JSON.parse(options.body||"{}");
    return new Response(JSON.stringify({
      status:"completed",model:"gpt-6-luna",
      output:[
        {type:"web_search_call",action:{type:"search",sources:[{url:"https://example.com/answer",title:"Перевірене джерело"}]}},
        {type:"message",content:[{type:"output_text",text:"Знайдено актуальний перевірений варіант.",annotations:[{type:"url_citation",url:"https://example.com/answer",title:"Перевірене джерело"}]}]}
      ]
    }),{status:200,headers:{"Content-Type":"application/json"}});
  };
  try{
    const res=recorder();
    await groundedSearchHandler({method:"POST",body:{goal:"знайти рішення",query:"актуальний варіант",language:"uk"}},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.configured,true);
    assert.equal(res.body.search_status,"grounded-answer");
    assert.ok(res.body.results.some(item=>item.url==="https://example.com/answer"));
    assert.deepEqual(requestBody.tools,[{type:"web_search",search_context_size:"low"}]);
    assert.equal(requestBody.tool_choice,"required");
    assert.deepEqual(requestBody.include,["web_search_call.action.sources"]);
  }finally{
    globalThis.fetch=originalFetch;
    if(previous===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous;
  }
});

test("external commerce search covers known grocery stores and marketplaces without an API call",async()=>{
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
    assert.deepEqual(new Set(res.body.results.map(item=>item.source_name)),new Set([
      "АТБ","Сільпо","METRO","NOVUS","Auchan","Rozetka","OLX","Prom.ua","Flagma","Google Maps"
    ]));
  }finally{
    globalThis.fetch=originalFetch;
  }
});

test("bulk potato requests work through Brain and external search with digits or words",async()=>{
  const originalFetch=globalThis.fetch;
  const previous={openai:process.env.OPENAI_API_KEY,gemini:process.env.GEMINI_FREE_TIER_API_KEY};
  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_FREE_TIER_API_KEY;
  globalThis.fetch=async()=>{throw new Error("unexpected-network-call")};
  try{
    for(const query of ["20 тон картоплі","двадцять тонн картоплі"]){
      const brainRes=recorder();
      await brainHandler({method:"POST",body:{query,language:"uk",location_text:"Тернопіль"},headers:{}},brainRes);
      assert.equal(brainRes.statusCode,200,query);
      assert.equal(brainRes.body.plan.intent,"buy",query);
      assert.equal(brainRes.body.plan.solution_scope,"transaction",query);
      assert.equal(brainRes.body.plan.external_searches.some(item=>item.source==="marketplace"),true,query);

      const searchRes=recorder();
      await externalSearchHandler({
        method:"POST",
        body:{
          goal:query,
          domain:"agriculture",
          location_text:"Тернопіль",
          language:"uk",
          searches:[{source:"marketplace",query,reason:"придбати"}]
        }
      },searchRes);
      assert.equal(searchRes.statusCode,200,query);
      assert.deepEqual(new Set(searchRes.body.results.map(item=>item.source_name)),new Set([
        "Flagma","Agro-Ukraine","Agrotorg","Agrotender","OLX","Prom.ua","Google Maps"
      ]),query);
    }
  }finally{
    globalThis.fetch=originalFetch;
    if(previous.openai===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous.openai;
    if(previous.gemini===undefined)delete process.env.GEMINI_FREE_TIER_API_KEY;else process.env.GEMINI_FREE_TIER_API_KEY=previous.gemini;
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
