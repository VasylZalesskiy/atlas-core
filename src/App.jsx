import {useMemo,useState} from "react";
import {Routes,Route} from "react-router-dom";
import {Analytics} from "@vercel/analytics/react";
import {SpeedInsights} from "@vercel/speed-insights/react";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import PilotGate from "./components/PilotGate";
import Home from "./pages/Home";
import Solution from "./pages/Solution";
import Profile from "./pages/Profile";
import PublicPassport from "./pages/PublicPassport";
import Chat from "./pages/Chat";
import Market from "./pages/Market";
import Requests from "./pages/Requests";
import dict from "./data/translations";

export default function App(){
  const [lang,setLang]=useState("uk");
  const t=useMemo(()=>dict[lang],[lang]);
  return <>
    <PilotGate lang={lang}>
      <Header lang={lang} setLang={setLang}/>
      <Routes>
        <Route path="/" element={<Home t={t} lang={lang}/>}/>
        <Route path="/solution" element={<Solution t={t} lang={lang}/>}/>
        <Route path="/requests" element={<Requests lang={lang}/>}/>
        <Route path="/profile" element={<Profile t={t} lang={lang}/>}/>
        <Route path="/chat" element={<Chat/>}/>
        <Route path="/market" element={<Market/>}/>
        <Route path="/p/:slug" element={<PublicPassport lang={lang}/>}/>
      </Routes>
      <BottomNav lang={lang}/>
      <footer>Atlas 2.6 · {lang==="uk"?"Тестова версія":"Test version"} · {t.principle}</footer>
    </PilotGate>
    <Analytics/>
    <SpeedInsights/>
  </>;
}
