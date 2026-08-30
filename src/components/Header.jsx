import {Globe2,HeartHandshake,IdCard,MessageCircleMore,Sparkles} from "lucide-react";
import {Link,NavLink,useLocation} from "react-router-dom";

function pageTitle(pathname,lang){
  const uk=lang!=="en";
  if(pathname.startsWith("/profile"))return uk?"Можливості":"Opportunities";
  if(pathname.startsWith("/needs"))return uk?"Потреби":"Needs";
  if(pathname.startsWith("/requests"))return uk?"Мої запити":"My requests";
  if(pathname.startsWith("/chat"))return uk?"Чат":"Chat";
  if(pathname.startsWith("/market"))return uk?"Куплю / Продам":"Buy / Sell";
  if(pathname.startsWith("/tomatoes"))return uk?"Помідори":"Tomatoes";
  if(pathname.startsWith("/solution"))return uk?"Рішення":"Solution";
  if(pathname.startsWith("/p/"))return uk?"Паспорт":"Passport";
  return "";
}

export default function Header({lang,setLang}){
  const location=useLocation();
  const uk=lang!=="en";
  const items=[
    {to:"/needs",label:uk?"Потреби":"Needs",icon:HeartHandshake},
    {to:"/matches",label:uk?"Збіги":"Matches",icon:Sparkles},
    {to:"/profile",label:uk?"Можливості":"Opportunities",icon:IdCard},
    {to:"/chat",label:uk?"Чат":"Chat",icon:MessageCircleMore}
  ];
  const chatRoute=location.pathname.startsWith("/chat");
  return <header className={`atlasHeader ${chatRoute?"chatRouteHeader":""}`}>
    <Link className="brand" to="/"><b>A</b><span>ATLAS</span></Link>
    <span className="headerPageTitle">{pageTitle(location.pathname,lang)}</span>
    <nav className="mobileHeaderNav" aria-label={uk?"Головна навігація":"Main navigation"}>{items.map(item=>{
      const Icon=item.icon;
      return <NavLink key={item.to} to={item.to} className={({isActive})=>isActive?"active":""}><Icon size={19}/><span>{item.label}</span></NavLink>;
    })}</nav>
    <div className="actions">
      <button className="lang" onClick={()=>setLang(lang==="uk"?"en":"uk")}><Globe2 size={17}/><span>{lang==="uk"?"UA":"EN"}</span></button>
      <Link className="profileAvatar" to="/profile" aria-label={uk?"Відкрити Паспорт":"Open Passport"}>Я</Link>
    </div>
  </header>;
}
