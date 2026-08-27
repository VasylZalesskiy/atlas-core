import {getFreeAiStatus} from "./_free-ai.js";

const MODEL="gemini-3.5-flash-lite";
const URL=`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

function key(){return String(process.env.GEMINI_FREE_TIER_API_KEY||"").trim()}
function cleanJson(text){
  const raw=String(text||"").trim().replace(/^```json\s*/i,"").replace(/```$/i,"").trim();
  try{return JSON.parse(raw)}catch{return null}
}

export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"method-not-allowed"});
  const apiKey=key();
  if(!apiKey)return res.status(503).json({error:"vision-not-configured",status:await getFreeAiStatus()});
  const image=String(req.body?.image||"");
  const lang=req.body?.lang==="en"?"en":"uk";
  const match=image.match(/^data:(image\/(?:jpeg|png|webp|heic|heif));base64,(.+)$/i);
  if(!match)return res.status(400).json({error:"invalid-image"});
  if(match[2].length>9_000_000)return res.status(413).json({error:"image-too-large"});

  const prompt=lang==="en"
    ?"Identify the main object or situation in this photo for a practical assistant. Return JSON only: {\"name\":\"short identification\",\"confidence\":\"high|medium|low\",\"task\":\"a short useful search/task phrase the user could submit to Atlas\",\"note\":\"one short caveat if uncertain\"}. Do not diagnose medical conditions."
    :"Визнач головний предмет або ситуацію на фото для практичного помічника. Поверни лише JSON: {\"name\":\"коротко що це\",\"confidence\":\"high|medium|low\",\"task\":\"короткий корисний запит/задача для пошуку Atlas\",\"note\":\"одне коротке застереження якщо не впевнений\"}. Не став медичних діагнозів.";

  try{
    const response=await fetch(URL,{
      method:"POST",
      headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},
      body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt},{inlineData:{mimeType:match[1],data:match[2]}}]}],generationConfig:{temperature:0,maxOutputTokens:350,responseMimeType:"application/json"}})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)return res.status(response.status).json({error:data?.error?.message||"vision-failed"});
    const text=(data?.candidates?.[0]?.content?.parts||[]).map(p=>p?.text||"").join("");
    const result=cleanJson(text);
    if(!result?.name)return res.status(502).json({error:"vision-empty"});
    return res.status(200).json({ok:true,...result,model:MODEL});
  }catch(error){
    return res.status(500).json({error:error?.message||"vision-failed"});
  }
}
