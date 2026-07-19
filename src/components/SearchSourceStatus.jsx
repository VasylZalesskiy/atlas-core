import {CircleAlert,Database,ShieldAlert} from "lucide-react";

import {getRepositoryMessageKey} from "../features/passport/passportUx";
export default function SearchSourceStatus({status,results,emergency,repositoryMode,repositoryReason,localEntryCount=0,t}){
  const state=emergency&&!['loading','unavailable'].includes(status)?"emergency":status;const Icon=state==="matches"?Database:state==="emergency"?ShieldAlert:CircleAlert;
  const honestKey=getRepositoryMessageKey({mode:repositoryMode,reason:repositoryReason,hasEntries:localEntryCount>0});const copy=status==="matches"||status==="loading"||emergency?t.searchStatus[state]:t.repositoryStatus[honestKey];
  return <section className={`sourceStatus ${state}`}><Icon/><div><h2>{copy?.title||t.searchStatus.loading.title}</h2><p>{copy?.description||t.searchStatus.loading.description}</p>{results.length>0&&<strong className="resultCount">{results.length} {t.actionableMatches}</strong>}</div></section>;
}
