import {useRef,useState} from "react";
import {Camera,HeartHandshake,IdCard,LoaderCircle,MapPin,Search,Share2,ShoppingBasket,X} from "lucide-react";
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

  const banks=uk?[
    ["🤝","Допомога","Знайти серед сусідів того, хто може допомогти"],
    ["🛠️","Навички","Знайти навички та вміння сусідів"],
    ["🧰","Речі","Знайти у сусідів річ або інструмент, яким можуть поділитися"],
    ["🚗","Транспорт","Знайти допомогу з поїздкою або доставкою серед сусідів"],
    ["🥕","Продукти","Знайти продукти або можливість поділитися продуктами у будинку"],
    ["👥","Спільні справи","Знайти сусідів для спільної справи або плану"]
  ]:[
    ["🤝","Help","Find a neighbor who can help"],
    ["🛠️","Skills","Find neighbors' skills and capabilities"],
    ["🧰","Things","Find an item or tool a neighbor can share"],
    ["🚗","Transport","Find a ride or delivery option among neighbors"],
    ["🥕","Food","Find food or sharing opportunities in the building"],
    ["👥","Together","Find neighbors for a shared plan or activity"]
  ];

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
    <p className="mobilePilotSlogan">{uk?"Твої можливості — це частинка чиєїсь задачі":"Your capabilities are part of someone else’s task"}</p>
    <div className="buildingPilotBadge"><b>{uk?"Пілот одного будинку":"One-building pilot"}</b><span>{uk?"Atlas спочатку шукає рішення серед можливостей сусідів":"Atlas searches neighbors’ capabilities first"}</span></div>
    <Link className="mobileTomatoCta" to="/tomatoes"><span>🍅</span><span><strong>{uk?"5 кг безкоштовно":"5 kg for free"}</strong><small>{uk?"Для кожної квартири":"For every apartment"}</small></span><b><ShoppingBasket size={17}/>{uk?"Отримати":"Get"}</b></Link>
    <h1>{uk?"Що потрібно вирішити?":"What do you need to solve?"}</h1>
    <p>{uk?"Опишіть задачу своїми словами. Atlas спершу перевірить паспорти можливостей у будинку.":"Describe the task in your own words. Atlas will check building capability passports first."}</p>

    <form className="mobilePilotSearch" onSubmit={submit}>
      <div className="mobilePilotInputWrap">
        <VoiceTaskInput autoFocus value={task} onChange={setTask} lang={lang} placeholder={uk?"Наприклад: потрібна дриль на вечір":"For example: I need a drill for the evening"}/>
        <button className="mobilePilotCamera" type="button" onClick={()=>fileRef.current?.click()} aria-label={uk?"Додати фото":"Add photo"}><Camera size={22}/></button>
        <input ref={fileRef} className="mobilePilotFile" type="file" accept="image/*" capture="environment" onChange={choosePhoto}/>
      </div>
      {photo&&<div className="mobilePilotPhoto">
        <img src={photo} alt=""/>
        <div>{visionBusy?<><LoaderCircle className="spin" size={18}/><b>{uk?"Розпізнаю…":"Recognizing…"}</b></>:vision?.error?<span>{vision.note}</span>:<><b>{uk?"Схоже, це":"Looks like"}: {vision?.name||"—"}</b>{vision?.note&&<span>{vision.note}</span>}</>}</div>
        <button type="button" onClick={clearPhoto} aria-label={uk?"Прибрати фото":"Remove photo"}><X size={18}/></button>
      </div>}
      <button className="mobilePilotGo" type="submit" disabled={!task.trim()||locating||visionBusy}>
        {locating?<MapPin size={22}/>:<Search size={22}/>}<span>{locating?(uk?"Визначаю місце…":"Finding location…"):(uk?"Знайти рішення":"Find a solution")}</span>
      </button>
    </form>

    <div className="mobilePilotQuick">
      <button type="button" onClick={()=>quick(uk?"Потрібна допомога сусіда":"I need help from a neighbor")}>🤝 {uk?"Потрібна допомога":"Need help"}</button>
      <button type="button" onClick={()=>quick(uk?"Хто у будинку може цим поділитися?":"Who in the building can share this?")}>🏠 {uk?"Є у сусідів?":"Available nearby?"}</button>
    </div>

    <section className="opportunityBanks">
      <div className="opportunityBanksHead"><b>{uk?"Банки можливостей будинку":"Building capability banks"}</b><span>{uk?"Не оголошення — лише те, чим люди реально можуть допомогти":"Not listings — real capabilities people can offer"}</span></div>
      <div className="opportunityBanksGrid">{banks.map(([icon,label,prompt])=><button key={label} type="button" onClick={()=>quick(prompt)}><span>{icon}</span><b>{label}</b></button>)}</div>
    </section>

    <div className="mobilePilotCards">
      <Link to="/profile"><IdCard size={24}/><span>{uk?"Додати мої можливості":"Add my capabilities"}</span></Link>
      <Link to="/needs"><HeartHandshake size={24}/><span>{uk?"Додати мою потребу":"Add my need"}</span></Link>
    </div>
  </section>;
}
