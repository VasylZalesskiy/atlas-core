import {useEffect,useMemo,useState} from "react";
import {useLocation,useNavigate} from "react-router-dom";
import {MapPin,Search} from "lucide-react";
import UrgencyBanner from "../components/UrgencyBanner";
import BestActionCard from "../components/BestActionCard";
import DemoRouteMap from "../components/DemoRouteMap";
import DecisionModeSelector from "../components/DecisionModeSelector";
import SolutionPath from "../components/SolutionPath";
import HiddenContactsCard from "../components/HiddenContactsCard";
import SolutionMetrics from "../components/SolutionMetrics";
import SearchSourceStatus from "../components/SearchSourceStatus";
import ExternalOptionsList from "../components/ExternalOptionsList";
import PageNavigation from "../components/PageNavigation";
import {buildDecisionSolution} from "../services/atlasEngine";
import {searchAtlasPassports} from "../services/opportunitySearch";
import {buildExternalOptions} from "../services/externalOptions";
import useGeolocation from "../hooks/useGeolocation";
import {getScenarioSearchQuery,openGoogleMapsDirections,openGoogleMapsSearch} from "../services/maps";

const examples={uk:["Болить живіт","Потрібна найближча аптека","Пробило колесо","Хочу відкрити кав'ярню"],en:["I have stomach pain","I need the nearest pharmacy","I have a flat tire","I want to open a coffee shop"]};

export default function Solution({t,lang,setLastQuery,setLastLocation,clearRequest}){
  const {state}=useLocation();const navigate=useNavigate();const hasRequest=Boolean(state?.task?.trim());const initialTask=hasRequest?state.task:"";const initialWhere=state?.where||"";const [task,setTask]=useState(initialTask);const [where,setWhere]=useState(initialWhere);const [forcedMode,setForcedMode]=useState(null);const [showDetails,setShowDetails]=useState(false);const [passportSearch,setPassportSearch]=useState({status:"loading",results:[]});const geo=useGeolocation(state?.geoLocation||null);
  const solution=useMemo(()=>hasRequest?buildDecisionSolution(initialTask,initialWhere,lang,forcedMode):null,[hasRequest,initialTask,initialWhere,lang,forcedMode]);
  const searchQuery=useMemo(()=>solution?getScenarioSearchQuery(solution,lang):"",[solution,lang]);const externalOptions=useMemo(()=>solution?buildExternalOptions(solution,t):[],[solution,t]);
  useEffect(()=>{let active=true;if(!solution)return;setPassportSearch({status:"loading",results:[]});searchAtlasPassports(solution.goal,initialWhere).then(result=>{if(active)setPassportSearch(result)});return()=>{active=false}},[solution,initialWhere]);
  function submit(e){e.preventDefault();if(task.trim()){setLastQuery(task);setLastLocation(where);setForcedMode(null);setShowDetails(false);navigate("/solution",{state:{task,where,geoLocation:geo.location}})}}
  function newRequest(){clearRequest();navigate("/",{state:{focusQuery:true}})}function openSearch(){openGoogleMapsSearch(searchQuery)}async function openRoute(query=searchQuery){const origin=geo.location||await geo.requestLocation();if(origin)openGoogleMapsDirections(origin,query)}
  function handleExternal(option){if(option.actionType==="directions")openRoute(option.actionQuery);else if(option.actionType==="details")document.querySelector("#demo-route")?.scrollIntoView({behavior:"smooth"});else openGoogleMapsSearch(option.actionQuery)}
  if(!solution)return <main className="decisionPage emptySolution"><PageNavigation title={t.solutionPage} t={t} showForward showProfile onNewRequest={newRequest}/><section><h1>{t.requestNotFound}</h1><p>{t.requestNotFoundText}</p><button className="primary" onClick={newRequest}>{t.createNewRequest}</button></section></main>;
  return <main className="decisionPage"><PageNavigation title={t.solutionPage} t={t} showForward showProfile onNewRequest={newRequest}/><div className="decisionTop"><span>{t.demoDataNotice}</span></div><div className="decisionLayout"><aside className="decisionSidebar"><form onSubmit={submit}><label>{t.task}</label><textarea required value={task} onChange={e=>setTask(e.target.value)}/><label>{t.location}</label><div className="location"><MapPin size={18}/><input value={where} onChange={e=>setWhere(e.target.value)} placeholder={t.wherePh}/></div><button className="primary"><Search size={18}/>{t.build}</button></form><div className="decisionExamples"><span>{t.examples}</span>{examples[lang].map(example=><button key={example} onClick={()=>setTask(example)}>{example}</button>)}</div><DecisionModeSelector value={forcedMode||solution.mode} onChange={setForcedMode} t={t}/><p className="atlasExplanation">{t.atlasExplanation}</p></aside><section className="decisionMain"><UrgencyBanner mode={solution.mode} t={t}/>{solution.warning&&<div className={`safetyWarning ${solution.mode}`}>{solution.warning}</div>}<SearchSourceStatus status={passportSearch.status} results={passportSearch.results} emergency={solution.mode==="emergency"} t={t}/><BestActionCard solution={solution} t={t} onShowDetails={()=>setShowDetails(true)} geo={geo} onSearch={openSearch} onRoute={openRoute}/><ExternalOptionsList options={externalOptions} onAction={handleExternal} t={t}/><SolutionPath solution={solution} t={t}/><SolutionMetrics metrics={solution.metrics} t={t} mode={solution.mode}/></section><aside className="decisionRight"><DemoRouteMap route={solution.route} t={t} hasRealLocation={Boolean(geo.location)} onOpenRealMap={geo.location?openRoute:openSearch}/><HiddenContactsCard visible={showDetails} onToggle={()=>setShowDetails(value=>!value)} policy={solution.contactPolicy} t={t}/></aside></div></main>;
}
