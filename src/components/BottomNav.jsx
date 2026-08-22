import {ClipboardList,IdCard,MessageCircleMore,Search} from "lucide-react";
import {NavLink,useLocation} from "react-router-dom";

export default function BottomNav({lang="uk"}){
  const {pathname}=useLocation();
  if(pathname.startsWith("/p/"))return null;
  const uk=lang!=="en";
  const items=[
    {to:"/",label:uk?"Пошук":"Search",icon:Search},
    {to:"/requests",label:uk?"Мої запити":"Requests",icon:ClipboardList},
    {to:"/profile",label:uk?"Можливості":"Opportunities",icon:IdCard},
    {to:"/chat",label:uk?"Чат":"Chat",icon:MessageCircleMore}
  ];
  return <nav className="bottomNav" aria-label="Головна навігація">{items.map(item=>{
    const Icon=item.icon;
    const taskActive=item.to==="/"&&(pathname==="/"||pathname==="/solution");
    return <NavLink key={item.to} to={item.to} className={({isActive})=>(isActive||taskActive)?"active":""} end={item.to==="/"}><Icon size={21}/><span>{item.label}</span></NavLink>;
  })}</nav>;
}
