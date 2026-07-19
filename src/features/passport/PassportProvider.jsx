import {createContext,useCallback,useContext,useEffect,useMemo,useState} from "react";
import supabase from "../../services/supabase";
import useAuth from "../auth/useAuth";
import {selectPassportRepository} from "./repositories/passportRepositorySelector";

const PassportContext=createContext(null);
export function PassportProvider({children}){
  const {user,loading:authLoading}=useAuth();const [repositoryInfo,setRepositoryInfo]=useState(null);const [entries,setEntries]=useState([]);const [state,setState]=useState("loading");const [error,setError]=useState("");
  const reload=useCallback(async info=>{const selected=info||repositoryInfo;if(!selected)return;setState("loading");try{setEntries(await selected.repository.listEntries(user?.id||null));setError("");setState("ready")}catch(err){setError(err?.message||"request-failed");setState("error")}},[repositoryInfo,user?.id]);
  useEffect(()=>{if(authLoading)return;let active=true;(async()=>{try{const info=await selectPassportRepository({client:supabase,user});if(!active)return;setRepositoryInfo(info);setState("loading");setEntries(await info.repository.listEntries(user?.id||null));setState("ready")}catch(err){if(active){setError(err?.message||"request-failed");setState("error")}}})();return()=>{active=false}},[authLoading,user]);
  const mutate=useCallback(async action=>{if(!repositoryInfo)return null;setState("saving");try{const result=await action(repositoryInfo.repository);setEntries(await repositoryInfo.repository.listEntries(user?.id||null));setError("");setState("saved");return result}catch(err){setError(err?.message||"request-failed");setState("error");throw err}},[repositoryInfo,user?.id]);
  const value=useMemo(()=>({entries,state,error,mode:repositoryInfo?.mode||"demo",reason:repositoryInfo?.reason,createEntry:payload=>mutate(repo=>repo.createEntry(payload)),updateEntry:(id,payload)=>mutate(repo=>repo.updateEntry(id,payload)),setEntryStatus:(id,status)=>mutate(repo=>repo.setEntryStatus(id,status)),deleteEntry:id=>mutate(repo=>repo.deleteEntry(id)),reload}),[entries,state,error,repositoryInfo,mutate,reload]);
  return <PassportContext.Provider value={value}>{children}</PassportContext.Provider>;
}
export function usePassport(){const value=useContext(PassportContext);if(!value)throw new Error("usePassport must be used inside PassportProvider");return value}
