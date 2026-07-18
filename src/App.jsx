import {useMemo,useState} from "react";
import {Routes,Route} from "react-router-dom";
import Header from "./components/Header";
import Home from "./pages/Home";
import Solution from "./pages/Solution";
import Profile from "./pages/Profile";
import dict from "./data/translations";

function readSession(key){try{return sessionStorage.getItem(key)||""}catch{return ""}}
function writeSession(key,value){try{if(value)sessionStorage.setItem(key,value);else sessionStorage.removeItem(key)}catch{/* Сесійне сховище може бути вимкнене браузером. */}}

export default function App(){
  const [lang,setLang]=useState("uk");const [lastQuery,setLastQueryState]=useState(()=>readSession("atlas:last-query"));const [lastLocation,setLastLocationState]=useState(()=>readSession("atlas:last-location"));const t=useMemo(()=>dict[lang],[lang]);
  function setLastQuery(value){setLastQueryState(value);writeSession("atlas:last-query",value)}
  function setLastLocation(value){setLastLocationState(value);writeSession("atlas:last-location",value)}
  function clearRequest(){setLastQuery("");setLastLocation("")}
  return <><Header lang={lang} setLang={setLang} t={t}/><Routes><Route path="/" element={<Home t={t} lang={lang} lastQuery={lastQuery} lastLocation={lastLocation} setLastQuery={setLastQuery} setLastLocation={setLastLocation}/>}/><Route path="/solution" element={<Solution t={t} lang={lang} setLastQuery={setLastQuery} setLastLocation={setLastLocation} clearRequest={clearRequest}/>}/><Route path="/profile" element={<Profile t={t} clearRequest={clearRequest}/>}/></Routes><footer>Atlas 2.4 · {t.principle}</footer></>;
}
