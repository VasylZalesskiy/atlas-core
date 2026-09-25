import {useEffect,useState} from "react";
import {ArrowLeft,ArrowRight,House} from "lucide-react";
import {useLocation,useNavigate,useNavigationType} from "react-router-dom";
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
    <button type="button" onClick={()=>index>0?navigate(-1):navigate("/")} disabled={index<=0&&home} aria-label={uk?"Назад":"Back"} title={uk?"Назад":"Back"}><ArrowLeft size={18}/><span>{uk?"Назад":"Back"}</span></button>
    <button type="button" onClick={()=>navigate(1)} disabled={index>=furthest} aria-label={uk?"Вперед":"Forward"} title={uk?"Вперед":"Forward"}><ArrowRight size={18}/><span>{uk?"Вперед":"Forward"}</span></button>
    <button type="button" onClick={()=>navigate("/")} disabled={home} aria-label={uk?"На головну":"Home"} title={uk?"На головну":"Home"}><House size={18}/><span>{uk?"Головна":"Home"}</span></button>
  </nav>;
}
