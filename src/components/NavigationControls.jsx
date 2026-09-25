import {useEffect,useState} from "react";
import {ArrowLeft,ArrowRight,LogOut,Share2,Smartphone} from "lucide-react";
import {Link,useLocation,useNavigate,useNavigationType} from "react-router-dom";
import {loadAtlasAccounts,logoutAtlasAccount} from "../services/passportStore";
import "../styles/navigationControls.css";

export default function NavigationControls({lang="uk"}){
  const navigate=useNavigate();
  const location=useLocation();
  const navigationType=useNavigationType();
  const index=window.history.state?.idx??0;
  const [furthest,setFurthest]=useState(index);
  const [hasAccount,setHasAccount]=useState(false);
  const [leaving,setLeaving]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{
    if(navigationType==="PUSH")setFurthest(index);
    else setFurthest(value=>Math.max(value,index));
  },[location.key,index,navigationType]);
  useEffect(()=>{
    let active=true;
    const refresh=()=>loadAtlasAccounts().then(accounts=>{if(active)setHasAccount(accounts.length>0)}).catch(()=>{if(active)setHasAccount(false)});
    refresh();
    window.addEventListener("atlas:account-changed",refresh);
    return()=>{active=false;window.removeEventListener("atlas:account-changed",refresh)};
  },[]);
  async function share(){
    const url=window.location.href;
    try{if(navigator.share)await navigator.share({title:"Atlas",url});else{await navigator.clipboard.writeText(url);setError(uk?"Посилання скопійовано":"Link copied")}}
    catch(cause){if(cause?.name!=="AbortError")setError(uk?"Не вдалося поділитися":"Could not share")}
  }
  async function logout(){
    if(leaving)return;
    setLeaving(true);setError("");
    try{await logoutAtlasAccount();window.location.replace("/")}
    catch{setError(uk?"Не вдалося вийти":"Could not sign out");setLeaving(false)}
  }
  const home=location.pathname==="/"&&!location.search&&!location.hash;
  const uk=lang!=="en";
  return <nav className="atlasHistoryNav" aria-label={uk?"Керування сторінками":"Page navigation"}>
    <div className="atlasHistoryGroup">
      <button type="button" onClick={()=>index>0?navigate(-1):navigate("/")} disabled={index<=0&&home} aria-label={uk?"Назад":"Back"} title={uk?"Назад":"Back"}><ArrowLeft size={19}/><span>{uk?"Назад":"Back"}</span></button>
      <button type="button" onClick={()=>navigate(1)} disabled={index>=furthest} aria-label={uk?"Вперед":"Forward"} title={uk?"Вперед":"Forward"}><ArrowRight size={19}/><span>{uk?"Вперед":"Forward"}</span></button>
    </div>
    <div className="atlasHistoryGroup atlasHistoryActions">
      <button type="button" onClick={share} aria-label={uk?"Поділитися":"Share"} title={uk?"Поділитися":"Share"}><Share2 size={19}/><span>{uk?"Поділитися":"Share"}</span></button>
      <Link to="/share" aria-label={uk?"Atlas на телефон":"Atlas on phone"} title={uk?"Atlas на телефон":"Atlas on phone"}><Smartphone size={19}/><span>{uk?"На телефон":"On phone"}</span></Link>
      {hasAccount&&<button type="button" onClick={logout} disabled={leaving} aria-label={uk?"Вийти":"Sign out"} title={uk?"Вийти":"Sign out"}><LogOut size={19}/><span>{uk?"Вийти":"Sign out"}</span></button>}
    </div>
    {error&&<span className="atlasHistoryNotice" role="status">{error}</span>}
  </nav>;
}
