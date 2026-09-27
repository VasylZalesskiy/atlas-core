import {useEffect,useState} from "react";
import {Globe2,Home,LogOut,MessageCircleMore,MessagesSquare,Share2,Sparkles} from "lucide-react";
import {Link,NavLink} from "react-router-dom";
import {loadAtlasAccounts,logoutAtlasAccount} from "../services/passportStore";

export default function Header({lang="uk",setLang,inboxUnread=0}){
  const uk=lang!=="en";
  const [hasAccount,setHasAccount]=useState(null);
  const [leaving,setLeaving]=useState(false);
  const [notice,setNotice]=useState("");

  useEffect(()=>{
    let active=true;
    const refresh=()=>loadAtlasAccounts().then(items=>{if(active)setHasAccount(items.length>0)}).catch(()=>{if(active)setHasAccount(false)});
    refresh();
    window.addEventListener("atlas:account-changed",refresh);
    return()=>{active=false;window.removeEventListener("atlas:account-changed",refresh)};
  },[]);

  async function share(){
    try{
      if(navigator.share)await navigator.share({title:"Atlas",url:window.location.href});
      else{await navigator.clipboard.writeText(window.location.href);setNotice(uk?"Посилання скопійовано":"Link copied")}
    }catch(error){if(error?.name!=="AbortError")setNotice(uk?"Не вдалося поділитися":"Could not share")}
  }

  async function logout(){
    if(leaving||hasAccount===null)return;
    if(!hasAccount){window.location.assign("/");return}
    setLeaving(true);
    try{await logoutAtlasAccount();window.location.replace("/")}
    catch{setNotice(uk?"Не вдалося вийти":"Could not sign out");setLeaving(false)}
  }

  const items=[
    {to:"/",label:uk?"Головна":"Home",icon:Home,end:true},
    {to:"/me",label:uk?"Твої можливості":"Capabilities",icon:Sparkles},
    {to:"/messages",label:uk?"Повідомлення":"Messages",icon:MessagesSquare,badge:inboxUnread},
    {to:"/rooms",label:uk?"Кімнати":"Rooms",icon:MessageCircleMore}
  ];

  return <header className="atlasTopbarV3">
    <Link className="atlasTopbarV3Brand" to="/" aria-label={uk?"На головну":"Home"}>
      <b>A</b><span><strong>ATLAS</strong><small>{uk?"можливості поруч":"capabilities nearby"}</small></span>
    </Link>

    <nav className="atlasTopbarV3Nav" aria-label={uk?"Головна навігація":"Main navigation"}>
      {items.map(item=>{const Icon=item.icon;return <NavLink key={item.to} to={item.to} end={item.end} className={({isActive})=>isActive?"active":""}>
        <Icon size={18}/><span>{item.label}</span>{item.badge>0&&<b className="navUnreadBadge">{item.badge>99?"99+":item.badge}</b>}
      </NavLink>})}
    </nav>

    <div className="atlasTopbarV3Right">
      <button type="button" className="atlasTopbarV3Action" onClick={share} title={uk?"Поділитися":"Share"}><Share2 size={18}/></button>
      <button type="button" className="atlasTopbarV3Action" onClick={logout} disabled={leaving||hasAccount===null} title={uk?"Вийти":"Exit"}><LogOut size={18}/></button>
      <label className="atlasTopbarV3Lang" aria-label="Language"><Globe2 size={17}/><select value={lang} onChange={e=>setLang(e.target.value)}><option value="uk">UA</option><option value="en">EN</option></select></label>
      {notice&&<span className="atlasTopbarV3Notice" role="status">{notice}</span>}
    </div>
  </header>;
}