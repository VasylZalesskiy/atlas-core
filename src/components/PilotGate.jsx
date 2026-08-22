import {useEffect,useState} from "react";
import {Clock3,PauseCircle} from "lucide-react";
import {loadPilotStatus} from "../services/pilotStatus";

function timeText(value,lang){
  if(!value)return "";
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return "";
  return new Intl.DateTimeFormat(lang==="uk"?"uk-UA":"en-US",{dateStyle:"long",timeStyle:"short"}).format(date);
}

export default function PilotGate({lang="uk",children}){
  const [status,setStatus]=useState(null);

  useEffect(()=>{
    let alive=true;
    const refresh=()=>loadPilotStatus().then(next=>{if(alive)setStatus(next)}).catch(()=>{});
    refresh();
    const timer=window.setInterval(refresh,60000);
    const onVisibility=()=>{if(document.visibilityState==="visible")refresh()};
    document.addEventListener("visibilitychange",onVisibility);
    return()=>{alive=false;window.clearInterval(timer);document.removeEventListener("visibilitychange",onVisibility)};
  },[]);

  if(!status||status.active)return children;
  const uk=lang==="uk";
  return <main className="pilotGate"><section>
    <div className="pilotGateIcon">{status.beforeStart?<Clock3 size={34}/>:<PauseCircle size={34}/>}</div>
    <span>ATLAS · {uk?"ПІЛОТ БУДИНКУ":"BUILDING PILOT"}</span>
    <h1>{status.beforeStart?(uk?"Тест ще не розпочався":"The test has not started yet"):(uk?"Тест призупинено":"The test is paused")}</h1>
    <p>{uk?status.message_uk:status.message_en}</p>
    {status.beforeStart&&status.starts_at&&<strong>{uk?"Початок:":"Starts:"} {timeText(status.starts_at,lang)}</strong>}
    {status.afterEnd&&status.ends_at&&<strong>{uk?"Завершено:":"Ended:"} {timeText(status.ends_at,lang)}</strong>}
  </section></main>;
}
