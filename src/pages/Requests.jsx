import {useMemo,useState} from "react";
import {HeartHandshake,MapPin,MessageCircle,Search,Sparkles} from "lucide-react";
import {Link,useNavigate} from "react-router-dom";
import SearchHistoryList from "../components/SearchHistoryList";
import {loadMyPassport} from "../services/passportStore";
import {findNeedsForOpportunities} from "../services/needMatchStore";
import {loadSolutionFlows,offerOpportunityToNeed} from "../services/solutionFlowStore";
import "../styles/matchSearch.css";

const itemNames={tomatoes:{uk:"томати",en:"tomatoes"},"veg-potato-table":{uk:"картоплі",en:"potatoes"},potatoes:{uk:"картоплі",en:"potatoes"}};
const activeStatuses=new Set(["pending","accepted","provided"]);

export default function Requests({lang="uk"}){
  const uk=lang!=="en";
  const navigate=useNavigate();
  const [loading,setLoading]=useState(false);
  const [searched,setSearched]=useState(false);
  const [error,setError]=useState("");
  const [actionError,setActionError]=useState("");
  const [groups,setGroups]=useState({});
  const [ownSlugs,setOwnSlugs]=useState([]);
  const [flows,setFlows]=useState([]);
  const [busyKey,setBusyKey]=useState("");

  async function searchNeeds(){
    if(loading)return;
    setLoading(true);setError("");setActionError("");
    try{
      const [data,flowList]=await Promise.all([loadMyPassport(),loadSolutionFlows()]);
      const active=(data.opportunities||[]).filter(item=>item?.id&&item?.is_active);
      if(!active.length){
        setGroups({});setFlows(flowList||[]);setOwnSlugs((data.passports||[]).map(item=>item.slug));setSearched(true);
        return;
      }
      const result=await findNeedsForOpportunities(active);
      setGroups(result||{});setFlows(flowList||[]);setOwnSlugs((data.passports||[]).map(item=>item.slug));setSearched(true);
    }catch(e){setError(String(e?.message||e||"search-failed"));setSearched(true)}finally{setLoading(false)}
  }

  const liveMatches=useMemo(()=>Object.values(groups).flatMap(group=>(group.matches||[]).filter(match=>!ownSlugs.includes(match.passport_slug)).map(match=>({...match,opportunity:group.opportunity}))),[groups,ownSlugs]);

  async function contactMatch(match){
    const key=`${match.opportunity.id}-${match.need_id}`;
    if(busyKey)return;
    setBusyKey(key);setActionError("");
    try{
      const result=await offerOpportunityToNeed({opportunityId:match.opportunity.id,needId:match.need_id});
      const updated=await loadSolutionFlows();
      setFlows(updated);
      const threadId=result?.request?.id||updated.find(flow=>flow.opportunity_id===match.opportunity.id&&flow.need_id===match.need_id&&activeStatuses.has(flow.status))?.id;
      if(threadId)navigate(`/messages?thread=${threadId}`);
      else setActionError(uk?"Пропозицію надіслано, але розмову не вдалося відкрити. Перевірте «Повідомлення».":"Offer sent, but the conversation could not be opened. Check Messages.");
    }catch(cause){setActionError(String(cause?.message||cause||"offer-failed"))}finally{setBusyKey("")}
  }

  return <main className="page appPage requestsPage"><section>
    <span className="kicker">ATLAS · {uk?"ПОШУК ПОТРЕБ":"NEED SEARCH"}</span>
    <h1>{uk?"Знайти потреби":"Find needs"}</h1>
    <p>{uk?"Atlas нічого не шукає автоматично. Натисніть кнопку, коли хочете перевірити, кому можуть бути корисні ваші активні можливості.":"Atlas does not search automatically. Start the search when you want to check who may need your active opportunities."}</p>

    <button type="button" className="matchAction actionButton" onClick={searchNeeds} disabled={loading}><Search size={18}/>{loading?(uk?"Шукаю потреби…":"Searching needs…"):(uk?"Знайти потреби":"Find needs")}</button>
    <div style={{marginTop:12}}><Link to="/matches?mode=opportunity" className="matchAction secondaryAction"><Sparkles size={17}/>{uk?"Вибрати конкретну можливість":"Choose a specific opportunity"}</Link></div>

    {error&&<div className="error">{uk?"Не вдалося виконати пошук потреб.":"Could not search needs."}</div>}
    {actionError&&<div className="error" role="alert">{actionError}</div>}

    {!loading&&searched&&liveMatches.length>0&&<div style={{display:"grid",gap:12,margin:"18px 0 28px"}}>
      {liveMatches.map(match=>{const item=itemNames[match.item_key]?.[uk?"uk":"en"]||match.item_key;const key=`${match.opportunity.id}-${match.need_id}`;const existing=flows.find(flow=>flow.opportunity_id===match.opportunity.id&&flow.need_id===match.need_id&&activeStatuses.has(flow.status));return <article key={key} style={{padding:17,border:"2px solid #bfe4cc",borderRadius:16,background:"#eff9f2"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,color:"#08753f",fontSize:12,fontWeight:900}}><Sparkles size={17}/>{uk?"МОЖЛИВА ПОТРЕБА":"POSSIBLE NEED"}</div>
        <strong style={{display:"block",fontSize:18,marginTop:8}}>{match.quantity} {match.unit} {item}</strong>
        <div style={{marginTop:5,color:"#526159"}}>{uk?"Ваша можливість:":"Your opportunity:"} <b>{match.opportunity.text}</b></div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginTop:9,color:"#65736b",fontSize:13}}><HeartHandshake size={15}/><span>{match.display_name}</span>{match.city&&<><span>·</span><MapPin size={14}/><span>{match.city}</span></>}</div>
        <div style={{marginTop:14}}>{existing?<Link className="matchAction secondaryAction" to={`/messages?thread=${existing.id}`}><MessageCircle size={17}/>{uk?"Відкрити розмову":"Open conversation"}</Link>:<button type="button" className="matchAction actionButton" disabled={Boolean(busyKey)} onClick={()=>contactMatch(match)}><MessageCircle size={17}/>{busyKey===key?(uk?"Відкриваю…":"Opening…"):(uk?"Запропонувати рішення":"Offer a solution")}</button>}</div>
      </article>})}
    </div>}

    {!loading&&searched&&liveMatches.length===0&&!error&&<div style={{padding:17,border:"1px solid #dfe8e2",borderRadius:14,background:"#f8faf9",margin:"18px 0 28px",color:"#65736b"}}>{uk?"За цим пошуком актуальних потреб не знайдено. Спробуйте пізніше або виберіть конкретну можливість.":"No active needs were found in this search. Try later or choose a specific opportunity."}</div>}

    {!searched&&<div style={{padding:17,border:"1px solid #dfe8e2",borderRadius:14,background:"#f8faf9",margin:"18px 0 28px",color:"#65736b"}}>{uk?"Пошук ще не запускався. Atlas чекатиме вашої команди.":"Search has not started. Atlas will wait for your command."}</div>}

    <details style={{marginTop:22}}><summary style={{cursor:"pointer",fontWeight:800,color:"#476052"}}>{uk?"Попередні пошуки":"Previous searches"}</summary><div style={{marginTop:14}}><SearchHistoryList lang={lang}/><small className="historyPrivacy">{uk?"Історія пошуку зберігається лише на цьому пристрої.":"Search history is stored only on this device."}</small></div></details>
  </section></main>;
}
