import {createContext,useContext,useState} from "react";

const QueryDraftContext=createContext(null);
function readSession(key){try{return sessionStorage.getItem(key)||""}catch{return ""}}
function writeSession(key,value){try{if(value)sessionStorage.setItem(key,value);else sessionStorage.removeItem(key)}catch{/* Сесійне сховище може бути вимкнене браузером. */}}

export function QueryDraftProvider({children}){
  const [lastQuery,setQueryState]=useState(()=>readSession("atlas:last-query"));const [lastLocation,setLocationState]=useState(()=>readSession("atlas:last-location"));
  function setLastQuery(value){setQueryState(value);writeSession("atlas:last-query",value)}function setLastLocation(value){setLocationState(value);writeSession("atlas:last-location",value)}function clearRequest(){setLastQuery("");setLastLocation("")}
  return <QueryDraftContext.Provider value={{lastQuery,lastLocation,setLastQuery,setLastLocation,clearRequest}}>{children}</QueryDraftContext.Provider>;
}

export function useQueryDraft(){const value=useContext(QueryDraftContext);if(!value)throw new Error("useQueryDraft must be used inside QueryDraftProvider");return value}
