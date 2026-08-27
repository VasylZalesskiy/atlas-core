import {useRef,useState} from "react";
import {Camera,HeartHandshake,IdCard,LoaderCircle,MapPin,Search,X} from "lucide-react";
import {Link,useNavigate} from "react-router-dom";
import VoiceTaskInput from "./VoiceTaskInput";
import {getCurrentLocation} from "../services/geolocation";
import {saveSearchHistory,solutionUrl} from "../services/searchHistory";
import "../styles/mobilePilot.css";

function readImage(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)})}

export default function MobileHome({lang="uk"}){
  const uk=lang!=="en";
  const [task,setTask]=useState("");
  const [locating,setLocating]=useState(false);
  const [photo,setPhoto]=useState(null);
  const [vision,setVision]=useState(null);
  const [visionBusy,setVisionBusy]=useState(false);
  const fileRef=useRef(null);
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

  function quick(value){setTask(value);window.setTimeout(()=>document.querySelector(".mobilePilotSearch textarea, .mobilePilotSearch input")?.focus(),0)}
  function clearPhoto(){setPhoto(null);setVision(null);if(fileRef.current)fileRef.current.value=""}

  async function choosePhoto(event){
    const file=event.target.files?.[0];
    if(!file)return;
    setVision(null);setVisionBusy(true);
    try{
      const image=await readImage(file);
      setPhoto(image);
      const response=await fetch("/api/vision",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image,lang})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data?.error||"vision-failed");
      setVision(data);
      if(data.task)setTask(data.task);
      else if(data.name)setTask(uk?`Знайти інформацію або рішення: ${data.name}`:`Find information or a solution: ${data.name}`);
    }catch(error){
      setVision({error:true,note:uk?"Не вдалося розпізнати фото. Спробуйте інше фото.":"Could not recognize the photo. Try another photo."});
    }finally{setVisionBusy(false)}
  }

  return <section className="mobilePilotHome">
    <div className="mobilePilotBrand">ATLAS</div>
    <h1>{uk?"Що потрібно?":"What do you need?"}</h1>
    <p>{uk?"Напишіть, скажіть або покажіть фото.":"Write, say it, or show a photo."}</p>

    <form className="mobilePilotSearch" onSubmit={submit}>
      <div className="mobilePilotInputWrap">
        <VoiceTaskInput autoFocus value={task} onChange={setTask} lang={lang} placeholder={uk?"Наприклад: де продуктовий магазин?":"For example: where is a grocery store?"}/>
        <button className="mobilePilotCamera" type="button" onClick={()=>fileRef.current?.click()} aria-label={uk?"Додати фото":"Add photo"}><Camera size={22}/></button>
        <input ref={fileRef} className="mobilePilotFile" type="file" accept="image/*" capture="environment" onChange={choosePhoto}/>
      </div>
      {photo&&<div className="mobilePilotPhoto">
        <img src={photo} alt=""/>
        <div>{visionBusy?<><LoaderCircle className="spin" size={18}/><b>{uk?"Розпізнаю…":"Recognizing…"}</b></>:vision?.error?<span>{vision.note}</span>:<><b>{uk?"Схоже, це":"Looks like"}: {vision?.name||"—"}</b>{vision?.note&&<span>{vision.note}</span>}</>}</div>
        <button type="button" onClick={clearPhoto} aria-label={uk?"Прибрати фото":"Remove photo"}><X size={18}/></button>
      </div>}
      <button className="mobilePilotGo" type="submit" disabled={!task.trim()||locating||visionBusy}>
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
