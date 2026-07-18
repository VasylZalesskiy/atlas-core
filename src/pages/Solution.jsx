import {useMemo,useState} from "react";
import {Link,useLocation} from "react-router-dom";
import {ArrowLeft,CheckCircle2,MapPin} from "lucide-react";
import OpportunityStep from "../components/OpportunityStep";
import SolutionSummary from "../components/SolutionSummary";
import {buildAtlasSolution} from "../services/atlasEngine";

export default function Solution({t,lang}){
  const {state}=useLocation();const [showDetails,setShowDetails]=useState(false);const task=state?.task||t.taskPh;const where=state?.where||"";
  const result=useMemo(()=>buildAtlasSolution(task,where,lang),[task,where,lang]);
  return <main className="page"><div className="shell"><Link className="back" to="/"><ArrowLeft size={18}/>{t.back}</Link><div className="title"><div className="ok"><CheckCircle2/></div><div><h1>{t.found}</h1><p>{t.sub}</p></div></div><div className="goalCard"><div><span>{t.goal}</span><strong>{result.goal.originalGoal}</strong></div><div><span>{t.location}</span><strong><MapPin size={16}/>{where||t.notSpecified}</strong></div></div><SolutionSummary result={result} t={t}/><section className="opportunityChain">{result.chain.map(step=><OpportunityStep key={step.requirement.id} step={step} t={t} showDetails={showDetails}/>)}</section><button className="primary detailsButton" onClick={()=>setShowDetails(value=>!value)}>{showDetails?t.hideDetails:t.showDetails}</button><section className="alternatives"><h2>{t.alternatives}</h2>{result.alternatives.length?<div className="alternativeGrid">{result.alternatives.map(({requirement,candidate})=><article key={`${requirement.id}-${candidate.id}`}><span>{requirement.title}</span><h3>{candidate.title}</h3><p>{candidate.city} · {candidate.distanceKm} km · {candidate.trustScore}%</p></article>)}</div>:<p>{t.noAlternatives}</p>}</section></div></main>;
}
