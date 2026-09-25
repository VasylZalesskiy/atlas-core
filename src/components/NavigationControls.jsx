import {useEffect,useState} from "react";
import {ArrowLeft,ArrowRight,MessageCircle} from "lucide-react";
import {Link,useLocation,useNavigate,useNavigationType} from "react-router-dom";
import "../styles/navigationControls.css";

export default function NavigationControls({lang="uk"}){
  const navigate=useNavigate();
  const location=useLocation();
  const navigationType=useNavigationType();
  const index=window.history.state?.idx??0;
  const [furthest,setFurthest]=useState(index);
  useEffect(()=>{
    if(navigationType==="PUSH")setFurthest(index);
    else setFurthest(value=>Math.max(value,index));
  },[location.key,index,navigationType]);
  const home=location.pathname==="/"&&!location.search&&!location.hash;
  const uk=lang!=="en";
  return <nav className="atlasHistoryNav" aria-label={uk?"Керування сторінками":"Page navigation"}>
    <div className="atlasHistoryGroup">
      <button type="button" onClick={()=>index>0?navigate(-1):navigate("/")} disabled={index<=0&&home} aria-label={uk?"Назад":"Back"} title={uk?"Назад":"Back"}><ArrowLeft size={19}/><span>{uk?"Назад":"Back"}</span></button>
      <button type="button" onClick={()=>navigate(1)} disabled={index>=furthest} aria-label={uk?"Вперед":"Forward"} title={uk?"Вперед":"Forward"}><ArrowRight size={19}/><span>{uk?"Вперед":"Forward"}</span></button>
    </div>
    <div className="atlasHistoryGroup atlasHistoryActions">
      <Link className="atlasChatRoomLink" to="/chat" aria-label={uk?"Чат кімната":"Chat room"} title={uk?"Чат кімната":"Chat room"}><MessageCircle size={19}/><span>{uk?"Чат кімната":"Chat room"}</span></Link>
    </div>
  </nav>;
}
