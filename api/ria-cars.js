const RIA_BASE="https://developers.ria.com";

function send(res,status,body){
  res.status(status).setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","s-maxage=60, stale-while-revalidate=120");
  res.end(JSON.stringify(body));
}

function asArray(value){return Array.isArray(value)?value:[value].filter(Boolean)}

export default async function handler(req,res){
  if(req.method!=="GET")return send(res,405,{error:"method-not-allowed"});

  const apiKey=process.env.RIA_API_KEY;
  if(!apiKey)return send(res,503,{error:"ria-key-missing"});

  const rawBudget=Number(req.query?.budget||0);
  const budget=Number.isFinite(rawBudget)&&rawBudget>0?Math.min(Math.round(rawBudget),500000):0;

  const params=new URLSearchParams({
    api_key:apiKey,
    category_id:"1",
    currency:"1",
    countpage:"8",
    page:"0",
    with_photo:"1"
  });
  if(budget)params.set("price_do",String(budget));

  try{
    const searchResponse=await fetch(`${RIA_BASE}/auto/search?${params.toString()}`);
    if(!searchResponse.ok){
      const text=await searchResponse.text();
      return send(res,502,{error:"ria-search-failed",status:searchResponse.status,details:text.slice(0,250)});
    }

    const searchJson=await searchResponse.json();
    const root=asArray(searchJson)[0]||searchJson||{};
    const ids=root?.result?.search_result?.ids||searchJson?.result?.search_result?.ids||[];
    const topIds=asArray(ids).slice(0,6);

    const infos=await Promise.all(topIds.map(async id=>{
      try{
        const infoParams=new URLSearchParams({api_key:apiKey,auto_id:String(id)});
        const response=await fetch(`${RIA_BASE}/auto/info?${infoParams.toString()}`);
        if(!response.ok)return null;
        const json=await response.json();
        const item=asArray(json)[0]||json;
        if(!item)return null;
        const relativeLink=item.linkToView||"";
        return {
          id:String(item.autoData?.autoId||id),
          title:item.title||[item.markName,item.modelName,item.autoData?.year].filter(Boolean).join(" ")||"Автомобіль",
          mark:item.markName||"",
          model:item.modelName||"",
          year:item.autoData?.year||null,
          priceUsd:Number(item.USD)||null,
          mileage:item.autoData?.race||"",
          fuel:item.autoData?.fuelName||"",
          gearbox:item.autoData?.gearboxName||"",
          city:item.locationCityName||item.stateData?.name||"",
          region:item.stateData?.regionName||"",
          photo:item.photoData?.seoLinkM||item.photoData?.seoLinkB||item.photoData?.seoLinkSX||"",
          url:relativeLink?`https://auto.ria.com${relativeLink}`:"",
          auctionPossible:Boolean(item.auctionPossible)
        };
      }catch{return null}
    }));

    const cars=infos.filter(Boolean).filter(car=>!budget||!car.priceUsd||car.priceUsd<=budget);
    return send(res,200,{cars,count:Number(root?.result?.search_result?.count)||cars.length,budget:budget||null,source:"AUTO.RIA"});
  }catch(error){
    return send(res,500,{error:"ria-unavailable",details:String(error?.message||error)});
  }
}
