import {useRef,useState} from "react";
import {Camera,LoaderCircle,MapPin,RotateCcw,Search,X} from "lucide-react";
import {useNavigate} from "react-router-dom";
import VoiceTaskInput from "./VoiceTaskInput";
import LocationAutocomplete,{rememberedAtlasLocation,rememberAtlasLocation} from "./LocationAutocomplete";
import {getCurrentLocation} from "../services/geolocation";
import {saveSearchHistory,solutionUrl} from "../services/searchHistory";
import "../styles/mobilePilot.css";
import "../styles/mobilePilotOverrides.css";

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
  const [where,setWhere]=useState(()=>rememberedAtlasLocation());
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
    if(!where.trim()&&/поруч|де\s+знайти|магазин|аптек|лікар|сервіс|майстер|nearby|where|store|pharmacy|doctor|repair/i.test(value)){
      setLocating(true);
      try{geoLocation=await getCurrentLocation()}catch{}
      setLocating(false);
    }
    if(where.trim())rememberAtlasLocation(where);
    saveSearchHistory({task:value,where});
    nav(solutionUrl(value,where),geoLocation?{state:{geoLocation}}:undefined);
  }

  function onSearchKeyDown(event){
    if(event.key!=="Enter"||event.shiftKey||event.nativeEvent?.isComposing)return;
    event.preventDefault();
    submit(event);
  }

  function resetSearch(){setTask("");setWhere(rememberedAtlasLocation());setPhoto(null);setVision(null);if(fileRef.current)fileRef.current.value="";window.setTimeout(()=>document.querySelector(".mobilePilotSearch textarea, .mobilePilotSearch input")?.focus(),0)}
  function clearPhoto(){setPhoto(null);setVision(null);if(fileRef.current)fileRef.current.value=""}

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


  return <section className="mobilePilotHome atlasSearchHome">
    <div className="mobilePilotIntro">
      <h1>{uk?"Знайдіть допомогу поруч":"Find help nearby"}</h1>
    </div>


    <div className="mobilePilotSearchHead">
      <div><strong>{uk?"Що вам потрібно?":"What do you need?"}</strong></div>
      {(task.trim()||where.trim())&&<button className="mobilePilotReset" type="button" onClick={resetSearch}><RotateCcw size={14}/>{uk?"Новий пошук":"New search"}</button>}
    </div>

    <form className="mobilePilotSearch" onSubmit={submit}>
      <div className="mobilePilotInputWrap">
        <VoiceTaskInput value={task} onChange={setTask} onKeyDown={onSearchKeyDown} lang={lang} placeholder={uk?"Наприклад: потрібна дриль на вечір":"For example: I need a drill for the evening"}/>
        <button className="mobilePilotCamera" type="button" onClick={()=>fileRef.current?.click()} aria-label={uk?"Додати фото":"Add photo"}><Camera size={21}/></button>
        <input ref={fileRef} className="mobilePilotFile" type="file" accept="image/*" capture="environment" onChange={choosePhoto}/>
      </div>
      {photo&&<div className="mobilePilotPhoto">
        <img src={photo} alt=""/>
        <div>{visionBusy?<><LoaderCircle className="spin" size={18}/><b>{uk?"Розпізнаю…":"Recognizing…"}</b></>:vision?.error?<span>{vision.note}</span>:<><b>{uk?"Схоже, це":"Looks like"}: {vision?.name||"—"}</b>{vision?.note&&<span>{vision.note}</span>}</>}</div>
        <button type="button" onClick={clearPhoto}><X size={18}/></button>
      </div>}
      <label className="mobilePilotLocation">
        <span><MapPin size={16}/>{uk?"Де це потрібно?":"Where is it needed?"}</span>
        <LocationAutocomplete value={where} onChange={setWhere} lang={lang} placeholder={uk?"Наприклад: Тернопіль (необов'язково)":"For example: Ternopil (optional)"}/>
      </label>
      <button className="mobilePilotGo" type="submit" disabled={!task.trim()||locating||visionBusy}>{locating?<MapPin size={21}/>:<Search size={21}/>}<span>{locating?(uk?"Визначаю місце…":"Finding location…"):(uk?"Знайти рішення":"Find a solution")}</span></button>
    </form>

  </section>;
}
