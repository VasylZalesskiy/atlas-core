import test from "node:test";
import assert from "node:assert/strict";
import localSearchHandler from "../api/local-search.js";

function recorder(){
  return {
    statusCode:0,headers:{},body:null,
    status(code){this.statusCode=code;return this},
    setHeader(name,value){this.headers[name]=value;return this},
    end(value){this.body=JSON.parse(value);return this}
  };
}

test("medical local search keeps results inside the requested city radius",async()=>{
  const originalFetch=globalThis.fetch;
  let boundedSearch=false;
  globalThis.fetch=async(url,options={})=>{
    const value=String(url);
    if(value.includes("nominatim.openstreetmap.org/search")){
      const parsed=new URL(value);
      const query=parsed.searchParams.get("q")||"";
      if(query==="Тернопіль")return new Response(JSON.stringify([{lat:"49.5558",lon:"25.5924"}]),{status:200});
      boundedSearch=parsed.searchParams.get("bounded")==="1"&&Boolean(parsed.searchParams.get("viewbox"));
      return new Response(JSON.stringify([
        {place_id:3,lat:"49.558",lon:"25.600",name:"Амбулаторія Тернополя",display_name:"Амбулаторія Тернополя, Тернопіль"},
        {place_id:4,lat:"48.900",lon:"24.700",name:"Далекий лікар",display_name:"Далекий лікар, інша область"}
      ]),{status:200});
    }
    if(value.includes("overpass")&&options.method==="POST")return new Response(JSON.stringify({elements:[
      {type:"node",id:1,lat:49.560,lon:25.605,tags:{name:"Сімейний лікар Тернопіль"}},
      {type:"node",id:2,lat:48.900,lon:24.700,tags:{name:"Далекий лікар"}}
    ]}),{status:200});
    throw new Error(`unexpected-url:${value}`);
  };
  try{
    const res=recorder();
    await localSearchHandler({method:"POST",body:{query:"сімейний лікар амбулаторія",location_text:"Тернопіль",language:"uk",radius_km:30,limit:12}},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.search_status,"live-results");
    assert.equal(boundedSearch,true);
    assert.ok(res.body.results.length>=1);
    assert.ok(res.body.results.every(item=>item.straightDistanceKm<=30));
    assert.equal(res.body.results.some(item=>item.name==="Далекий лікар"),false);
    assert.match(res.body.results[0].name,/Терноп/);
  }finally{
    globalThis.fetch=originalFetch;
  }
});
