import {useMemo,useState} from "react";
import {Routes,Route} from "react-router-dom";
import Header from "./components/Header";
import Home from "./pages/Home";
import Solution from "./pages/Solution";
import Profile from "./pages/Profile";
import dict from "./data/translations";

export default function App(){const [lang,setLang]=useState("uk");const t=useMemo(()=>dict[lang],[lang]);return <><Header lang={lang} setLang={setLang} t={t}/><Routes><Route path="/" element={<Home t={t}/>}/><Route path="/solution" element={<Solution t={t}/>}/><Route path="/profile" element={<Profile t={t}/>}/></Routes><footer>Atlas 2.0 Foundation</footer></>}
