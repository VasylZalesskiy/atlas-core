import {Home,MessageCircleMore,MessagesSquare,Sparkles} from "lucide-react";
import {NavLink,useLocation} from "react-router-dom";

export default function BottomNav({lang="uk",inboxUnread=0}){
  const {pathname}=useLocation();
  if(pathname.startsWith("/p/")||pathname==="/chat"||pathname==="/solution")return null;
  const uk=lang!=="en";
  const items=[
    {to:"/",label:uk?"Головна":"Home",icon:Home,end:true},
    {to:"/me",label:uk?"Можливості":"Capabilities",icon:Sparkles},
    {to:"/messages",label:uk?"Повідомлення":"Messages",icon:MessagesSquare,badge:inboxUnread},
    {to:"/rooms",label:uk?"Кімнати":"Rooms",icon:MessageCircleMore}
  ];
  return <nav className="bottomNav pilotBottomNav" aria-label={uk?"Головна навігація":"Main navigation"}>{items.map(item=>{
    const Icon=item.icon;
    return <NavLink key={item.to} to={item.to} end={item.end} className={({isActive})=>isActive?"active":""}>
      <span className="bottomNavIcon"><Icon size={21}/>{item.badge>0&&<b className="bottomNavUnread">{item.badge>99?"99+":item.badge}</b>}</span><span className="bottomNavLabel">{item.label}</span>
    </NavLink>
  })}</nav>;
}