import {useEffect,useState} from "react";
import {Globe2,HeartHandshake,IdCard,MessageCircleMore,Sparkles} from "lucide-react";
import {Link,NavLink,useLocation} from "react-router-dom";
import OnlinePresence from "./OnlinePresence";

const labels={
  uk:{profile:"Можливості",needs:"Потреби",requests:"Мої запити",chat:"Чат",market:"Куплю / Продам",tomatoes:"Помідори",solution:"Рішення",passport:"Паспорт",home:"Головна",matches:"Збіги",nav:"Головна навігація",goHome:"На головну",openPassport:"Відкрити Паспорт"},
  en:{profile:"Opportunities",needs:"Needs",requests:"My requests",chat:"Chat",market:"Buy / Sell",tomatoes:"Tomatoes",solution:"Solution",passport:"Passport",home:"Home",matches:"Matches",nav:"Main navigation",goHome:"Go home",openPassport:"Open Passport"},
  zh:{profile:"能力",needs:"需求",requests:"我的请求",chat:"聊天",market:"购买 / 出售",tomatoes:"番茄",solution:"解决方案",passport:"护照",home:"主页",matches:"匹配",nav:"主导航",goHome:"返回主页",openPassport:"打开护照"},
  hi:{profile:"क्षमताएँ",needs:"ज़रूरतें",requests:"मेरे अनुरोध",chat:"चैट",market:"खरीदें / बेचें",tomatoes:"टमाटर",solution:"समाधान",passport:"पासपोर्ट",home:"होम",matches:"मिलान",nav:"मुख्य नेविगेशन",goHome:"होम पर जाएं",openPassport:"पासपोर्ट खोलें"}
};

function copy(lang){return labels[lang]||labels.uk;}
function pageTitle(pathname,lang){
  const l=copy(lang);
  if(pathname.startsWith("/profile"))return l.profile;
  if(pathname.startsWith("/needs"))return l.needs;
  if(pathname.startsWith("/requests"))return l.requests;
  if(pathname.startsWith("/chat"))return l.chat;
  if(pathname.startsWith("/market"))return l.market;
  if(pathname.startsWith("/tomatoes"))return l.tomatoes;
  if(pathname.startsWith("/solution"))return l.solution;
  if(pathname.startsWith("/p/"))return l.passport;
  return l.home;
}

export default function Header({lang,setLang}){
  const location=useLocation();
  const [mobile,setMobile]=useState(()=>window.matchMedia?.("(max-width: 760px)")?.matches??false);
  useEffect(()=>{
    const media=window.matchMedia?.("(max-width: 760px)");
    if(!media)return;
    const sync=event=>setMobile(event.matches);
    setMobile(media.matches);
    media.addEventListener?.("change",sync);
    return()=>media.removeEventListener?.("change",sync);
  },[]);
  const l=copy(lang);
  const homeActive=location.pathname==="/";
  const items=[
    {to:"/needs",label:l.needs,icon:HeartHandshake},
    {to:"/matches",label:l.matches,icon:Sparkles},
    {to:"/profile",label:l.profile,icon:IdCard},
    {to:"/chat",label:l.chat,icon:MessageCircleMore}
  ];
  const chatRoute=location.pathname.startsWith("/chat");
  return <header className={`atlasHeader ${chatRoute?"chatRouteHeader":""}`}>
    <Link className={`brand ${homeActive?"active":""}`} to="/" aria-label={l.goHome}>
      <b>A</b><span className="brandText"><span>ATLAS</span><small>{l.home}</small></span>
    </Link>
    <span className="headerPageTitle">{pageTitle(location.pathname,lang)}</span>
    <nav className="mobileHeaderNav" aria-label={l.nav}>{items.map(item=>{
      const Icon=item.icon;
      return <NavLink key={item.to} to={item.to} className={({isActive})=>isActive?"active":""}><Icon size={19}/><span>{item.label}</span></NavLink>;
    })}</nav>
    <div className="actions">
      {!mobile&&<div className="desktopPresence"><OnlinePresence lang={lang} compact/></div>}
      <label className="lang" aria-label="Language"><Globe2 size={17}/><select value={lang} onChange={event=>setLang(event.target.value)} aria-label="Language">
        <option value="uk">UA</option><option value="en">EN</option><option value="zh">中文</option><option value="hi">हिंदी</option>
      </select></label>
      <Link className="profileAvatar" to="/profile" aria-label={l.openPassport}>Я</Link>
    </div>
  </header>;
}
