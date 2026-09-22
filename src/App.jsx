import {lazy,Suspense,useEffect,useMemo,useState} from "react";
import {Navigate,Routes,Route,useLocation} from "react-router-dom";
import {Analytics} from "@vercel/analytics/react";
import {SpeedInsights} from "@vercel/speed-insights/react";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import PilotGate from "./components/PilotGate";
import i18n from "./i18n";

const MatchNotificationBridge=lazy(()=>import("./components/MatchNotificationBridge"));
const SolutionNavigation=lazy(()=>import("./components/SolutionNavigation"));
const VoicePrivacyControl=lazy(()=>import("./components/VoicePrivacyControl"));
const Home=lazy(()=>import("./pages/Home"));
const MobileHome=lazy(()=>import("./components/MobileHome"));
const Solution=lazy(()=>import("./pages/Solution"));
const Profile=lazy(()=>import("./pages/Profile"));
const PublicPassport=lazy(()=>import("./pages/PublicPassport"));
const Chat=lazy(()=>import("./pages/Chat"));
const Market=lazy(()=>import("./pages/Market"));
const Requests=lazy(()=>import("./pages/Requests"));
const Needs=lazy(()=>import("./pages/Needs"));
const MatchSearch=lazy(()=>import("./pages/MatchSearch"));
const ShareApp=lazy(()=>import("./pages/ShareApp"));
const CatalogAdmin=lazy(()=>import("./pages/CatalogAdmin"));
const TomatoPilot=lazy(()=>import("./pages/TomatoPilot"));

const supportedLanguages=new Set(["uk","en"]);
const normalizeLanguage=value=>{
  const code=String(value||"").toLowerCase().split("-")[0];
  return supportedLanguages.has(code)?code:"uk";
};

function RouteLoader(){
  return <main style={{minHeight:"55vh",display:"grid",placeItems:"center",color:"#0b7540",fontWeight:800}}>ATLAS</main>;
}

function ResponsiveHome({t,lang}){
  const [mobile,setMobile]=useState(()=>window.matchMedia?.("(max-width: 760px)")?.matches??false);
  useEffect(()=>{
    const media=window.matchMedia?.("(max-width: 760px)");
    if(!media)return;
    const sync=event=>setMobile(event.matches);
    setMobile(media.matches);
    media.addEventListener?.("change",sync);
    return()=>media.removeEventListener?.("change",sync);
  },[]);
  return mobile?<MobileHome lang={lang}/>:<Home t={t} lang={lang}/>;
}

export default function App(){
  const [backgroundReady,setBackgroundReady]=useState(false);
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
    let cancelled=false;
    const start=()=>{if(!cancelled)setBackgroundReady(true)};
    const idle=window.requestIdleCallback?window.requestIdleCallback(start,{timeout:1200}):window.setTimeout(start,650);
    return()=>{
      cancelled=true;
      if(window.cancelIdleCallback&&typeof idle==="number")window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  },[]);

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
    <Suspense fallback={<RouteLoader/>}>
      {catalogAdminRoute?<Routes><Route path="/admin/catalog" element={<CatalogAdmin/>}/><Route path="*" element={<Navigate to="/admin/catalog" replace/>}/></Routes>:<PilotGate lang={lang} bypass={location.pathname.startsWith("/share")}>
        <Header lang={lang} setLang={setLang}/>
        {backgroundReady&&<Suspense fallback={null}><MatchNotificationBridge lang={lang}/></Suspense>}
        {solutionRoute&&<Suspense fallback={null}><SolutionNavigation lang={lang}/></Suspense>}
        {chatRoute&&<Suspense fallback={null}><VoicePrivacyControl/></Suspense>}
        <Routes>
          <Route path="/" element={<ResponsiveHome t={t} lang={lang}/>}/>
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
        <footer>Atlas 2.6 · {lang==="uk"?"Тестова версія":"Test version"} · {t.principle}</footer>
      </PilotGate>}
    </Suspense>
    <Analytics/>
    <SpeedInsights/>
  </>;
}
