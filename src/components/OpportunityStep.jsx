import {CheckCircle2,MapPin,Search} from "lucide-react";

export default function OpportunityStep({step,t,showDetails}){
  if(step.missing)return <article className="opportunityStep missingStep"><div className="stepNumber">{step.index}</div><div className="stepBody"><span className="stepLabel">{t.required}</span><h2>{step.requirement.title}</h2><div className="missingMessage"><strong>{t.missing}</strong><p>{t.missingText}</p><button className="secondary"><Search size={17}/>{t.expand}</button></div></div></article>;
  const item=step.selected;
  return <article className="opportunityStep"><div className="stepNumber">{step.index}</div><div className="stepBody"><span className="stepLabel">{t.required}</span><h2>{step.requirement.title}</h2><div className="matchedOpportunity"><div className="matchIcon"><CheckCircle2/></div><div className="matchMain"><span className="stepLabel">{t.selected}</span><h3>{item.title}</h3><p>{item.description}</p><div className="opportunityMeta"><span><MapPin size={15}/>{item.city}</span><span>{item.distanceKm} km</span><span>{t.availability}: {t[item.availability]}</span><span>{t.trust}: {item.trustScore}%</span></div><small><b>{t.why}:</b> {t.matchReason}</small>{showDetails&&<div className="contactNotice">{item.ownerDisplayName} · {t.contactNotice}</div>}</div></div></div></article>;
}
