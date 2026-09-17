import {useEffect,useMemo,useState} from "react";
import {Navigate,Routes,Route,useLocation} from "react-router-dom";
import {Analytics} from "@vercel/analytics/react";
import {SpeedInsights} from "@vercel/speed-insights/react";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import SolutionNavigation from "./components/SolutionNavigation";
import MobileHome from "./components/MobileHome";
import PilotGate from "./components/PilotGate";
import MatchNotificationBridge from "./components/MatchNotificationBridge";
import VoicePrivacyControl from "./components/VoicePrivacyControl";
import Home from "./pages/Home";
import Solution from "./pages/Solution";
import Profile from "./pages/Profile";
import PublicPassport from "./pages/PublicPassport";
import Chat from "./pages/Chat";
import Market from "./pages/Market";
import Requests from "./pages/Requests";
import Needs from "./pages/Needs";
import MatchSearch from "./pages/MatchSearch";
import ShareApp from "./pages/ShareApp";
import CatalogAdmin from "./pages/CatalogAdmin";
import TomatoPilot from "./pages/TomatoPilot";
import i18n from "./i18n";

const supportedLanguages=new Set(["uk","en","zh","hi"]);
const normalizeLanguage=value=>{
  const code=String(value||"").toLowerCase().split("-")[0];
  return supportedLanguages.has(code)?code:"uk";
};

export default function App(){
  const [lang,setLangState]=useState(()=>normalizeLanguage(i18n.resolvedLanguage||i18n.language));
  const setLang=next=>{
    const normalized=normalizeLanguage(next);
    setLangState(normalized);
    i18n.changeLanguage(normalized);
  };
  const t=useMemo(()=>i18n.getResourceBundle(lang,"translation")||i18n.getResourceBundle("uk","translation"),[lang]);
  const location=useLocation();
  const catalogAdminRoute=location.pathname.startsWith("/admin/catalog");
  const solutionRoute=location.pathname==="/solution";
  const chatRoute=location.pathname==="/chat";

  useEffect(()=>{
    const sync=lng=>setLangState(normalizeLanguage(lng));
    i18n.on("languageChanged",sync);
    return ()=>i18n.off("languageChanged",sync);
  },[]);

  useEffect(()=>{
    try{localStorage.setItem("atlas-language",lang)}catch{}
    document.documentElement.lang=lang;
  },[lang]);

  return <>
    {catalogAdminRoute?<Routes><Route path="/admin/catalog" element={<CatalogAdmin/>}/><Route path="*" element={<Navigate to="/admin/catalog" replace/>}/></Routes>:<PilotGate lang={lang} bypass={location.pathname.startsWith("/share")}>
      <Header lang={lang} setLang={setLang}/>
      <MatchNotificationBridge lang={lang}/>
      {solutionRoute&&<SolutionNavigation lang={lang}/>} 
      {chatRoute&&<VoicePrivacyControl/>}
      <Routes>
        <Route path="/" element={<><Home t={t} lang={lang}/><MobileHome lang={lang}/></>}/>
        <Route path="/solution" element={<Solution t={t} lang={lang}/>}/>
        <Route path="/needs" element={<Needs lang={lang}/>}/>
        <Route path="/matches" element={<MatchSearch lang={lang}/>}/>
        <Route path="/share" element={<ShareApp lang={lang}/>}/>
        <Route path="/requests" element={<Requests lang={lang}/>}/>
        <Route path="/profile" element={<Profile t={t} lang={lang}/>}/>
        <Route path="/chat" element={<Chat/>}/>
        <Route path="/market" element={<Market/>}/>
        <Route path="/tomatoes" element={<TomatoPilot lang={lang}/>}/>
        <Route path="/p/:slug" element={<PublicPassport lang={lang}/>}/>
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>
      <BottomNav lang={lang}/>
      <footer>Atlas 2.6 · {lang==="uk"?"Тестова версія":lang==="zh"?"测试版":lang==="hi"?"परीक्षण संस्करण":"Test version"} · {t.principle}</footer>
    </PilotGate>}
    <Analytics/>
    <SpeedInsights/>
  </>;
}
