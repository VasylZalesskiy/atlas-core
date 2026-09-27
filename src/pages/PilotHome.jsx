import {useState} from "react";
import {Link,useNavigate} from "react-router-dom";
import {Camera,MapPin,Search,Sparkles} from "lucide-react";
import VoiceTaskInput from "../components/VoiceTaskInput";
import {saveSearchHistory,solutionUrl} from "../services/searchHistory";
import "../styles/pilotRedesign.css";

const medicalPattern=/болить|біль|травм|кровотеч|температур|задишк|непритом|лікар|медич|pain|hurt|injur|bleed|doctor|medical/i;

export default function PilotHome({lang="uk"}){
  const uk=lang!=="en";
  const [task,setTask]=useState("");
  const [where,setWhere]=useState("");
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

  return <main className="pilotPage pilotHome">
    <section className="pilotHero">
      <p className="pilotKicker">ATLAS</p>
      <h1>{uk?<><span>Твої можливості</span> — це частинка чиєїсь задачі</>:<>Your capabilities are part of someone else's task</>}</h1>
      <p>{uk?"Знайди рішення. Запропонуй допомогу. Будь поруч.":"Find a solution. Offer help. Be nearby."}</p>
    </section>

    <form className="pilotSearchCard" onSubmit={submit}>
      <label>{uk?"Опишіть задачу":"Describe the task"}</label>
      <div className="pilotTaskInput">
        <VoiceTaskInput value={task} onChange={setTask} lang={lang} placeholder={uk?"Наприклад: потрібен генератор на сьогодні":"For example: I need a generator today"}/>
        <span className="pilotPhotoHint" title={uk?"Пошук за фото залишаємо у наступному кроці":"Photo search remains available in the next step"}><Camera size={18}/></span>
      </div>
      <label className="pilotLocation"><MapPin size={17}/><input value={where} onChange={e=>setWhere(e.target.value)} placeholder={uk?"Місто, район або область — необов’язково":"City, district or region — optional"}/></label>
      <button className="pilotPrimary" type="submit" disabled={!task.trim()}><Search size={20}/>{uk?"Знайти рішення":"Find a solution"}</button>
    </form>

    <Link className="pilotCapabilityCard" to="/me">
      <span className="pilotCapabilityIcon"><Sparkles size={26}/></span>
      <span><strong>{uk?"Твої можливості":"Your capabilities"}</strong><small>{uk?"Що я маю, вмію, можу":"What I have, know and can do"}</small></span>
      <b>→</b>
    </Link>

    <div className="pilotExamples" aria-label={uk?"Приклади можливостей":"Capability examples"}>
      <span>🥔 {uk?"Продукти":"Food"}</span>
      <span>🛠️ {uk?"Інструменти":"Tools"}</span>
      <span>💻 {uk?"Послуги":"Services"}</span>
      <span>🤝 {uk?"Допомога":"Help"}</span>
    </div>
  </main>;
}