import {useEffect,useMemo,useState} from "react";
import {Building2,Clock3,MapPin,Navigation,Phone,RefreshCw,Stethoscope} from "lucide-react";
import {findNearbyMedical,getDrivingRoute,openOsmDirections} from "../services/medicalPlaces";
import "./nearbyMedical.css";

function formatDistance(value){return Number.isFinite(value)?`${value<10?value.toFixed(1):Math.round(value)} км`:"—"}
function formatMinutes(value){return Number.isFinite(value)?`${Math.max(1,Math.round(value))} хв`:"—"}

function ResourceCard({title,item,route,origin,lang}){
  if(!item)return <article className="medicalResource empty"><strong>{title}</strong><p>{lang==="uk"?"Поруч не знайдено в доступних картографічних даних.":"No nearby result was found in the available map data."}</p></article>;
  return <article className="medicalResource">
    <div className="medicalResourceHead"><div><span>{title}</span><h3>{item.name}</h3></div><Building2 size={20}/></div>
    <p className="medicalType">{item.typeLabel}</p>
    {item.address&&<p className="medicalMeta"><MapPin size={15}/>{item.address}</p>}
    <div className="medicalRouteFacts">
      <strong>{route?formatDistance(route.distanceKm):formatDistance(item.straightDistanceKm)}</strong>
      {route&&<strong>{formatMinutes(route.minutes)} авто</strong>}
    </div>
    {item.openingHours&&<p className="medicalMeta"><Clock3 size={15}/>{lang==="uk"?"Години за даними карти":"Map-listed hours"}: {item.openingHours}</p>}
    <div className="medicalActions">
      <button className="primary" type="button" onClick={()=>openOsmDirections(origin,item)}><Navigation size={17}/>{lang==="uk"?"Маршрут":"Route"}</button>
      {item.phone&&<a className="secondary" href={`tel:${item.phone}`}><Phone size={17}/>{lang==="uk"?"Подзвонити":"Call"}</a>}
    </div>
  </article>;
}

export default function NearbyMedicalResources({geo,lang="uk"}){
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [places,setPlaces]=useState({hospitals:[],otherCare:[],pharmacies:[]});
  const [routes,setRoutes]=useState({hospital:null,pharmacy:null});
  const origin=geo.location;

  async function load(location){
    if(!location)return;
    setLoading(true);setError("");setRoutes({hospital:null,pharmacy:null});
    try{
      const result=await findNearbyMedical(location,{lang});
      setPlaces(result);
      const hospital=result.hospitals?.[0]||result.otherCare?.[0]||null;
      const pharmacy=result.pharmacies?.[0]||null;
      const [hospitalRoute,pharmacyRoute]=await Promise.all([
        hospital?getDrivingRoute(location,hospital).catch(()=>null):Promise.resolve(null),
        pharmacy?getDrivingRoute(location,pharmacy).catch(()=>null):Promise.resolve(null)
      ]);
      setRoutes({hospital:hospitalRoute,pharmacy:pharmacyRoute});
    }catch(err){
      setError(err?.message||"medical-search-failed");
    }finally{setLoading(false)}
  }

  useEffect(()=>{if(origin)load(origin)},[origin?.latitude,origin?.longitude,lang]);

  const hospital=useMemo(()=>places.hospitals?.[0]||places.otherCare?.[0]||null,[places]);
  const pharmacy=useMemo(()=>places.pharmacies?.[0]||null,[places]);

  async function locate(){
    const location=await geo.requestLocation();
    if(location&&!origin)load(location);
  }

  return <section className="nearbyMedical">
    <div className="sectionHeading">
      <span>{lang==="uk"?"РЕАЛЬНА ДОПОМОГА ПОРУЧ":"REAL HELP NEARBY"}</span>
      <h2>{lang==="uk"?"Лікарня та аптека поруч":"Nearby hospital and pharmacy"}</h2>
    </div>

    {!origin&&<div className="medicalLocationPrompt">
      <Stethoscope size={24}/>
      <div><strong>{lang==="uk"?"Дайте Atlas вашу поточну локацію":"Share your current location with Atlas"}</strong><p>{lang==="uk"?"Atlas сам знайде найближчу лікарню й аптеку та порахує маршрут. Координати не додаються до Паспортів.":"Atlas will find the nearest hospital and pharmacy and calculate the route. Your coordinates are not added to Opportunity Passports."}</p></div>
      <button className="primary" type="button" onClick={locate} disabled={geo.loading}><MapPin size={18}/>{geo.loading?(lang==="uk"?"Визначаю…":"Locating…"):(lang==="uk"?"Використати мою локацію":"Use my location")}</button>
    </div>}

    {origin&&loading&&<div className="passportSearchState"><RefreshCw className="spin" size={17}/>{lang==="uk"?"Шукаю лікарню та аптеку поруч і рахую маршрут…":"Finding nearby care and calculating routes…"}</div>}
    {origin&&!loading&&error&&<div className="passportSearchState muted">{lang==="uk"?"Не вдалося отримати картографічні дані. Спробуйте ще раз.":"Map data could not be loaded. Please try again."}<button className="secondary" type="button" onClick={()=>load(origin)}>{lang==="uk"?"Повторити":"Retry"}</button></div>}

    {origin&&!loading&&!error&&<div className="medicalResourceGrid">
      <ResourceCard title={hospital?.type==="hospital"?(lang==="uk"?"Найближча лікарня":"Nearest hospital"):(lang==="uk"?"Найближча медична допомога":"Nearest medical care")} item={hospital} route={routes.hospital} origin={origin} lang={lang}/>
      <ResourceCard title={lang==="uk"?"Найближча аптека":"Nearest pharmacy"} item={pharmacy} route={routes.pharmacy} origin={origin} lang={lang}/>
    </div>}

    <p className="passportPrivacy">{lang==="uk"?"Назви й години роботи беруться з відкритих картографічних даних і можуть бути неповними. Atlas не повинен стверджувати, що заклад відкритий або має потрібні ліки, якщо це не підтверджено.":"Names and opening hours come from open map data and may be incomplete. Atlas should not claim a facility is open or has a medicine unless that is verified."}</p>
  </section>;
}
