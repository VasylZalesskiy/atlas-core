import {ArrowLeft,ArrowRight,Home,Plus,UserRound} from "lucide-react";
import {useNavigate} from "react-router-dom";

export default function PageNavigation({title,t,showForward=false,showProfile=false,onNewRequest}){
  const navigate=useNavigate();
  return <nav className="pageNavigation" aria-label={t.pageNavigation}><strong>{title}</strong><div><button className="navBack" onClick={()=>navigate(-1)}><ArrowLeft/>{t.back}</button>{showForward&&<button className="navForward" onClick={()=>navigate(1)}><ArrowRight/>{t.forward}</button>}<button className="navHome" onClick={()=>navigate("/")}><Home/>{t.home}</button><button className="navNew" onClick={onNewRequest}><Plus/>{t.newRequest}</button>{showProfile&&<button className="navProfile" onClick={()=>navigate("/profile")}><UserRound/>{t.profile}</button>}</div></nav>;
}
