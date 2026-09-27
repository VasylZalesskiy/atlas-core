import {useEffect,useMemo,useState} from "react";
import {Bell,Globe2,Home as HomeIcon,MapPin,MessageCircle,MessageCircleMore,MessagesSquare,Search,SlidersHorizontal,Sparkles} from "lucide-react";
import {Link,useNavigate,useSearchParams} from "react-router-dom";
import OnlinePresence from "../components/OnlinePresence";
import CleanHistoryNav from "../components/CleanHistoryNav";
import {searchPassportProfiles} from "../services/passportSearch";
import {loadMyPassport} from "../services/passportStore";
import {startOpportunityRequest} from "../services/solutionFlowStore";
import "../styles/cleanHome.css";
import "../styles/cleanResults.css";

function clean(value){return String(value||"").trim()}
function planFor(q){
  const words=clean(q).toLowerCase().split(/\s+/).filter(word=>word.length>2);
  return {goal:q,passport_search:{terms:words,capability_description:q}};
}

export default function CleanResults({lang="uk",setLang,inboxUnread=0}){
  const uk=lang!=="en";
  const [params]=useSearchParams();
  const navigate=useNavigate();
  const q=clean(params.get("q"));
  const where=clean(params.get("where"));
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [city,setCity]=useState(where);
  const [sort,setSort]=useState("relevance");
  const [passportId,setPassportId]=useState(null);
  const [busy,setBusy]=useState("");
  const [noticeUnread,setNoticeUnread]=useState(0);

  useEffect(()=>{
    document.body.classList.add("clean-home-route");
    const onNotifications=event=>setNoticeUnread(Number(event?.detail?.unread)||0);
    window.addEventListener("atlas:notifications",onNotifications);
    return()=>{
      window.removeEventListener("atlas:notifications",onNotifications);
      document.body.classList.remove("clean-home-route");
    };
  },[]);

  useEffect(()=>{
    let alive=true;
    setLoading(true);
    setError("");
    Promise.all([
      searchPassportProfiles(planFor(q),{limit:30}),
      loadMyPassport().catch(()=>({passport:null,passports:[]}))
    ]).then(([found,mine])=>{
      if(!alive)return;
      setPassportId(mine.passport?.id||null);
      const ownSlugs=(mine.passports||[]).map(item=>item.slug);
      setItems((found.matches||[]).filter(item=>!ownSlugs.includes(item.slug)));
      if(found.error&&found.error!=="production-passports-not-initialized")setError(found.error);
    }).catch(cause=>{
      if(alive)setError(String(cause?.message||cause||"search-failed"));
    }).finally(()=>{
      if(alive)setLoading(false);
    });
    return()=>{alive=false};
  },[q]);

  const filtered=useMemo(()=>{
    const needle=city.trim().toLowerCase();
    const list=needle
      ?items.filter(item=>String(item.city||"").toLowerCase().includes(needle))
      :items.slice();
    if(sort==="city")list.sort((a,b)=>String(a.city||"").localeCompare(String(b.city||""),"uk"));
    if(sort==="price")list.sort((a,b)=>(Number(a.price_value)||Infinity)-(Number(b.price_value)||Infinity));
    return list;
  },[items,city,sort]);

  async function writeTo(item){
    if(!item.opportunity_id||busy)return;
    setBusy(item.opportunity_id);
    setError("");
    try{
      const result=await startOpportunityRequest({
        opportunityId:item.opportunity_id,
        requesterPassportId:passportId,
        subject:item.headline||q,
        message:uk?`Мене цікавить ваша можливість: ${item.headline||q}`:`I'm interested in your capability: ${item.headline||q}`
      });
      if(result?.request?.id)navigate(`/messages?thread=${result.request.id}`);
      else navigate("/messages");
    }catch(cause){
      setError(String(cause?.message||cause||"message-failed"));
    }finally{
      setBusy("");
    }
  }

  const unread=Math.max(inboxUnread,noticeUnread);
  const solutionParams=new URLSearchParams({q});
  if(where)solutionParams.set("where",where);

  return <main className="cleanHomeShell cleanResultsShell">
    <header className="cleanHomeTopbar">
      <Link className="cleanHomeBrand" to="/" aria-label={uk?"Головна":"Home"}>
        <span className="cleanHomeLogo">A</span>
        <span>ATLAS</span>
      </Link>
      <div className="cleanHomeTopActions">
        <div className="cleanHomeLanguage" aria-label={uk?"Мова":"Language"}>
          <button type="button" className={lang==="uk"?"active":""} onClick={()=>setLang("uk")}>UA</button>
          <span>/</span>
          <button type="button" className={lang==="en"?"active":""} onClick={()=>setLang("en")}>EN</button>
        </div>
        <OnlinePresence lang={lang} compact/>
        <button className="cleanHomeBell" type="button" onClick={()=>window.dispatchEvent(new CustomEvent("atlas:open-notifications"))} aria-label={uk?"Сповіщення Atlas":"Atlas notifications"}>
          <Bell size={17}/>
          {unread>0&&<b>{unread>9?"9+":unread}</b>}
        </button>
      </div>
    </header>
    <CleanHistoryNav lang={lang}/>

    <section className="cleanResultsBody">
      <div className="cleanResultsHeading">
        <span>ATLAS</span>
        <h1>{uk?"Результати":"Results"}</h1>
        <p>{uk?"Спочатку шукаємо серед можливостей людей в Atlas.":"We search people's capabilities in Atlas first."}</p>
      </div>

      <section className="cleanResultsQuery">
        <Search size={17}/>
        <div>
          <strong>{q||"—"}</strong>
          {where&&<small><MapPin size={12}/>{where}</small>}
        </div>
        <button type="button" onClick={()=>navigate("/")}>{uk?"Змінити":"Edit"}</button>
      </section>

      <section className="cleanResultsFilters">
        <label>
          <MapPin size={15}/>
          <input value={city} onChange={e=>setCity(e.target.value)} placeholder={uk?"Місто":"City"}/>
        </label>
        <label>
          <SlidersHorizontal size={15}/>
          <select value={sort} onChange={e=>setSort(e.target.value)}>
            <option value="relevance">{uk?"За збігом":"Relevance"}</option>
            <option value="city">{uk?"За містом":"City"}</option>
            <option value="price">{uk?"За ціною":"Price"}</option>
          </select>
        </label>
      </section>

      {loading&&<div className="cleanResultsState">{uk?"Шукаю у можливостях Atlas…":"Searching Atlas capabilities…"}</div>}

      {!loading&&!filtered.length&&<div className="cleanResultsEmpty">
        <span className="cleanResultsEmptyIcon"><Search size={22}/></span>
        <strong>{uk?"В Atlas поки нічого не знайдено":"Nothing found in Atlas yet"}</strong>
        <small>{uk?"Можемо продовжити пошук поза Atlas.":"We can continue searching outside Atlas."}</small>
        <button type="button" onClick={()=>navigate(`/solution?${solutionParams.toString()}`)}>
          <Globe2 size={17}/>{uk?"Пошукати в інтернеті":"Search the internet"}
        </button>
      </div>}

      {error&&<div className="cleanResultsError">{error}</div>}

      <div className="cleanResultsList">
        {filtered.map(item=><article className="cleanResultCard" key={item.opportunity_id||item.slug}>
          <div className="cleanResultTop">
            <div>
              <strong>{item.headline||item.name}</strong>
              <span>{item.name}</span>
            </div>
            {item.city&&<small><MapPin size={12}/>{item.city}</small>}
          </div>
          {item.can_help&&<p>{item.can_help}</p>}
          {(item.price_value||item.payment_type==="free")&&<div className="cleanResultMeta">
            {item.payment_type==="free"?(uk?"Безкоштовно":"Free"):`${item.price_value} ${item.currency||"UAH"}${item.price_unit?` / ${item.price_unit}`:""}`}
          </div>}
          <button type="button" onClick={()=>writeTo(item)} disabled={!item.opportunity_id||busy===item.opportunity_id}>
            <MessageCircle size={16}/>
            {busy===item.opportunity_id?(uk?"Відкриваю…":"Opening…"):(uk?"Написати":"Message")}
          </button>
        </article>)}
      </div>

      {!loading&&filtered.length>0&&<button className="cleanResultsWeb" type="button" onClick={()=>navigate(`/solution?${solutionParams.toString()}`)}>
        <Globe2 size={17}/>{uk?"Пошукати ще в інтернеті":"Search the internet too"}
      </button>}
    </section>

    <nav className="cleanHomeBottom" aria-label={uk?"Головна навігація":"Main navigation"}>
      <Link to="/"><HomeIcon size={19}/><span>{uk?"Головна":"Home"}</span></Link>
      <Link to="/profile"><Sparkles size={19}/><span>{uk?"Можливості":"Capabilities"}</span></Link>
      <Link to="/messages"><MessagesSquare size={19}/><span>{uk?"Повідомлення":"Messages"}</span>{inboxUnread>0&&<b>{inboxUnread>9?"9+":inboxUnread}</b>}</Link>
      <Link to="/chat"><MessageCircleMore size={19}/><span>{uk?"Кімнати":"Rooms"}</span></Link>
    </nav>
  </main>;
}
