import {useState} from "react";
import {HeartHandshake,IdCard,MapPin,Search} from "lucide-react";
import {Link,useNavigate} from "react-router-dom";
import VoiceTaskInput from "./VoiceTaskInput";
import {getCurrentLocation} from "../services/geolocation";
import {saveSearchHistory,solutionUrl} from "../services/searchHistory";
import "../styles/mobilePilot.css";

export default function MobileHome({lang="uk"}){
  const uk=lang!=="en";
  const [task,setTask]=useState("");
  const [locating,setLocating]=useState(false);
  const nav=useNavigate();

  async function submit(event){
    event?.preventDefault?.();
    const value=task.trim();
    if(!value)return;
    let geoLocation=null;
    if(/поруч|де\s+знайти|магазин|аптек|лікар|сервіс|майстер|nearby|where|store|pharmacy|doctor|repair/i.test(value)){
      setLocating(true);
      try{geoLocation=await getCurrentLocation()}catch{}
      setLocating(false);
    }
    saveSearchHistory({task:value,where:""});
    nav(solutionUrl(value,""),geoLocation?{state:{geoLocation}}:undefined);
  }

  function quick(value){
    setTask(value);
    window.setTimeout(()=>document.querySelector(".mobilePilotSearch textarea, .mobilePilotSearch input")?.focus(),0);
  }

  return <section className="mobilePilotHome">
    <div className="mobilePilotBrand">ATLAS</div>
    <h1>{uk?"Що потрібно?":"What do you need?"}</h1>
    <p>{uk?"Напишіть одним реченням. Atlas знайде шлях до рішення.":"Write one sentence. Atlas will find a path to a solution."}</p>

    <form className="mobilePilotSearch" onSubmit={submit}>
      <VoiceTaskInput autoFocus value={task} onChange={setTask} lang={lang} placeholder={uk?"Наприклад: де продуктовий магазин?":"For example: where is a grocery store?"}/>
      <button className="mobilePilotGo" type="submit" disabled={!task.trim()||locating}>
        {locating?<MapPin size={22}/>:<Search size={22}/>}<span>{locating?(uk?"Визначаю місце…":"Finding location…"):(uk?"Знайти":"Find")}</span>
      </button>
    </form>

    <div className="mobilePilotQuick">
      <button type="button" onClick={()=>quick(uk?"Де знайти продуктовий магазин поруч?":"Where is a grocery store nearby?")}>🛒 {uk?"Магазин поруч":"Store nearby"}</button>
      <button type="button" onClick={()=>quick(uk?"Потрібна допомога сусіда":"I need help from a neighbor")}>🤝 {uk?"Потрібна допомога":"Need help"}</button>
    </div>

    <div className="mobilePilotCards">
      <Link to="/profile"><IdCard size={24}/><span>{uk?"Мої можливості":"My capabilities"}</span></Link>
      <Link to="/needs"><HeartHandshake size={24}/><span>{uk?"Мої потреби":"My needs"}</span></Link>
    </div>
  </section>;
}
