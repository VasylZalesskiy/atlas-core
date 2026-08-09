export function extractVehicleBudget(text){
  const value=String(text||"").toLowerCase().replace(/\s+/g," ");
  const dollar=value.match(/\$\s*([0-9][0-9\s.,]*)|([0-9][0-9\s.,]*)\s*(?:дол|usd)/i);
  if(dollar){
    const raw=(dollar[1]||dollar[2]||"").replace(/\s/g,"").replace(/,/g,"");
    const n=Number(raw);
    if(Number.isFinite(n)&&n>0)return Math.round(n);
  }
  const k=value.match(/(?:до|бюджет(?:\s*до)?)?\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:тис|k)\b/i);
  if(k){
    const n=Number(String(k[1]).replace(",","."));
    if(Number.isFinite(n)&&n>0)return Math.round(n*1000);
  }
  return null;
}

export async function searchRiaCars(text){
  const budget=extractVehicleBudget(text);
  const params=new URLSearchParams();
  if(budget)params.set("budget",String(budget));
  const response=await fetch(`/api/ria-cars${params.toString()?`?${params.toString()}`:""}`);
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const error=new Error(data.error||`ria-${response.status}`);
    error.code=data.error||"ria-error";
    throw error;
  }
  return {cars:data.cars||[],count:data.count||0,budget:data.budget||budget||null};
}
