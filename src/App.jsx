import {lazy,Suspense,useEffect,useMemo,useState} from "react";
import {Navigate,Routes,Route,useLocation} from "react-router-dom";
import {Analytics} from "@vercel/analytics/react";
import {SpeedInsights} from "@vercel/speed-insights/react";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import SolutionNavigation from "./components/SolutionNavigation";
import Solution from "./pages/Solution";
import PilotGate from "./components/PilotGate";
import i18n from "./i18n";
import {loadSolutionFlows} from "./services/solutionFlowStore";

const MatchNotificationBridge=lazy(()=>import("./components/MatchNotificationBridge"));
const VoicePrivacyControl=lazy(()=>import("./components/VoicePrivacyControl"));
const PilotHome=lazy(()=>import("./pages/PilotHome"));
const AtlasResults=lazy(()=>import("./pages/AtlasResults"));
const WebResults=lazy(()=>import("./pages/WebResults"));
const MyPage=lazy(()=>import("./pages/MyPage"));
const AddOpportunity=lazy(()=>import("./pages/AddOpportunity"));
const Rooms=lazy(()=>import("./pages/Rooms"));
const Requests=lazy(()=>import("./pages/Requests"));
const MatchSearch=lazy(()=>import("./pages/MatchSearch"));
const Needs=lazy(()=>import("./pages/Needs"));
const PublicPassport=lazy(()=>import("./pages/PublicPassport"));
const Chat=lazy(()=>import("./pages/Chat"));
const Messages=lazy(()=>import("./pages/Messages"));
const ShareApp=lazy(()=>import("./pages/ShareApp"));
const CatalogAdmin=lazy(()=>import("./pages/CatalogAdmin"));
const TomatoPilot=lazy(()=>import("./pages/TomatoPilot"));
const Groups=lazy(()=>import("./pages/Groups"));
const GroupPage=lazy(()=>import("./pages/GroupPage"));

const supportedLanguages=new Set(["uk","en"]);
const normalizeLanguage=value=>{
  const code=String(value||"").toLowerCase().split("-")[0];
  return supportedLanguages.has(code)?code:"uk";
};

function RouteLoader(){
  return <main style={{minHeight:"55vh",display:"grid",placeItems:"center",color:"#0b7540",fontWeight:800}}>ATLAS</main>;
}

export default function App(){
  const [backgroundReady,setBackgroundReady]=useState(false);
  const [inboxUnread,setInboxUnread]=useState(0);
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
    if(!backgroundReady||catalogAdminRoute)return;
    let alive=true;
    let busy=false;
    const refresh=async()=>{
      if(busy||!alive||document.visibilityState==="hidden")return;
      busy=true;
      try{
        const flows=await loadSolutionFlows();
        if(alive)setInboxUnread((flows||[]).reduce((sum,item)=>sum+Number(item.unread_count||0),0));
      }catch{}finally{busy=false}
    };
    const onInbox=event=>{
      const value=Number(event?.detail?.unread);
      if(Number.isFinite(value))setInboxUnread(value);
      else refresh();
    };
    refresh();
    const timer=window.setInterval(refresh,15000);
    window.addEventListener("atlas:inbox-changed",onInbox);
    document.addEventListener("visibilitychange",refresh);
    return()=>{alive=false;window.clearInterval(timer);window.removeEventListener("atlas:inbox-changed",onInbox);document.removeEventListener("visibilitychange",refresh)};
  },[backgroundReady,catalogAdminRoute]);

  useEffect(()=>{
    const sync=lng=>setLangState(normalizeLanguage(lng));
    i18n.on("languageChanged",sync);
    return()=>i18n.off("languageChanged",sync);
  },[]);

  useEffect(()=>{
    try{localStorage.setItem("atlas-language",lang)}catch{}
    document.documentElement.lang=lang;
  },[lang]);

  return <>
    <Suspense fallback={<RouteLoader/>}>
      {catalogAdminRoute?<Routes><Route path="/admin/catalog" element={<CatalogAdmin/>}/><Route path="*" element={<Navigate to="/admin/catalog" replace/>}/></Routes>:<PilotGate lang={lang} bypass={location.pathname.startsWith("/share")}>
        <Header lang={lang} setLang={setLang} inboxUnread={inboxUnread}/>
        {backgroundReady&&<Suspense fallback={null}><MatchNotificationBridge lang={lang}/></Suspense>}
        {solutionRoute&&<SolutionNavigation lang={lang}/>}
        {chatRoute&&<Suspense fallback={null}><VoicePrivacyControl/></Suspense>}
        <Routes>
          <Route path="/" element={<PilotHome lang={lang}/>}/>
          <Route path="/results" element={<AtlasResults lang={lang}/>}/>
          <Route path="/web-results" element={<WebResults lang={lang}/>}/>
          <Route path="/me" element={<MyPage lang={lang}/>}/>
          <Route path="/opportunities/new" element={<AddOpportunity lang={lang}/>}/>
          <Route path="/profile" element={<Navigate to="/me" replace/>}/>
          <Route path="/messages" element={<Messages lang={lang}/>}/>
          <Route path="/rooms" element={<Rooms lang={lang}/>}/>
          <Route path="/requests" element={<Requests lang={lang}/>}/>
          <Route path="/matches" element={<MatchSearch lang={lang}/>}/>
          <Route path="/needs" element={<Needs lang={lang}/>}/>
          <Route path="/solution" element={<Solution t={t} lang={lang}/>}/>
          <Route path="/share" element={<ShareApp lang={lang}/>}/>
          <Route path="/chat" element={<Chat/>}/>
          <Route path="/tomatoes" element={<TomatoPilot lang={lang}/>}/>
          <Route path="/groups" element={<Groups lang={lang}/>}/>
          <Route path="/groups/:groupId" element={<GroupPage lang={lang}/>}/>
          <Route path="/p/:slug" element={<PublicPassport lang={lang}/>}/>
          <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
        <BottomNav lang={lang} inboxUnread={inboxUnread}/>
        <footer>Atlas · {lang==="uk"?"Тестова версія":"Test version"} · {t.principle}</footer>
      </PilotGate>}
    </Suspense>
    <Analytics/>
    <SpeedInsights/>
  </>;
}