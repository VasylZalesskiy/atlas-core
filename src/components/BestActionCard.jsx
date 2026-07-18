import {MapPinned,Phone,Ambulance} from "lucide-react";

export default function BestActionCard({solution,t,onShowDetails}){
  return <section className={`bestActionCard ${solution.mode}`}><span className="eyebrow">{t.bestActionNow}</span><h2>{solution.bestAction}</h2><div className="primaryOption"><span>{t.recommendedOption} · {t.demoData}</span><h3>{solution.primaryOption.title}</h3><p>{solution.primaryOption.subtitle}</p><strong>{solution.primaryOption.status}</strong></div><div className="actionButtons"><a className="primary" href="#demo-route"><MapPinned size={18}/>{t.buildRoute}</a><button className="secondary" onClick={onShowDetails}><Phone size={18}/>{t.call}</button>{solution.mode==="emergency"&&<a className="emergencyButton" href="tel:103"><Ambulance size={18}/>{t.call103}</a>}</div>{solution.mode==="emergency"&&<small>{t.emergencyCallHint}</small>}</section>;
}
