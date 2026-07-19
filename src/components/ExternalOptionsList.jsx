import {ExternalLink,MapPinned,Phone} from "lucide-react";

export default function ExternalOptionsList({options,onAction,t}){
  return <section className="externalOptions"><p className="externalSafety"><ExternalLink/>{t.externalSafety}</p><div className="sectionHeading"><span>{t.externalSearch}</span><h2>{t.externalDirections}</h2></div>{options.map((option,index)=>{const Icon=option.actionType==="call"?Phone:option.actionType==="directions"?MapPinned:ExternalLink;return <article key={`${option.title}-${index}`}><div><span className={`sourceBadge ${option.sourceType}`}>{t.sourceLabels[option.sourceType]}</span><h3>{option.title}</h3><p>{option.description}</p><small>{option.distance}</small></div>{option.actionType==="call"?<a className="emergencyButton" href={option.actionUrl}><Icon size={17}/>{option.actionLabel}</a>:<button className="secondary" type="button" onClick={()=>onAction(option)}><Icon size={17}/>{option.actionLabel}</button>}</article>})}</section>;
}
