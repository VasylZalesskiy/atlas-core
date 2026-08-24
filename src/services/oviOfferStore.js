const DEFAULT_OVI_OFFER_URL="https://ovi-order-system.vercel.app/api/atlas-offer";

export async function getOviOffers({canonicalCode="",familyCode="",quantity=0,location=null}={}){
  const base=String(import.meta.env.VITE_OVI_OFFER_URL||DEFAULT_OVI_OFFER_URL).trim();
  if(!base||(!canonicalCode&&!familyCode))return null;
  const url=new URL(base);
  if(canonicalCode)url.searchParams.set("canonical_code",canonicalCode);
  if(familyCode)url.searchParams.set("family_code",familyCode);
  if(Number(quantity)>0)url.searchParams.set("quantity",String(Number(quantity)));
  if(Number.isFinite(Number(location?.lat)))url.searchParams.set("lat",String(Number(location.lat)));
  if(Number.isFinite(Number(location?.lng)))url.searchParams.set("lon",String(Number(location.lng)));
  const response=await fetch(url.toString(),{headers:{Accept:"application/json"},cache:"no-store"});
  const text=await response.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=null}
  if(!response.ok)throw new Error(data?.message||data?.error||`OVI HTTP ${response.status}`);
  return data||null;
}
