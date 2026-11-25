import {useEffect,useState} from "react";
import {useNavigate} from "react-router-dom";
import {MapPin,RotateCcw,Search} from "lucide-react";
import ThinkingState from "../components/ThinkingState";
import VoiceTaskInput from "../components/VoiceTaskInput";
import LocationAutocomplete,{rememberedAtlasLocation,rememberAtlasLocation} from "../components/LocationAutocomplete";
import {trackAtlas} from "../services/analytics";
import {getCurrentLocation} from "../services/geolocation";
import {saveSearchHistory,solutionUrl} from "../services/searchHistory";

const examples={
  uk:["Болить живіт","Потрібен генератор","Хочу продати овочі","Пробило колесо"],
  en:["I have stomach pain","I need a generator","I want to sell vegetables","I have a flat tire"]
};

const localTaskPattern=/поруч|де\s+знайти|потрібен|потрібна|потрібно|купити|придбати|оренду|пробило|болить|лікар|аптек|магазин|майстер|сервіс|таксі|достав|генератор|сьогодні|термінов|nearby|where\s+can\s+i\s+find|need|buy|rent|flat\s+tire|pain|doctor|pharmacy|store|repair|taxi|delivery|today|urgent/i;

function taskMayNeedLocation(task){return localTaskPattern.test(String(task||""))}

export default function Home({t,lang}){
  const [task,setTask]=useState("");
  const [where,setWhere]=useState(()=>rememberedAtlasLocation());
  const [geoLocation,setGeoLocation]=useState(null);
  const [thinking,setThinking]=useState(false);
  const [activeStep,setActiveStep]=useState(0);
  const nav=useNavigate();

  useEffect(()=>{
    if(!thinking)return;
    const timer=setInterval(()=>setActiveStep(step=>Math.min(step+1,t.thinkingSteps.length-1)),480);
    const done=setTimeout(()=>nav(solutionUrl(task,where),geoLocation?{state:{geoLocation}}:undefined),850);
    return()=>{clearInterval(timer);clearTimeout(done)};
  },[thinking,nav,task,where,geoLocation,t.thinkingSteps.length]);

  async function go(e){
    e.preventDefault();
    const cleanTask=task.trim();
    if(!cleanTask)return;

    let nextLocation=null;
    if(!where.trim()&&taskMayNeedLocation(cleanTask)){
      try{nextLocation=await getCurrentLocation()}catch{}
    }
    setGeoLocation(nextLocation);
    if(where.trim())rememberAtlasLocation(where);

    trackAtlas("Atlas Search Submitted",{
      language:lang,
      location_provided:Boolean(where.trim()||nextLocation),
      source:"home"
    });
    saveSearchHistory({task:cleanTask,where});
    setActiveStep(0);
    setThinking(true);
  }

  function newSearch(){
    setTask("");
    setWhere(rememberedAtlasLocation());
    setGeoLocation(null);
    setThinking(false);
    setActiveStep(0);
    window.setTimeout(()=>document.querySelector(".searchbox textarea")?.focus(),0);
  }

  if(thinking)return <ThinkingState steps={t.thinkingSteps} activeStep={activeStep}/>;

  const title=lang==="uk"?"Твої можливості — це частинка чиєїсь задачі":"Your capabilities are part of someone else’s task";
  const placeholder=lang==="uk"
    ?"Наприклад: потрібен генератор на сьогодні"
    :"For example: I need a generator today";
  const locationLabel=lang==="uk"?"Де це потрібно? (необов'язково)":"Where is it needed? (optional)";
  const hasSearch=Boolean(task.trim()||where.trim());

  return <main className="home">
    <section className="hero" style={{paddingTop:40}}>
      <h1 style={{fontSize:"clamp(32px,4vw,48px)",lineHeight:1.08,letterSpacing:"-.035em",marginBottom:22}}>
        {title}
      </h1>

      <form className="searchbox mainSearchbox" onSubmit={go} style={{padding:20}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
          <label style={{fontSize:12}}>{lang==="uk"?"Опишіть вашу задачу":"Describe your task"}</label>
          {hasSearch&&<button type="button" onClick={newSearch} style={{border:0,background:"transparent",color:"#0d7a41",display:"inline-flex",alignItems:"center",gap:6,fontSize:12,fontWeight:900,cursor:"pointer"}}><RotateCcw size={15}/>{lang==="uk"?"Новий пошук":"New search"}</button>}
        </div>
        <VoiceTaskInput autoFocus value={task} onChange={setTask} lang={lang} placeholder={placeholder} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey&&!event.nativeEvent?.isComposing){event.preventDefault();event.currentTarget.form?.requestSubmit()}}}/>

        <label style={{fontSize:12}}>{locationLabel}</label>
        <div className="location">
          <MapPin size={18}/>
          <LocationAutocomplete value={where} onChange={setWhere} lang={lang} placeholder={t.wherePh}/>
        </div>

        <div style={{display:"grid",gridTemplateColumns:hasSearch?"1fr auto":"1fr",gap:9}}>
          <button className="primary" type="submit" style={{fontSize:14,padding:"13px 18px"}}><Search size={18}/>{t.build}</button>
          {hasSearch&&<button className="secondary" type="button" onClick={newSearch} style={{justifyContent:"center",whiteSpace:"nowrap",padding:"12px 14px"}}><RotateCcw size={17}/>{lang==="uk"?"Очистити все":"Clear all"}</button>}
        </div>
        <small style={{color:"#69756e",lineHeight:1.45}}>
          {lang==="uk"
            ?"Atlas зберігає текст запиту для покращення. Не додавайте особисті дані."
            :"Atlas stores the query text for improvement. Do not include personal data."}
        </small>
      </form>

      <div className="examples" style={{fontSize:12,marginTop:16}}>
        <span>{t.examples}:</span>
        {examples[lang].map(example=><button key={example} type="button" onClick={()=>setTask(example)} style={{fontSize:12,padding:"7px 10px"}}>{example}</button>)}
      </div>

      <p className="principle" style={{fontSize:13,marginTop:26}}>{t.principle}</p>
    </section>
  </main>;
}
