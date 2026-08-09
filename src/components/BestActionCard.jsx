import {MapPinned,Phone,Ambulance,Search} from "lucide-react";
import RealLocationCard from "./RealLocationCard";

export default function BestActionCard({solution,t,onShowDetails,geo,onSearch,onRoute}){
  const medical=["health-symptom","medical-emergency"].includes(solution.goal?.scenario);
  const symptom=solution.goal?.scenario==="health-symptom";

  return <section className={`bestActionCard ${solution.mode}`}>
    <span className="eyebrow">{t.bestActionNow}</span>
    <h2>{solution.bestAction}</h2>

    <div className="primaryOption">
      <span>{medical?(symptom?"ATLAS · ПОТРІБНЕ УТОЧНЕННЯ":"ATLAS · БЕЗПЕКА ПЕРШ ЗА ВСЕ"):`${t.recommendedSearch} · Google Maps`}</span>
      <h3>{solution.primaryOption.title}</h3>
      <p>{solution.primaryOption.subtitle}</p>
      <strong>{solution.primaryOption.status}</strong>
    </div>

    {solution.mode==="emergency"&&<>
      <a className="emergencyButton mobileEmergency" href="tel:103"><Ambulance size={20}/>{t.call103}</a>
      <small>{t.emergencyCallHint}</small>
    </>}

    {!medical&&<RealLocationCard geo={geo} t={t} compact/>}

    {medical?
      <div style={{marginTop:16,padding:14,borderRadius:12,background:"#f6f9f7",color:"#53645a",lineHeight:1.5,fontSize:13}}>
        {symptom
          ?"Atlas не відкриватиме карту навмання. Наступний крок — уточнити симптоми та визначити, яка саме допомога потрібна."
          :"Atlas не показуватиме вигаданий маршрут. За реально невідкладного стану телефонуйте 103; пошук перевіреної установи буде окремим наступним кроком."}
      </div>
      :<div className="actionButtons">
        <button className="primary" type="button" onClick={onSearch}><Search size={18}/>{t.openMapsSearch}</button>
        <button className="primary routeAction" type="button" onClick={onRoute}><MapPinned size={18}/>{t.openRoute}</button>
        <button className="secondary" type="button" onClick={onShowDetails}><Phone size={18}/>{t.call}</button>
      </div>}

    {solution.mode==="emergency"&&<a className="emergencyButton desktopEmergency" href="tel:103"><Ambulance size={18}/>{t.call103}</a>}
    {!medical&&geo.permissionState==="denied"&&<button className="mapsFallback" type="button" onClick={onSearch}>{t.openSearchWithoutLocation}</button>}
  </section>;
}
