import {useEffect,useState} from "react";
import {Globe2,HeartHandshake,IdCard,LogOut,MessagesSquare,Share2,UserRound} from "lucide-react";
import {Link,NavLink,useLocation} from "react-router-dom";
import {loadAtlasAccounts,logoutAtlasAccount} from "../services/passportStore";

const labels={
  uk:{profile:"Можливості",needs:"Потреби",messages:"Повідомлення",home:"Головна",nav:"Головна навігація",goHome:"На головну",myPage:"Моя сторінка"},
  en:{profile:"Opportunities",needs:"Needs",messages:"Messages",home:"Home",nav:"Main navigation",goHome:"Go home",myPage:"My page"}
};

function copy(lang){return labels[lang]||labels.uk;}

export default function Header({lang,setLang,inboxUnread=0}){
  const location=useLocation();
  const l=copy(lang);
  const [hasAccount,setHasAccount]=useState(null);
  const [leaving,setLeaving]=useState(false);
  const [actionNotice,setActionNotice]=useState("");
  useEffect(()=>{
    let active=true;
    const refresh=()=>loadAtlasAccounts().then(accounts=>{if(active)setHasAccount(accounts.length>0)}).catch(()=>{if(active)setHasAccount(false)});
    refresh();window.addEventListener("atlas:account-changed",refresh);
    return()=>{active=false;window.removeEventListener("atlas:account-changed",refresh)};
  },[]);
  async function share(){
    try{
      if(navigator.share)await navigator.share({title:"Atlas",url:window.location.href});
      else{await navigator.clipboard.writeText(window.location.href);setActionNotice(lang==="en"?"Link copied":"Посилання скопійовано")}
    }catch(error){if(error?.name!=="AbortError")setActionNotice(lang==="en"?"Could not share":"Не вдалося поділитися")}
  }
  async function logout(){
    if(leaving||hasAccount===null)return;
    if(!hasAccount){
      window.close();
      window.setTimeout(()=>{if(!document.hidden)window.location.replace("about:blank")},100);
      return;
    }
    setLeaving(true);
    try{await logoutAtlasAccount();window.location.replace("/")}
    catch{setActionNotice(lang==="en"?"Could not sign out":"Не вдалося вийти");setLeaving(false)}
  }
  const items=[
    {to:"/needs",label:l.needs,icon:HeartHandshake},
    {to:"/profile",label:l.profile,icon:IdCard},
    {to:"/messages",label:l.messages,icon:MessagesSquare,badge:inboxUnread}
  ];

  return <header className="atlasTopbarV3">
    <Link className="atlasTopbarV3Brand" to="/" aria-label={l.goHome}>
      <b>A</b>
      <span><strong>ATLAS</strong><small>{l.home}</small></span>
    </Link>

    <nav className="atlasTopbarV3Nav" aria-label={l.nav}>
      {items.map(item=>{
        const Icon=item.icon;
        return <NavLink key={item.to} to={item.to} className={({isActive})=>isActive?"active":""}>
          <Icon size={18}/><span>{item.label}</span>{item.badge>0&&<b className="navUnreadBadge">{item.badge>99?"99+":item.badge}</b>}
        </NavLink>;
      })}
    </nav>

    <div className="atlasTopbarV3Right">
      <button type="button" className="atlasTopbarV3Action" onClick={share} title={lang==="en"?"Share":"Поділитися"} aria-label={lang==="en"?"Share":"Поділитися"}><Share2 size={18}/></button>
      <button type="button" className="atlasTopbarV3Action" onClick={logout} disabled={leaving||hasAccount===null} title={lang==="en"?"Exit Atlas":"Вийти з Atlas"} aria-label={lang==="en"?"Exit Atlas":"Вийти з Atlas"}><LogOut size={18}/></button>
      <label className="atlasTopbarV3Lang" aria-label="Language">
        <Globe2 size={17}/>
        <select value={lang} onChange={event=>setLang(event.target.value)} aria-label="Language">
          <option value="uk">UA</option>
          <option value="en">EN</option>
        </select>
      </label>
      <Link className="atlasTopbarV3Me" to="/profile" aria-label={l.myPage}>
        <UserRound size={17}/><span>{l.myPage}</span>
      </Link>
      {actionNotice&&<span className="atlasTopbarV3Notice" role="status">{actionNotice}</span>}
    </div>
  </header>;
}
