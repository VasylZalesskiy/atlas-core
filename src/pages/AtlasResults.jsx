import {useEffect,useMemo,useState} from "react";
import {Globe2,MapPin,MessageCircle,Search,SlidersHorizontal} from "lucide-react";
import {useNavigate,useSearchParams} from "react-router-dom";
import {searchPassportProfiles} from "../services/passportSearch";
import {loadMyPassport} from "../services/passportStore";
import {startOpportunityRequest} from "../services/solutionFlowStore";
import "../styles/pilotRedesign.css";

function clean(value){return String(value||"").trim()}
function planFor(q){const words=clean(q).toLowerCase().split(/\s+/).filter(word=>word.length>2);return {goal:q,passport_search:{terms:words,capability_description:q}}}

export default function AtlasResults({lang="uk"}){
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
  const [ownSlugs,setOwnSlugs]=useState([]);
  const [busy,setBusy]=useState("");

  useEffect(()=>{
    let alive=true;
    setLoading(true);setError("");
    Promise.all([
      searchPassportProfiles(planFor(q),{limit:30}),
      loadMyPassport().catch(()=>({passport:null,passports:[]}))
    ]).then(([found,mine])=>{
      if(!alive)return;
      setPassportId(mine.passport?.id||null);
      const slugs=(mine.passports||[]).map(item=>item.slug);
      setOwnSlugs(slugs);
      setItems((found.matches||[]).filter(item=>!slugs.includes(item.slug)));
      if(found.error&&found.error!=="production-passports-not-initialized")setError(found.error);
    }).catch(cause=>alive&&setError(String(cause?.message||cause||"search-failed")))
      .finally(()=>alive&&setLoading(false));
    return()=>{alive=false};
  },[q]);

  const filtered=useMemo(()=>{
    const needle=city.trim().toLowerCase();
    const list=needle?items.filter(item=>String(item.city||"").toLowerCase().includes(needle)):items.slice();
    if(sort==="city")list.sort((a,b)=>String(a.city||"").localeCompare(String(b.city||""),"uk"));
    if(sort==="price")list.sort((a,b)=>(Number(a.price_value)||Infinity)-(Number(b.price_value)||Infinity));
    return list;
  },[items,city,sort]);

  async function writeTo(item){
    if(!item.opportunity_id||busy)return;
    setBusy(item.opportunity_id);setError("");
    try{
      const result=await startOpportunityRequest({
        opportunityId:item.opportunity_id,
        requesterPassportId:passportId,
        subject:item.headline||q,
        message:uk?`Мене цікавить ваша можливість: ${item.headline||q}`:`I'm interested in your capability: ${item.headline||q}`
      });
      if(result?.request?.id)navigate(`/messages?thread=${result.request.id}`);
      else navigate("/messages");
    }catch(cause){setError(String(cause?.message||cause||"message-failed"))}
    finally{setBusy("")}
  }

  const webParams=new URLSearchParams({q});
  if(where)webParams.set("where",where);

  return <main className="pilotPage pilotResults">
    <header className="pilotPageHead">
      <div><span>ATLAS</span><h1>{uk?"Результати":"Results"}</h1></div>
      <p>{uk?"Шукаємо спочатку серед можливостей людей в Atlas.":"We search people's capabilities in Atlas first."}</p>
    </header>

    <section className="pilotQueryBar"><Search size={18}/><strong>{q||"—"}</strong>{where&&<small><MapPin size={14}/>{where}</small>}</section>

    <section className="pilotFilterBar">
      <label><MapPin size={16}/><input value={city} onChange={e=>setCity(e.target.value)} placeholder={uk?"Фільтр за містом":"Filter by city"}/></label>
      <label><SlidersHorizontal size={16}/><select value={sort} onChange={e=>setSort(e.target.value)}><option value="relevance">{uk?"Релевантність":"Relevance"}</option><option value="city">{uk?"Місто":"City"}</option><option value="price">{uk?"Ціна":"Price"}</option></select></label>
    </section>

    {loading&&<div className="pilotState">{uk?"Шукаю у можливостях Atlas…":"Searching Atlas capabilities…"}</div>}
    {!loading&&!filtered.length&&<div className="pilotEmpty"><strong>{uk?"У можливостях Atlas поки нічого не знайдено":"Nothing found in Atlas capabilities yet"}</strong><span>{uk?"Можна продовжити пошук в інтернеті.":"You can continue searching the internet."}</span></div>}
    {error&&<div className="pilotError">{error}</div>}

    <div className="pilotResultList">
      {filtered.map(item=><article className="pilotResultCard" key={item.opportunity_id||item.slug}>
        <div className="pilotResultTop"><div><strong>{item.headline||item.name}</strong><span>{item.name}</span></div>{item.city&&<small><MapPin size={13}/>{item.city}</small>}</div>
        {item.can_help&&<p>{item.can_help}</p>}
        {(item.price_value||item.payment_type==="free")&&<div className="pilotResultMeta">{item.payment_type==="free"?(uk?"Безкоштовно":"Free"):`${item.price_value} ${item.currency||"UAH"} / ${item.price_unit||""}`}</div>}
        <button type="button" onClick={()=>writeTo(item)} disabled={!item.opportunity_id||busy===item.opportunity_id}><MessageCircle size={17}/>{busy===item.opportunity_id?(uk?"Відкриваю…":"Opening…"):(uk?"Написати":"Message")}</button>
      </article>)}
    </div>

    <button className="pilotWebButton" type="button" onClick={()=>navigate(`/web-results?${webParams.toString()}`)}><Globe2 size={19}/>{uk?"Пошукати в інтернеті":"Search the internet"}</button>
  </main>;
}