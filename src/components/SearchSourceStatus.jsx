import {CircleAlert,Database,ShieldAlert} from "lucide-react";

export default function SearchSourceStatus({status,results,emergency,t}){
  const state=emergency&&!['loading','unavailable'].includes(status)?"emergency":status;const Icon=state==="matches"?Database:state==="emergency"?ShieldAlert:CircleAlert;
  return <section className={`sourceStatus ${state}`}><Icon/><div><h2>{t.searchStatus[state]?.title||t.searchStatus.loading.title}</h2><p>{t.searchStatus[state]?.description||t.searchStatus.loading.description}</p>{results.length>0&&<div className="passportResults">{results.map((result,index)=><article key={`${result.actionUrl}-${index}`}><span className="sourceBadge atlas">{t.sourceLabels.atlas_passports}</span><h3>{result.title}</h3><p>{result.description}</p><small>{result.location||t.notSpecified} · {t.availabilityUnknown}</small></article>)}</div>}</div></section>;
}
