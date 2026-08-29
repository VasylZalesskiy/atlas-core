import {useRef,useState} from "react";
import {ArrowUpRight,Camera,HeartHandshake,IdCard,LoaderCircle,MapPin,Search,Share2,Sparkles,X} from "lucide-react";
import {Link,useNavigate} from "react-router-dom";
import VoiceTaskInput from "./VoiceTaskInput";
import OnlinePresence from "./OnlinePresence";
import {getCurrentLocation} from "../services/geolocation";
import {saveSearchHistory,solutionUrl} from "../services/searchHistory";
import {ATLAS_SHARE_URL,atlasShareText} from "../services/shareApp";
import "../styles/mobilePilot.css";

function readImage(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)})}
function compressImage(file){return new Promise(async(resolve,reject)=>{
  try{
    const source=await readImage(file);
    const img=new Image();
    img.onload=()=>{
      const maxSide=1280;
      const scale=Math.min(1,maxSide/Math.max(img.width,img.height));
      const width=Math.max(1,Math.round(img.width*scale));
      const height=Math.max(1,Math.round(img.height*scale));
      const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext("2d");ctx.drawImage(img,0,0,width,height);
      resolve(canvas.toDataURL("image/jpeg",0.78));
    };
    img.onerror=()=>reject(new Error("image-decode-failed"));
    img.src=source;
  }catch(error){reject(error)}
})}

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

  async function shareAtlas(){
    const text=atlasShareText(lang);
    if(navigator.share){
      try{await navigator.share({title:"Atlas",text,url:ATLAS_SHARE_URL});return}catch(error){if(error?.name==="AbortError")return}
    }
    try{await navigator.clipboard.writeText(ATLAS_SHARE_URL);alert(uk?"Посилання Atlas скопійовано":"Atlas link copied")}catch{window.prompt(uk?"Скопіюйте посилання":"Copy the link",ATLAS_SHARE_URL)}
  }

  async function choosePhoto(event){
    const file=event.target.files?.[0];
    if(!file)return;
    setVision(null);setVisionBusy(true);
    try{
      const preview=await readImage(file);setPhoto(preview);
      const image=await compressImage(file);
      const response=await fetch("/api/vision",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image,lang})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data?.error||"vision-failed");
      setVision(data);
      if(data.task)setTask(data.task);
      else if(data.name)setTask(uk?`Знайти інформацію або рішення: ${data.name}`:`Find information or a solution: ${data.name}`);
    }catch(error){
      const message=String(error?.message||"");
      setVision({error:true,note:uk
        ?(message.includes("vision-not-configured")?"Розпізнавання фото ще не активоване на сервері.":"Не вдалося розпізнати фото. Спробуйте ще раз.")
        :(message.includes("vision-not-configured")?"Photo recognition is not enabled on the server yet.":"Could not recognize the photo. Try again.")});
    }finally{setVisionBusy(false)}
  }

  return <section className="mobilePilotHome">
    <div className="mobilePilotBrand">ATLAS</div>
    <div className="mobilePilotStatusRow"><OnlinePresence lang={lang} compact/><button type="button" className="mobilePilotShare" onClick={shareAtlas}><Share2 size={15}/><span>{uk?"Поділитися":"Share"}</span></button></div>

    <div className="mobilePilotHero">
      <div className="mobilePilotEyebrow"><Sparkles size={15}/><span>{uk?"ATLAS ПОЄДНУЄ ЛЮДЕЙ І РІШЕННЯ":"ATLAS CONNECTS PEOPLE AND SOLUTIONS"}</span></div>
      <h1>{uk?<>Твої можливості — <span>це частинка чиєїсь задачі</span></>:<>Your capabilities are <span>part of someone else's task</span></>}</h1>
      <p>{uk?"Опишіть задачу — Atlas спробує знайти найкоротший практичний шлях до рішення.":"Describe the task — Atlas will try to find the shortest practical path to a solution."}</p>
    </div>

    <form className="mobilePilotSearch" onSubmit={submit}>
      <label className="mobilePilotQuestion">{uk?"Яку задачу вирішуємо?":"What task are we solving?"}</label>
      <div className="mobilePilotInputWrap">
        <VoiceTaskInput
          value={task}
          onChange={setTask}
          lang={lang}
          controlsBelow
          placeholder={uk?"Наприклад: потрібно знайти 20 тонн картоплі":"For example: I need to find 20 tonnes of potatoes"}
          extraAction={<button className="mobilePilotCamera" type="button" onClick={()=>fileRef.current?.click()} aria-label={uk?"Додати фото":"Add photo"} title={uk?"Показати фото":"Show a photo"}><Camera size={21}/></button>}
        />
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
      <Link to="/profile"><div><IdCard size={24}/><ArrowUpRight size={17}/></div><span>{uk?"Мої можливості":"My capabilities"}</span><small>{uk?"Чим можу допомогти":"How I can help"}</small></Link>
      <Link to="/needs"><div><HeartHandshake size={24}/><ArrowUpRight size={17}/></div><span>{uk?"Мої потреби":"My needs"}</span><small>{uk?"Що шукаю зараз":"What I need now"}</small></Link>
    </div>
  </section>;
}
