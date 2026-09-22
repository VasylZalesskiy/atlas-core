import {Globe2,HeartHandshake,IdCard,MessageCircleMore} from "lucide-react";
import {Link,NavLink,useLocation} from "react-router-dom";

const labels={
  uk:{profile:"Можливості",needs:"Потреби",chat:"Чат",home:"Головна",nav:"Головна навігація",goHome:"На головну",openPassport:"Моя сторінка в Atlas"},
  en:{profile:"Opportunities",needs:"Needs",chat:"Chat",home:"Home",nav:"Main navigation",goHome:"Go home",openPassport:"My Atlas page"}
};

function copy(lang){return labels[lang]||labels.uk;}

export default function Header({lang,setLang}){
  const location=useLocation();
  const l=copy(lang);
  const homeActive=location.pathname==="/";
  const items=[
    {to:"/needs",label:l.needs,icon:HeartHandshake},
    {to:"/profile",label:l.profile,icon:IdCard},
    {to:"/chat",label:l.chat,icon:MessageCircleMore}
  ];

  return <header className="atlasHeader">
    <Link className={"brand "+(homeActive?"active":"")} to="/" aria-label={l.goHome}>
      <b>A</b><span className="brandText"><span>ATLAS</span><small>{l.home}</small></span>
    </Link>

    <nav className="mainHeaderNav" aria-label={l.nav}>
      {items.map(item=>{
        const Icon=item.icon;
        return <NavLink key={item.to} to={item.to} className={({isActive})=>isActive?"active":""}>
          <Icon size={18}/><span>{item.label}</span>
        </NavLink>;
      })}
    </nav>

    <div className="actions">
      <label className="lang" aria-label="Language">
        <Globe2 size={17}/>
        <select value={lang} onChange={event=>setLang(event.target.value)} aria-label="Language">
          <option value="uk">UA</option>
          <option value="en">EN</option>
        </select>
      </label>
      <Link className="profileAvatar" to="/profile" aria-label={l.openPassport}>Я</Link>
    </div>
  </header>;
}
