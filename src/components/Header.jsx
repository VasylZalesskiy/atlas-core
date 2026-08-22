import {Globe2} from "lucide-react";
import {Link,useLocation} from "react-router-dom";

function pageTitle(pathname,lang){
  const uk=lang!=="en";
  if(pathname.startsWith("/profile"))return uk?"Паспорт можливостей":"Opportunities";
  if(pathname.startsWith("/requests"))return uk?"Мої запити":"My requests";
  if(pathname.startsWith("/chat"))return uk?"Чат":"Chat";
  if(pathname.startsWith("/market"))return uk?"Куплю / Продам":"Buy / Sell";
  if(pathname.startsWith("/solution"))return uk?"Рішення":"Solution";
  if(pathname.startsWith("/p/"))return uk?"Паспорт":"Passport";
  return uk?"Пошук":"Search";
}

export default function Header({lang,setLang}){
  const location=useLocation();
  return <header className="atlasHeader">
    <Link className="brand" to="/"><b>A</b><span>ATLAS</span></Link>
    <span className="headerPageTitle">{pageTitle(location.pathname,lang)}</span>
    <div className="actions">
      <button className="lang" onClick={()=>setLang(lang==="uk"?"en":"uk")}><Globe2 size={17}/><span>{lang==="uk"?"UA":"EN"}</span></button>
      <Link className="profileAvatar" to="/profile" aria-label={lang==="uk"?"Відкрити Паспорт":"Open Passport"}>Я</Link>
    </div>
  </header>;
}
