import {HeartHandshake,IdCard,MessagesSquare,Search} from "lucide-react";
import {NavLink,useLocation} from "react-router-dom";

export default function BottomNav({lang="uk",inboxUnread=0}){
  const {pathname}=useLocation();
  if(pathname.startsWith("/p/")||pathname==="/solution")return null;
  const uk=lang!=="en";
  const items=[
    {to:"/",label:uk?"Пошук":"Search",icon:Search},
    {to:"/needs",label:uk?"Потреби":"Needs",icon:HeartHandshake,featured:true},
    {to:"/profile",label:uk?"Можливості":"Opportunities",icon:IdCard,featured:true},
    {to:"/messages",label:uk?"Повідомлення":"Messages",icon:MessagesSquare,badge:inboxUnread}
  ];
  return <nav className="bottomNav" aria-label={uk?"Головна навігація":"Main navigation"}>{items.map(item=>{
    const Icon=item.icon;
    const taskActive=item.to==="/"&&(pathname==="/"||pathname==="/solution");
    return <NavLink key={item.to} to={item.to} className={({isActive})=>[isActive||taskActive?"active":"",item.featured?"featured":""].filter(Boolean).join(" ")} end={item.to==="/"}>
      <span className="bottomNavIcon"><Icon size={21}/>{item.badge>0&&<b className="bottomNavUnread">{item.badge>99?"99+":item.badge}</b>}</span><span className="bottomNavLabel">{item.label}</span>
    </NavLink>;
  })}</nav>;
}
