import {useMemo,useState} from "react";
import {Routes,Route} from "react-router-dom";
import Header from "./components/Header";
import Home from "./pages/Home";
import Solution from "./pages/Solution";
import Profile from "./pages/Profile";
import PublicPassport from "./pages/PublicPassport";
import dict from "./data/translations";

export default function App(){const [lang,setLang]=useState("uk");const t=useMemo(()=>dict[lang],[lang]);return <><Header lang={lang} setLang={setLang} t={t}/><Routes><Route path="/" element={<Home t={t} lang={lang}/>}/><Route path="/solution" element={<Solution t={t} lang={lang}/>}/><Route path="/profile" element={<Profile t={t} lang={lang}/>}/><Route path="/p/:slug" element={<PublicPassport lang={lang}/>}/></Routes><footer>Atlas 2.3 · {t.principle}</footer></>}
