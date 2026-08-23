import {useEffect,useMemo,useState} from "react";
import {ArrowRight,HeartHandshake,IdCard,MapPin,PackageSearch,RefreshCw,Search,Sparkles} from "lucide-react";
import {Link} from "react-router-dom";
import {loadMyPassport} from "../services/passportStore";
import {searchPassportProfiles} from "../services/passportSearch";
import {findNeedsForOpportunity} from "../services/needMatchStore";
import "../styles/matchSearch.css";

const needNames={
  tomatoes:{uk:"Томати",en:"Tomatoes"}
};
const needAliases={
  tomatoes:["томати","томат","помідори","помідор","tomatoes","tomato"]
};

function normalize(value){return String(value||"").toLowerCase().trim()}
function needLabel(item,uk){
  const name=needNames[item?.item_key]?.[uk?"uk":"en"]||item?.item_key||"Потреба";
  return `${name}${item?.quantity?` · ${Number(item.quantity).toLocaleString(uk?"uk-UA":"en-GB")} ${item.unit||""}`:""}`;
}
function needQuery(item,uk){
  const name=needNames[item?.item_key]?.[uk?"uk":"en"]||item?.item_key||"";
  return `${name} ${item?.quantity||""} ${item?.unit||""}`.trim();
}
function formatDate(value,uk){
  if(!value)return "";
  return new Intl.DateTimeFormat(uk?"uk-UA":"en-GB",{day:"numeric",month:"short"}).format(new Date(`${value}T12:00:00`));
}

export default function MatchSearch({lang="uk"}){
  const uk=lang!=="en";
  const [loading,setLoading]=useState(true);
  const [searching,setSearching]=useState(false);
  const [mode,setMode]=useState("need");
  const [passport,setPassport]=useState(null);
  const [needs,setNeeds]=useState([]);
  const [opportunities,setOpportunities]=useState([]);
  const [query,setQuery]=useState("");
  const [selectedNeedId,setSelectedNeedId]=useState("");
  const [selectedOpportunityId,setSelectedOpportunityId]=useState("");
  const [results,setResults]=useState([]);
  const [error,setError]=useState("");
  const [searched,setSearched]=useState(false);

  const activeNeeds=useMemo(()=>{
    const today=new Date().toISOString().slice(0,10);
    return needs.filter(item=>item.status==="not_received"&&(!item.needed_until||item.needed_until>=today));
  },[needs]);
  const activeOpportunities=useMemo(()=>opportunities.filter(item=>item.is_active),[opportunities]);
  const selectedOpportunity=activeOpportunities.find(item=>item.id===selectedOpportunityId)||null;

  useEffect(()=>{
    let alive=true;
    loadMyPassport().then(data=>{
      if(!alive)return;
      setPassport(data.passport||null);
      setNeeds(data.needs||[]);
      setOpportunities(data.opportunities||[]);
      const firstNeed=(data.needs||[]).find(item=>item.status==="not_received");
      const firstOpportunity=(data.opportunities||[]).find(item=>item.is_active);
      if(firstNeed){setSelectedNeedId(firstNeed.id);setQuery(needQuery(firstNeed,uk))}
      if(firstOpportunity)setSelectedOpportunityId(firstOpportunity.id);
    }).catch(cause=>{if(alive)setError(String(cause?.message||cause||"Помилка"))}).finally(()=>{if(alive)setLoading(false)});
    return()=>{alive=false};
  },[uk]);

  function chooseMode(next){
    setMode(next);setResults([]);setSearched(false);setError("");
  }

  function chooseNeed(id){
    setSelectedNeedId(id);
    const item=activeNeeds.find(value=>value.id===id);
    if(item)setQuery(needQuery(item,uk));
  }

  async function searchOpportunities(event){
    event?.preventDefault();
    const clean=query.trim();
    if(!clean||searching)return;
    setSearching(true);setError("");setSearched(true);
    try{
      const selectedNeed=activeNeeds.find(item=>item.id===selectedNeedId);
      const aliases=selectedNeed?needAliases[selectedNeed.item_key]||[]:[];
      const terms=[clean,...clean.split(/\s+/),...aliases].map(normalize).filter(value=>value.length>2);
      const plan={goal:clean,passport_search:{terms:[...new Set(terms)],capability_description:uk?`має або може надати ${clean}`:`has or can provide ${clean}`}};
      const {matches,error:searchError}=await searchPassportProfiles(plan,{limit:20});
      if(searchError&&searchError!=="production-passports-not-initialized")setError(searchError);
      setResults((matches||[]).filter(item=>item.slug&&item.slug!==passport?.slug));
    }catch(cause){setError(String(cause?.message||cause||"match-search-failed"));setResults([])}finally{setSearching(false)}
  }

  async function searchNeeds(){
    if(!selectedOpportunityId||searching)return;
    setSearching(true);setError("");setSearched(true);
    try{
      const result=await findNeedsForOpportunity(selectedOpportunityId);
      if(result.error)setError(result.error);
      setResults(result.matches||[]);
    }catch(cause){setError(String(cause?.message||cause||"match-search-failed"));setResults([])}finally{setSearching(false)}
  }

  if(loading)return <main className="page appPage matchPage"><section className="matchShell"><div className="matchLoading"><RefreshCw size={22}/>{uk?"Готую пошук збігів…":"Preparing match search…"}</div></section></main>;

  return <main className="page appPage matchPage"><section className="matchShell">
    <div className="matchHero">
      <span className="kicker">ATLAS MATCH</span>
      <h1>{uk?"Знайти збіги самому":"Find matches yourself"}</h1>
      <p>{uk?"Перевіряйте базу Atlas у будь-який момент: що є під вашу потребу або кому потрібна ваша можливість.":"Check Atlas at any time: what matches your need or who needs your opportunity."}</p>
    </div>

    <div className="matchMode" role="tablist">
      <button type="button" className={mode==="need"?"active":""} onClick={()=>chooseMode("need")}><HeartHandshake size={20}/><span><strong>{uk?"У мене є потреба":"I have a need"}</strong><small>{uk?"Знайти можливості":"Find opportunities"}</small></span></button>
      <button type="button" className={mode==="opportunity"?"active":""} onClick={()=>chooseMode("opportunity")}><IdCard size={20}/><span><strong>{uk?"У мене є можливість":"I have an opportunity"}</strong><small>{uk?"Знайти потреби":"Find needs"}</small></span></button>
    </div>

    {mode==="need"?<form className="manualMatchBox" onSubmit={searchOpportunities}>
      <div className="manualMatchTitle"><Search size={20}/><div><strong>{uk?"Що шукаємо?":"What are we looking for?"}</strong><small>{uk?"Можна вибрати свою потребу або написати будь-який запит вручну.":"Choose one of your needs or type any request manually."}</small></div></div>
      {activeNeeds.length>0&&<label><span>{uk?"Моя активна потреба":"My active need"}</span><select value={selectedNeedId} onChange={event=>chooseNeed(event.target.value)}><option value="">{uk?"Написати вручну":"Type manually"}</option>{activeNeeds.map(item=><option value={item.id} key={item.id}>{needLabel(item,uk)}</option>)}</select></label>}
      <label><span>{uk?"Пошук":"Search"}</span><input value={query} onChange={event=>{setQuery(event.target.value);setSelectedNeedId("")}} placeholder={uk?"Наприклад: потрібно 5 кг томатів":"For example: need 5 kg of tomatoes"}/></label>
      <button className="matchSearchButton" disabled={searching||!query.trim()}><Search size={19}/>{searching?(uk?"Шукаю…":"Searching…"):(uk?"Знайти можливості":"Find opportunities")}</button>
    </form>:<div className="manualMatchBox">
      <div className="manualMatchTitle"><PackageSearch size={20}/><div><strong>{uk?"Кому це потрібно?":"Who needs this?"}</strong><small>{uk?"Оберіть одну зі своїх активних можливостей і запустіть перевірку вручну.":"Choose one of your active opportunities and run the check manually."}</small></div></div>
      {activeOpportunities.length?<><label><span>{uk?"Моя можливість":"My opportunity"}</span><select value={selectedOpportunityId} onChange={event=>setSelectedOpportunityId(event.target.value)}>{activeOpportunities.map(item=><option value={item.id} key={item.id}>{item.text}</option>)}</select></label><button className="matchSearchButton" type="button" disabled={searching||!selectedOpportunityId} onClick={searchNeeds}><Search size={19}/>{searching?(uk?"Шукаю…":"Searching…"):(uk?"Знайти потреби":"Find needs")}</button></>:<div className="matchEmptyInline">{uk?"Спочатку додайте хоча б одну активну можливість у Паспорт.":"First add at least one active opportunity to your Passport."}<Link to="/profile">{uk?"Додати можливість":"Add opportunity"}<ArrowRight size={15}/></Link></div>}
    </div>}

    {error&&<div className="matchError">{error}</div>}

    <section className="matchResults">
      <div className="matchResultsTitle"><div><Sparkles size={20}/><strong>{uk?"Результати":"Results"}</strong></div>{searched&&!searching&&<span>{results.length}</span>}</div>
      {!searched&&!searching&&<div className="matchBlank">{uk?"Запустіть пошук — Atlas покаже актуальні збіги.":"Run a search and Atlas will show current matches."}</div>}
      {searched&&!searching&&results.length===0&&<div className="matchBlank">{uk?"Зараз збігів не знайдено. Можна змінити запит і перевірити ще раз.":"No matches found right now. Change the query and try again."}</div>}
      {mode==="need"&&results.map(item=><article className="matchResultCard" key={`${item.slug}-${item.opportunity_id||item.headline}`}>
        <div className="matchResultCopy"><span className="matchFoundBadge">{uk?"МОЖЛИВІСТЬ":"OPPORTUNITY"}</span><strong>{item.headline||item.name}</strong><small>{item.city&&<><MapPin size={13}/>{item.city}</>} {item.name&&` · ${item.name}`}</small></div>
        <Link className="matchAction" to={`/p/${item.slug}${item.opportunity_id?`?opportunity=${encodeURIComponent(item.opportunity_id)}&need=${encodeURIComponent(query.trim())}`:""}`}>{uk?"Зв’язатися":"Contact"}<ArrowRight size={16}/></Link>
      </article>)}
      {mode==="opportunity"&&results.map(item=><article className="matchResultCard" key={item.need_id}>
        <div className="matchResultCopy"><span className="matchFoundBadge needBadge">{uk?"ПОТРЕБА":"NEED"}</span><strong>{needLabel(item,uk)}</strong><small>{item.city&&<><MapPin size={13}/>{item.city}</>} {item.display_name&&` · ${item.display_name}`} {item.needed_until&&` · ${uk?"до":"until"} ${formatDate(item.needed_until,uk)}`}</small>{item.coverage==="full"&&<em>{uk?"Вашої кількості достатньо для цієї потреби":"Your available quantity can fully cover this need"}</em>}{item.coverage==="partial"&&<em>{uk?"Можливе часткове покриття потреби":"This opportunity may partially cover the need"}</em>}</div>
        <Link className="matchAction secondaryAction" to={`/p/${item.passport_slug}`}>{uk?"Паспорт":"Passport"}<ArrowRight size={16}/></Link>
      </article>)}
    </section>

    <div className="matchPrivacy">{uk?"Приватні контакти не беруть участі в пошуку і не показуються без згоди власника.":"Private contacts are not used in search and are never shown without the owner's consent."}</div>
  </section></main>;
}
