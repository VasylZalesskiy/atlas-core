const OPENAI_URL="https://api.openai.com/v1/responses";

function send(res,status,body){
  res.status(status).setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.end(JSON.stringify(body));
}

const resultSchema={
  type:"object",
  additionalProperties:false,
  required:["results"],
  properties:{
    results:{
      type:"array",
      maxItems:8,
      items:{
        type:"object",
        additionalProperties:false,
        required:["title","snippet","url","source_type","price_text","location_text"],
        properties:{
          title:{type:"string"},
          snippet:{type:"string"},
          url:{type:"string"},
          source_type:{type:"string"},
          price_text:{type:"string"},
          location_text:{type:"string"}
        }
      }
    }
  }
};

function extractText(data){
  if(typeof data?.output_text==="string"&&data.output_text.trim())return data.output_text;
  for(const item of data?.output||[]){
    if(item?.type!=="message")continue;
    for(const content of item?.content||[]){
      if(content?.type==="output_text"&&typeof content.text==="string")return content.text;
    }
  }
  return "";
}

export default async function handler(req,res){
  if(req.method!=="POST")return send(res,405,{error:"method-not-allowed"});

  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey)return send(res,503,{error:"openai-key-missing"});

  const body=typeof req.body==="string"?JSON.parse(req.body||"{}"):req.body||{};
  const searches=Array.isArray(body.searches)?body.searches.slice(0,4):[];
  const goal=String(body.goal||"").trim();
  const language=body.language==="en"?"en":"uk";

  if(!goal||!searches.length)return send(res,200,{results:[]});

  const allowed=searches
    .filter(item=>item&&["web","marketplace","official"].includes(item.source))
    .map(item=>({source:item.source,query:String(item.query||"").slice(0,400),reason:String(item.reason||"").slice(0,300)}))
    .filter(item=>item.query);

  if(!allowed.length)return send(res,200,{results:[]});

  const instructions=`You are the external-search executor for Atlas, a universal solution finder. Use web search to find REAL, currently accessible, actionable results for the user's goal.\n\nRules:\n- Never invent a product, business, listing, price, availability, URL, person, or fact.\n- Return only URLs that you actually found through web search.\n- Prefer specific result/listing/detail pages over generic home pages when possible.\n- Respect the requested source intent: marketplace means real listings/offers; official means authoritative sources; web means the best practical public source.\n- Return at most 8 useful results total, deduplicated.\n- If nothing reliable is found, return an empty results array.\n- Use ${language==="uk"?"Ukrainian":"English"} for title/snippet text when practical; do not translate brand names or URLs.\n- price_text and location_text must be empty strings if the source does not clearly provide them.`;

  try{
    const response=await fetch(OPENAI_URL,{
      method:"POST",
      headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:process.env.OPENAI_SEARCH_MODEL||process.env.OPENAI_MODEL||"gpt-5-mini",
        store:false,
        instructions,
        input:JSON.stringify({goal,searches:allowed}),
        tools:[{type:"web_search"}],
        max_output_tokens:2200,
        text:{format:{type:"json_schema",name:"atlas_external_results",strict:true,schema:resultSchema}}
      })
    });

    const data=await response.json();
    if(!response.ok)return send(res,502,{error:"external-search-failed",status:response.status,details:data?.error?.message||"OpenAI web search failed"});

    const text=extractText(data);
    if(!text)return send(res,502,{error:"external-search-empty"});
    const parsed=JSON.parse(text);
    return send(res,200,{results:Array.isArray(parsed?.results)?parsed.results:[]});
  }catch(error){
    return send(res,500,{error:"external-search-failed",details:error?.message||"Unknown error"});
  }
}
