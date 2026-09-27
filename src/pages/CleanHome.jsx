import {useEffect,useRef,useState} from "react";
import {Bell,Camera,Home as HomeIcon,LoaderCircle,MapPin,MessageCircleMore,MessagesSquare,Search,Sparkles,X} from "lucide-react";
import {Link,useNavigate} from "react-router-dom";
import OnlinePresence from "../components/OnlinePresence";
import CleanHistoryNav from "../components/CleanHistoryNav";
import VoiceTaskInput from "../components/VoiceTaskInput";
import {saveSearchHistory,solutionUrl} from "../services/searchHistory";
import "../styles/cleanHome.css";

function readImage(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=reject;
    reader.readAsDataURL(file);
  });
}

function compressImage(file){
  return new Promise(async(resolve,reject)=>{
    try{
      const source=await readImage(file);
      const img=new Image();
      img.onload=()=>{
        const maxSide=1280;
        const scale=Math.min(1,maxSide/Math.max(img.width,img.height));
        const width=Math.max(1,Math.round(img.width*scale));
        const height=Math.max(1,Math.round(img.height*scale));
        const canvas=document.createElement("canvas");
        canvas.width=width;
        canvas.height=height;
        canvas.getContext("2d").drawImage(img,0,0,width,height);
        resolve(canvas.toDataURL("image/jpeg",0.78));
      };
      img.onerror=()=>reject(new Error("image-decode-failed"));
      img.src=source;
    }catch(error){reject(error)}
  });
}

export default function CleanHome({lang="uk",setLang,inboxUnread=0}){
  const uk=lang!=="en";
  const [task,setTask]=useState("");
  const [where,setWhere]=useState("");
  const [photo,setPhoto]=useState(null);
  const [visionBusy,setVisionBusy]=useState(false);
  const [visionNote,setVisionNote]=useState("");
  const [noticeUnread,setNoticeUnread]=useState(0);
  const fileRef=useRef(null);
  const nav=useNavigate();

  useEffect(()=>{
    document.body.classList.add("clean-home-route");
    const onNotifications=event=>setNoticeUnread(Number(event?.detail?.unread)||0);
    window.addEventListener("atlas:notifications",onNotifications);
    return()=>{
      window.removeEventListener("atlas:notifications",onNotifications);
      document.body.classList.remove("clean-home-route");
    };
  },[]);

  function submit(event){
    event.preventDefault();
    const value=task.trim();
    if(!value)return;
    saveSearchHistory({task:value,where});
    const medical=/болить|біль|травм|кровотеч|температур|задишк|непритом|лікар|медич|pain|hurt|injur|bleed|doctor|medical/i.test(value);
    if(medical){
      nav(solutionUrl(value,where));
      return;
    }
    const params=new URLSearchParams({q:value});
    if(where.trim())params.set("where",where.trim());
    nav(`/results?${params.toString()}`);
  }

  async function choosePhoto(event){
    const file=event.target.files?.[0];
    if(!file)return;
    setVisionBusy(true);
    setVisionNote("");
    try{
      setPhoto(await readImage(file));
      const image=await compressImage(file);
      const response=await fetch("/api/vision",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({image,lang})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data?.error||"vision-failed");
      const nextTask=data?.task||(data?.name?(uk?`Знайти: ${data.name}`:`Find: ${data.name}`):"");
      if(nextTask)setTask(nextTask);
      setVisionNote(data?.note||data?.name||"");
    }catch{
      setVisionNote(uk?"Фото додано. Якщо потрібно, уточніть задачу текстом.":"Photo added. Add a short text description if needed.");
    }finally{
      setVisionBusy(false);
    }
  }

  function clearPhoto(){
    setPhoto(null);
    setVisionNote("");
    if(fileRef.current)fileRef.current.value="";
  }

  const unread=Math.max(inboxUnread,noticeUnread);

  return <main className="cleanHomeShell">
    <header className="cleanHomeTopbar">
      <Link className="cleanHomeBrand" to="/" aria-label={uk?"Головна":"Home"}>
        <span className="cleanHomeLogo">A</span>
        <span>ATLAS</span>
      </Link>
      <div className="cleanHomeTopActions">
        <div className="cleanHomeLanguage" aria-label={uk?"Мова":"Language"}>
          <button type="button" className={lang==="uk"?"active":""} onClick={()=>setLang("uk")}>UA</button>
          <span>/</span>
          <button type="button" className={lang==="en"?"active":""} onClick={()=>setLang("en")}>EN</button>
        </div>
        <OnlinePresence lang={lang} compact/>
        <button className="cleanHomeBell" type="button" onClick={()=>window.dispatchEvent(new CustomEvent("atlas:open-notifications"))} aria-label={uk?"Сповіщення Atlas":"Atlas notifications"}>
          <Bell size={17}/>
          {unread>0&&<b>{unread>9?"9+":unread}</b>}
        </button>
      </div>
    </header>
    <CleanHistoryNav lang={lang} titleUk="Головна" titleEn="Home"/>

    <section className="cleanHomeHero">
      <span className="cleanHomeEyebrow">ATLAS</span>
      <h1>{uk?<><strong>Твої можливості</strong> — це частинка чиєїсь задачі</>:<><strong>Your capabilities</strong> are part of someone else's task</>}</h1>
      <p>{uk?"Знайди рішення. Запропонуй допомогу. Будь поруч.":"Find a solution. Offer help. Be nearby."}</p>
    </section>

    <form className="cleanHomeSearch" onSubmit={submit}>
      <label className="cleanHomeSearchTitle">{uk?"Опишіть задачу":"Describe the task"}</label>
      <div className="cleanHomeTask">
        <VoiceTaskInput
          value={task}
          onChange={setTask}
          lang={lang}
          placeholder={uk?"Наприклад: потрібен генератор на сьогодні":"For example: I need a generator today"}
        />
        <button className="cleanHomeCamera" type="button" onClick={()=>fileRef.current?.click()} aria-label={uk?"Додати фото":"Add photo"}>
          <Camera size={18}/>
        </button>
        <input ref={fileRef} className="cleanHomeFile" type="file" accept="image/*" capture="environment" onChange={choosePhoto}/>
      </div>

      {photo&&<div className="cleanHomePhoto">
        <img src={photo} alt=""/>
        <span>{visionBusy?<><LoaderCircle className="cleanHomeSpin" size={16}/>{uk?"Розпізнаю фото…":"Recognizing photo…"}</>:visionNote||(uk?"Фото додано":"Photo added")}</span>
        <button type="button" onClick={clearPhoto} aria-label={uk?"Прибрати фото":"Remove photo"}><X size={16}/></button>
      </div>}

      <label className="cleanHomeLocation">
        <MapPin size={16}/>
        <input value={where} onChange={e=>setWhere(e.target.value)} placeholder={uk?"Місто, район або область — необов’язково":"City, district or region — optional"}/>
      </label>

      <button className="cleanHomeFind" type="submit" disabled={!task.trim()||visionBusy}>
        <Search size={18}/>
        {uk?"Знайти рішення":"Find a solution"}
      </button>
    </form>

    <Link className="cleanHomeCapability" to="/profile">
      <span className="cleanHomeCapabilityIcon"><Sparkles size={21}/></span>
      <span className="cleanHomeCapabilityCopy">
        <strong>{uk?"Твої можливості":"Your capabilities"}</strong>
        <small>{uk?"Що я маю, вмію, можу":"What I have, know and can do"}</small>
      </span>
      <span className="cleanHomeArrow">→</span>
    </Link>

    <nav className="cleanHomeBottom" aria-label={uk?"Головна навігація":"Main navigation"}>
      <Link className="active" to="/"><HomeIcon size={19}/><span>{uk?"Головна":"Home"}</span></Link>
      <Link to="/profile"><Sparkles size={19}/><span>{uk?"Можливості":"Capabilities"}</span></Link>
      <Link to="/messages"><MessagesSquare size={19}/><span>{uk?"Повідомлення":"Messages"}</span>{inboxUnread>0&&<b>{inboxUnread>9?"9+":inboxUnread}</b>}</Link>
      <Link to="/chat"><MessageCircleMore size={19}/><span>{uk?"Кімнати":"Rooms"}</span></Link>
    </nav>
  </main>;
}
