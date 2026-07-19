import {Route,Routes} from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import Home from "../pages/Home";
import Solution from "../pages/Solution";
import Passport from "../pages/Passport";
import {useLocale} from "../i18n";
import {useQueryDraft} from "./QueryDraftProvider";

function HomeRoute(){const {t,lang}=useLocale();const draft=useQueryDraft();return <Home t={t} lang={lang} {...draft}/>}
function SolutionRoute(){const {t,lang}=useLocale();const {setLastQuery,setLastLocation,clearRequest}=useQueryDraft();return <Solution t={t} lang={lang} setLastQuery={setLastQuery} setLastLocation={setLastLocation} clearRequest={clearRequest}/>}
function PassportRoute(){const {t}=useLocale();const {clearRequest}=useQueryDraft();return <Passport t={t} clearRequest={clearRequest}/>}

export default function AppRouter(){return <Routes><Route element={<AppShell/>}><Route path="/" element={<HomeRoute/>}/><Route path="/solution" element={<SolutionRoute/>}/><Route path="/passport" element={<PassportRoute/>}/><Route path="/profile" element={<PassportRoute/>}/></Route></Routes>}
