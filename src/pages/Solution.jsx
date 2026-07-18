import {useMemo,useState} from "react";
import {Link,useLocation,useNavigate} from "react-router-dom";
import {ArrowLeft,MapPin,Search} from "lucide-react";
import UrgencyBanner from "../components/UrgencyBanner";
import BestActionCard from "../components/BestActionCard";
import DemoRouteMap from "../components/DemoRouteMap";
import DecisionModeSelector from "../components/DecisionModeSelector";
import SolutionPath from "../components/SolutionPath";
import AlternativeOptions from "../components/AlternativeOptions";
import HiddenContactsCard from "../components/HiddenContactsCard";
import SolutionMetrics from "../components/SolutionMetrics";
import {buildDecisionSolution} from "../services/atlasEngine";
import useGeolocation from "../hooks/useGeolocation";
import {getScenarioSearchQuery,openGoogleMapsDirections,openGoogleMapsSearch} from "../services/maps";

const examples={uk:["Болить живіт","Потрібна найближча аптека","Пробило колесо","Хочу відкрити кав'ярню"],en:["I have stomach pain","I need the nearest pharmacy","I have a flat tire","I want to open a coffee shop"]};

export default function Solution({t,lang}){
  const {state}=useLocation();const navigate=useNavigate();const initialTask=state?.task||t.taskPh;const initialWhere=state?.where||"";const [task,setTask]=useState(initialTask);const [where,setWhere]=useState(initialWhere);const [forcedMode,setForcedMode]=useState(null);const [showDetails,setShowDetails]=useState(false);const geo=useGeolocation(state?.geoLocation||null);
  const solution=useMemo(()=>buildDecisionSolution(initialTask,initialWhere,lang,forcedMode),[initialTask,initialWhere,lang,forcedMode]);
  const searchQuery=useMemo(()=>getScenarioSearchQuery(solution,lang),[solution,lang]);
  function submit(e){e.preventDefault();if(task.trim()){setForcedMode(null);setShowDetails(false);navigate("/solution",{state:{task,where,geoLocation:geo.location}})}}
  function openSearch(){openGoogleMapsSearch(searchQuery)}
  async function openRoute(){const origin=geo.location||await geo.requestLocation();if(origin)openGoogleMapsDirections(origin,searchQuery)}
  return <main className="decisionPage"><div className="decisionTop"><Link className="back" to="/"><ArrowLeft size={18}/>{t.back}</Link><span>{t.demoDataNotice}</span></div><div className="decisionLayout"><aside className="decisionSidebar"><form onSubmit={submit}><label>{t.task}</label><textarea required value={task} onChange={e=>setTask(e.target.value)}/><label>{t.location}</label><div className="location"><MapPin size={18}/><input value={where} onChange={e=>setWhere(e.target.value)} placeholder={t.wherePh}/></div><button className="primary"><Search size={18}/>{t.build}</button></form><div className="decisionExamples"><span>{t.examples}</span>{examples[lang].map(example=><button key={example} onClick={()=>setTask(example)}>{example}</button>)}</div><DecisionModeSelector value={forcedMode||solution.mode} onChange={setForcedMode} t={t}/><p className="atlasExplanation">{t.atlasExplanation}</p></aside><section className="decisionMain"><UrgencyBanner mode={solution.mode} t={t}/>{solution.warning&&<div className={`safetyWarning ${solution.mode}`}>{solution.warning}</div>}<BestActionCard solution={solution} t={t} onShowDetails={()=>setShowDetails(true)} geo={geo} onSearch={openSearch} onRoute={openRoute}/><SolutionPath solution={solution} t={t}/><SolutionMetrics metrics={solution.metrics} t={t} mode={solution.mode}/></section><aside className="decisionRight"><DemoRouteMap route={solution.route} t={t} hasRealLocation={Boolean(geo.location)} onOpenRealMap={geo.location?openRoute:openSearch}/><AlternativeOptions alternatives={solution.alternatives} t={t}/><HiddenContactsCard visible={showDetails} onToggle={()=>setShowDetails(value=>!value)} policy={solution.contactPolicy} t={t}/></aside></div></main>;
}
