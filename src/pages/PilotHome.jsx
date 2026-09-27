import {useRef,useState} from "react";
import {
  Camera,HandHeart,Laptop,Leaf,LoaderCircle,MapPin,Search,
  ShoppingBasket,Sparkles,Wrench,X
} from "lucide-react";
import {Link,useNavigate} from "react-router-dom";
import VoiceTaskInput from "../components/VoiceTaskInput";
import {saveSearchHistory,solutionUrl} from "../services/searchHistory";
import "../styles/pilotRedesign.css";
import "../styles/homeReference.css";

const medicalPattern=/болить|біль|травм|кровотеч|температур|задишк|непритом|лікар|медич|pain|hurt|injur|bleed|doctor|medical/i;

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
      canvas.getContext("2d").drawImage(img,0,0,width,height);
      resolve(canvas.toDataURL("image/jpeg",0.78));
    };
    img.onerror=()=>reject(new Error("image-decode-failed"));
    img.src=source;
  }catch(error){reject(error)}
})}

export default function PilotHome({lang="uk"}){
  const uk=lang!=="en";
  const [task,setTask]=useState("");
  const [where,setWhere]=useState("");
  const [photo,setPhoto]=useState(null);
  const [visionBusy,setVisionBusy]=useState(false);
  const [visionNote,setVisionNote]=useState("");
  const fileRef=useRef(null);
  const nav=useNavigate();

  function submit(event){
    event.preventDefault();
    const q=task.trim();
    if(!q)return;
    saveSearchHistory({task:q,where});
    if(medicalPattern.test(q)){
      nav(solutionUrl(q,where));
      return;
    }
    const params=new URLSearchParams({q});
    if(where.trim())params.set("where",where.trim());
    nav(`/results?${params.toString()}`);
  }

  async function choosePhoto(event){
    const file=event.target.files?.[0];
    if(!file)return;
    setVisionBusy(true);setVisionNote("");
    try{
      setPhoto(await readImage(file));
      const image=await compressImage(file);
      const response=await fetch("/api/vision",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image,lang})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data?.error||"vision-failed");
      const nextTask=data?.task||(data?.name?(uk?`Знайти рішення: ${data.name}`:`Find a solution: ${data.name}`):"");
      if(nextTask)setTask(nextTask);
      setVisionNote(data?.note||data?.name||"");
    }catch{
      setVisionNote(uk?"Не вдалося розпізнати фото. Опишіть задачу текстом.":"Could not recognize the photo. Describe the task in text.");
    }finally{setVisionBusy(false)}
  }

  function clearPhoto(){
    setPhoto(null);setVisionNote("");
    if(fileRef.current)fileRef.current.value="";
  }

  const tiles=[
    {icon:ShoppingBasket,label:uk?"Продукти":"Food"},
    {icon:Wrench,label:uk?"Інструменти":"Tools"},
    {icon:Laptop,label:uk?"Послуги":"Services"},
    {icon:HandHeart,label:uk?"Допомога":"Help"}
  ];

  return <main className="homeRef">
    <section className="homeRefHero">
      <div className="homeRefHeroText">
        <span className="homeRefEyebrow">ATLAS</span>
        <h1>{uk?<><strong>Твої можливості</strong> — це частинка чиєїсь задачі</>:<><strong>Your capabilities</strong> are part of someone else's task</>}</h1>
        <p>{uk?"Знайди рішення. Запропонуй допомогу. Будь поруч.":"Find a solution. Offer help. Be nearby."}</p>
      </div>
      <div className="homeRefArt" aria-hidden="true">
        <span className="homeRefArtCircle large"><Leaf size={28}/></span>
        <span className="homeRefArtCircle mid"><ShoppingBasket size={23}/></span>
        <span className="homeRefArtCircle small"><Sparkles size={18}/></span>
      </div>
    </section>

    <form className="homeRefSearch" onSubmit={submit}>
      <label>{uk?"Опишіть задачу":"Describe the task"}</label>
      <div className="homeRefTask">
        <VoiceTaskInput value={task} onChange={setTask} lang={lang} placeholder={uk?"Наприклад: потрібен генератор на сьогодні":"For example: I need a generator today"}/>
        <button className="homeRefCamera" type="button" onClick={()=>fileRef.current?.click()} aria-label={uk?"Пошук за фото":"Search by photo"}><Camera size={17}/></button>
        <input ref={fileRef} className="pilotFileInput" type="file" accept="image/*" capture="environment" onChange={choosePhoto}/>
      </div>

      {photo&&<div className="homeRefPhoto"><img src={photo} alt=""/><span>{visionBusy?<><LoaderCircle className="spin" size={15}/>{uk?"Розпізнаю фото…":"Recognizing photo…"}</>:visionNote|| (uk?"Фото додано":"Photo added")}</span><button type="button" onClick={clearPhoto}><X size={16}/></button></div>}

      <label className="homeRefLocation"><MapPin size={15}/><input value={where} onChange={e=>setWhere(e.target.value)} placeholder={uk?"Місто, район або область — необов’язково":"City, district or region — optional"}/></label>
      <button className="homeRefFind" type="submit" disabled={!task.trim()||visionBusy}><Search size={17}/>{uk?"Знайти рішення":"Find a solution"}</button>
    </form>

    <Link className="homeRefCapabilities" to="/me">
      <span className="homeRefCapIcon"><Sparkles size={20}/></span>
      <span><strong>{uk?"Твої можливості":"Your capabilities"}</strong><small>{uk?"Що я маю, вмію, можу":"What I have, know and can do"}</small></span>
      <b>→</b>
    </Link>

    <div className="homeRefTiles">
      {tiles.map(({icon:Icon,label})=><div className="homeRefTile" key={label}><span><Icon size={22}/></span><small>{label}</small></div>)}
    </div>
  </main>;
}