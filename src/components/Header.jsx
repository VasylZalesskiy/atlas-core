import {Globe2,HeartHandshake,IdCard,MessagesSquare,UserRound} from "lucide-react";
import {Link,NavLink,useLocation} from "react-router-dom";
import OnlinePresence from "./OnlinePresence";

const labels={
  uk:{profile:"Можливості",needs:"Потреби",messages:"Повідомлення",home:"Головна",nav:"Головна навігація",goHome:"На головну",myPage:"Моя сторінка"},
  en:{profile:"Opportunities",needs:"Needs",messages:"Messages",home:"Home",nav:"Main navigation",goHome:"Go home",myPage:"My page"}
};

function copy(lang){return labels[lang]||labels.uk;}

export default function Header({lang,setLang,inboxUnread=0}){
  const location=useLocation();
  const l=copy(lang);
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
      <div className="atlasTopbarV3Presence"><OnlinePresence lang={lang} compact/></div>
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
    </div>
  </header>;
}
