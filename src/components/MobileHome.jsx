import {lazy,Suspense,useEffect,useRef,useState} from "react";
import {Bell,Camera,HeartHandshake,IdCard,LoaderCircle,LogOut,MapPin,Search,Share2,Smartphone,X} from "lucide-react";
import {Link,useNavigate} from "react-router-dom";
import VoiceTaskInput from "./VoiceTaskInput";
const OnlinePresence=lazy(()=>import("./OnlinePresence"));
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
  const [unreadCount,setUnreadCount]=useState(0);
  const [presenceReady,setPresenceReady]=useState(false);
  const fileRef=useRef(null);
  const nav=useNavigate();

  useEffect(()=>{
    let cancelled=false;
    const start=()=>{if(!cancelled)setPresenceReady(true)};
    const idle=window.requestIdleCallback?window.requestIdleCallback(start,{timeout:1400}):window.setTimeout(start,800);
    return()=>{
      cancelled=true;
      if(window.cancelIdleCallback&&typeof idle==="number")window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  },[]);

  useEffect(()=>{
    const onNotifications=event=>setUnreadCount(Number(event?.detail?.unread)||0);
    window.addEventListener("atlas:notifications",onNotifications);
    return()=>window.removeEventListener("atlas:notifications",onNotifications);
  },[]);

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
  function exitAtlas(){
    try{window.close()}catch{}
    window.setTimeout(()=>{
      if(window.history.length>1)window.history.back();
      else window.location.replace("about:blank");
    },80);
  }

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

  const needChips=uk?["🥔 Картопля","🍅 Помідори","🧅 Цибуля","🥬 Капуста","🥒 Квашені огірки","🫗 Олія"]:["🥔 Potatoes","🍅 Tomatoes","🧅 Onions","🥬 Cabbage","🥒 Pickled cucumbers","🫗 Oil"];

  return <section className="mobilePilotHome">
    <div className="mobilePilotTopRow">
      <div className="mobilePilotStatusRow">{presenceReady&&<Suspense fallback={null}><OnlinePresence lang={lang} compact/></Suspense>}</div>
      <div className="mobilePilotTopActions">
        <Link to="/share" aria-label={uk?"Встановити Atlas":"Install Atlas"}><Smartphone size={18}/></Link>
        <button type="button" onClick={shareAtlas} aria-label={uk?"Поділитися Atlas":"Share Atlas"}><Share2 size={18}/></button>
        <button className="mobilePilotExit" type="button" onClick={exitAtlas} aria-label={uk?"Вийти з Atlas":"Exit Atlas"}><LogOut size={17}/><span>{uk?"Вийти":"Exit"}</span></button>
      </div>
    </div>

    <div className="mobilePilotIntro">
      <span className="mobilePilotEyebrow">ATLAS · {uk?"ГОЛОВНА":"HOME"}</span>
      <h1>{uk?"Твої можливості — це частинка чиєїсь задачі":"Your capabilities are part of someone else’s task"}</h1>
      <p>{uk?"У будинку Atlas поєднує те, що людям потрібно, з тим, що інші мешканці реально можуть дати або зробити.":"In the building, Atlas connects what people need with what neighbors can actually provide or do."}</p>
    </div>

    <div className="mobilePassportGrid">
      <Link className="mobilePassportCard capability" to="/profile">
        <IdCard size={27}/><div><strong>{uk?"Продати / Паспорт можливостей":"Sell / Opportunity Passport"}</strong><span>{uk?"Додайте товар, ціну, кількість і можливість доставки":"Add an item, price, quantity and delivery option"}</span></div><b>{uk?"Додати пропозицію →":"Add offer →"}</b>
      </Link>
      <Link className="mobilePassportCard need" to="/needs">
        <HeartHandshake size={27}/><div><strong>{uk?"Замовити / Паспорт потреб":"Order / Needs Passport"}</strong><span>{uk?"Оберіть товар, кількість і коли він потрібен":"Choose the item, quantity and when you need it"}</span></div><b>{uk?"Зробити замовлення →":"Place order →"}</b>
      </Link>
    </div>

    <div className="mobileNeedsHint">
      <span>{uk?"Швидке замовлення для будинку":"Quick building order"}</span>
      <div>{needChips.map(item=><Link key={item} to="/needs">{item}</Link>)}</div>
    </div>

    <div className="mobilePilotSearchHead">
      <div><Search size={19}/><strong>{uk?"Знайти рішення":"Find a solution"}</strong></div>
      <span>{uk?"Atlas спершу перевіряє можливості мешканців":"Atlas checks neighbors’ capabilities first"}</span>
    </div>

    <form className="mobilePilotSearch" onSubmit={submit}>
      <div className="mobilePilotInputWrap">
        <VoiceTaskInput value={task} onChange={setTask} lang={lang} placeholder={uk?"Наприклад: потрібна дриль на вечір":"For example: I need a drill for the evening"}/>
        <button className="mobilePilotCamera" type="button" onClick={()=>fileRef.current?.click()} aria-label={uk?"Додати фото":"Add photo"}><Camera size={21}/></button>
        <input ref={fileRef} className="mobilePilotFile" type="file" accept="image/*" capture="environment" onChange={choosePhoto}/>
      </div>
      {photo&&<div className="mobilePilotPhoto">
        <img src={photo} alt=""/>
        <div>{visionBusy?<><LoaderCircle className="spin" size={18}/><b>{uk?"Розпізнаю…":"Recognizing…"}</b></>:vision?.error?<span>{vision.note}</span>:<><b>{uk?"Схоже, це":"Looks like"}: {vision?.name||"—"}</b>{vision?.note&&<span>{vision.note}</span>}</>}</div>
        <button type="button" onClick={clearPhoto}><X size={18}/></button>
      </div>}
      <button className="mobilePilotGo" type="submit" disabled={!task.trim()||locating||visionBusy}>{locating?<MapPin size={21}/>:<Search size={21}/>}<span>{locating?(uk?"Визначаю місце…":"Finding location…"):(uk?"Знайти рішення":"Find a solution")}</span></button>
    </form>

    <div className="mobilePilotQuick">
      <button type="button" onClick={()=>quick(uk?"Потрібна допомога сусіда":"I need help from a neighbor")}>🤝 {uk?"Потрібна допомога":"Need help"}</button>
      <button type="button" onClick={()=>quick(uk?"Хто у будинку може цим поділитися?":"Who in the building can share this?")}>🏠 {uk?"Є у сусідів?":"Available nearby?"}</button>
    </div>

    <Link className={`mobileNotificationsCard ${unreadCount>0?"hasUnread":""}`} to="/requests">
      <span className="mobileNotificationIcon"><Bell size={20}/>{unreadCount>0&&<i>{unreadCount>99?"99+":unreadCount}</i>}</span>
      <span><strong>{unreadCount>0?(uk?`Нові сповіщення: ${unreadCount}`:`New notifications: ${unreadCount}`):(uk?"Сповіщення та запити":"Notifications & requests")}</strong><small>{uk?"Тут будуть збіги між потребами та можливостями":"Matches between needs and capabilities appear here"}</small></span><b>→</b>
    </Link>
    <Link className="mobileInstallCard" to="/share"><Smartphone size={20}/><span><strong>{uk?"Встановити Atlas на телефон":"Install Atlas on your phone"}</strong><small>{uk?"Інструкція для iPhone та Android":"Instructions for iPhone and Android"}</small></span><b>→</b></Link>
  </section>;
}
