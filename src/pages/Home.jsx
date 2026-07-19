import {useEffect,useRef,useState} from "react";
import {useLocation,useNavigate} from "react-router-dom";
import {MapPin,Search} from "lucide-react";
import ThinkingState from "../components/ThinkingState";
import RealLocationCard from "../components/RealLocationCard";
import useGeolocation from "../hooks/useGeolocation";

const examples={uk:["Хочу побудувати теплицю","Потрібно перевезти картоплю","Хочу відкрити кав'ярню"],en:["I want to build a greenhouse","I need to transport potatoes","I want to open a coffee shop"]};

export default function Home({t,lang,lastQuery,lastLocation,setLastQuery,setLastLocation}){
  const [task,setTask]=useState(lastQuery);const [where,setWhere]=useState(lastLocation);const [thinking,setThinking]=useState(false);const [activeStep,setActiveStep]=useState(0);const nav=useNavigate();const route=useLocation();const queryRef=useRef(null);const geo=useGeolocation();
  useEffect(()=>{if(route.state?.focusQuery){queryRef.current?.focus();nav("/",{replace:true,state:null})}},[route.state,nav]);
  useEffect(()=>{if(!thinking)return;const timer=setInterval(()=>setActiveStep(step=>Math.min(step+1,t.thinkingSteps.length-1)),480);const done=setTimeout(()=>nav("/solution",{state:{task,where,geoLocation:geo.location}}),2500);return()=>{clearInterval(timer);clearTimeout(done)}},[thinking,nav,task,where,geo.location,t.thinkingSteps.length]);
  function go(e){e.preventDefault();if(task.trim()){setActiveStep(0);setThinking(true)}}
  if(thinking)return <ThinkingState steps={t.thinkingSteps} activeStep={activeStep}/>;
  function changeTask(value){setTask(value);setLastQuery(value)}function changeWhere(value){setWhere(value);setLastLocation(value)}
  return <main className="home"><section className="hero"><h1>{t.h1}<span>{t.h2}</span></h1><form className="searchbox" onSubmit={go}><label>{t.task}</label><textarea ref={queryRef} required value={task} onChange={e=>changeTask(e.target.value)} placeholder={t.taskPh}/><details className="homeLocation"><summary><MapPin size={16}/>{t.where}</summary><div className="location"><MapPin size={20}/><input value={where} onChange={e=>changeWhere(e.target.value)} placeholder={t.wherePh}/></div><RealLocationCard geo={geo} t={t}/></details><button className="primary"><Search size={20}/>{t.build}</button></form><div className="examples">{examples[lang].map(example=><button key={example} onClick={()=>changeTask(example)}>{example}</button>)}</div></section><section className="homeHow"><details><summary>{t.howAtlasWorks}</summary><p>{t.opportunityFirstExplanation}</p></details></section></main>;
}
