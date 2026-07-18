import {useEffect,useState} from "react";
import {Link,useNavigate} from "react-router-dom";
import {MapPin,Search} from "lucide-react";
import ThinkingState from "../components/ThinkingState";
import RealLocationCard from "../components/RealLocationCard";
import useGeolocation from "../hooks/useGeolocation";

const examples={uk:["Хочу побудувати теплицю","Потрібно перевезти 20 тонн картоплі","Хочу відкрити кав'ярню","Потрібно викопати фундамент"],en:["I want to build a greenhouse","I need to transport 20 tonnes of potatoes","I want to open a coffee shop","I need to excavate a foundation"]};

export default function Home({t,lang}){
  const [task,setTask]=useState("");const [where,setWhere]=useState("");const [thinking,setThinking]=useState(false);const [activeStep,setActiveStep]=useState(0);const nav=useNavigate();const geo=useGeolocation();
  useEffect(()=>{if(!thinking)return;const timer=setInterval(()=>setActiveStep(step=>Math.min(step+1,t.thinkingSteps.length-1)),480);const done=setTimeout(()=>nav("/solution",{state:{task,where,geoLocation:geo.location}}),2500);return()=>{clearInterval(timer);clearTimeout(done)}},[thinking,nav,task,where,geo.location,t.thinkingSteps.length]);
  function go(e){e.preventDefault();if(task.trim()){setActiveStep(0);setThinking(true)}}
  if(thinking)return <ThinkingState steps={t.thinkingSteps} activeStep={activeStep}/>;
  return <main className="home"><section className="hero"><h1>{t.h1}<span>{t.h2}</span></h1><form className="searchbox" onSubmit={go}><label>{t.task}</label><textarea required value={task} onChange={e=>setTask(e.target.value)} placeholder={t.taskPh}/><label>{t.where}</label><div className="location"><MapPin size={20}/><input value={where} onChange={e=>setWhere(e.target.value)} placeholder={t.wherePh}/></div><button className="primary"><Search size={20}/>{t.build}</button></form><RealLocationCard geo={geo} t={t}/><div className="examples"><span>{t.examples}:</span>{examples[lang].map(example=><button key={example} onClick={()=>setTask(example)}>{example}</button>)}</div><Link className="profileLink" to="/profile">{t.create}</Link><p className="principle">{t.principle}</p></section></main>;
}
