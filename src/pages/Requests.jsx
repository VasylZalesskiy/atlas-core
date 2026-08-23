import {useEffect,useMemo,useState} from "react";
import {HeartHandshake,MapPin,Sparkles} from "lucide-react";
import SearchHistoryList from "../components/SearchHistoryList";
import {loadMyPassport} from "../services/passportStore";
import {findNeedsForOpportunities} from "../services/needMatchStore";

const itemNames={tomatoes:{uk:"томати",en:"tomatoes"}};

export default function Requests({lang="uk"}){
  const uk=lang!=="en";
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [groups,setGroups]=useState({});

  useEffect(()=>{
    let alive=true;
    setLoading(true);setError("");
    loadMyPassport().then(data=>findNeedsForOpportunities(data.opportunities||[])).then(result=>{if(alive)setGroups(result||{})}).catch(e=>{if(alive)setError(String(e?.message||e||"match-failed"))}).finally(()=>{if(alive)setLoading(false)});
    return()=>{alive=false};
  },[]);

  const liveMatches=useMemo(()=>Object.values(groups).flatMap(group=>(group.matches||[]).map(match=>({...match,opportunity:group.opportunity}))),[groups]);

  return <main className="page appPage requestsPage"><section>
    <span className="kicker">ATLAS · {uk?"ЗБІГИ":"MATCHES"}</span>
    <h1>{uk?"Atlas знайшов потреби":"Atlas found needs"}</h1>
    <p>{uk?"Тут Atlas показує, кому зараз може бути корисна одна з ваших активних можливостей.":"Here Atlas shows who may currently benefit from one of your active opportunities."}</p>

    {loading&&<div style={{padding:16,border:"1px solid #dfe8e2",borderRadius:14,background:"#f8fbf9"}}>{uk?"Перевіряю активні потреби…":"Checking active needs…"}</div>}
    {error&&<div className="error">{uk?"Не вдалося перевірити збіги.":"Could not check matches."}</div>}

    {!loading&&!error&&liveMatches.length>0&&<div style={{display:"grid",gap:12,margin:"18px 0 28px"}}>
      {liveMatches.map(match=>{const item=itemNames[match.item_key]?.[uk?"uk":"en"]||match.item_key;return <article key={`${match.opportunity.id}-${match.need_id}`} style={{padding:17,border:"2px solid #bfe4cc",borderRadius:16,background:"#eff9f2"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,color:"#08753f",fontSize:12,fontWeight:900}}><Sparkles size={17}/>{uk?"ATLAS ЗНАЙШОВ ЗБІГ":"ATLAS FOUND A MATCH"}</div>
        <strong style={{display:"block",fontSize:18,marginTop:8}}>{match.quantity} {match.unit} {item}</strong>
        <div style={{marginTop:5,color:"#526159"}}>{uk?"Ваша можливість:":"Your opportunity:"} <b>{match.opportunity.text}</b></div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginTop:9,color:"#65736b",fontSize:13}}><HeartHandshake size={15}/><span>{match.display_name}</span>{match.city&&<><span>·</span><MapPin size={14}/><span>{match.city}</span></>}</div>
        <div style={{marginTop:10,padding:"10px 12px",borderRadius:11,background:"#fff",color:"#476052",fontSize:13}}>{uk?"Atlas також показує вашу можливість власнику цієї потреби. Якщо він натисне «Зв’язатися», запит з’явиться у вашому Паспорті можливостей.":"Atlas also shows your opportunity to this person. If they tap Contact, the request will appear in your Opportunity Passport."}</div>
      </article>})}
    </div>}

    {!loading&&!error&&liveMatches.length===0&&<div style={{padding:17,border:"1px solid #dfe8e2",borderRadius:14,background:"#f8faf9",margin:"18px 0 28px",color:"#65736b"}}>{uk?"Поки активних потреб під ваші можливості немає. Atlas перевірятиме їх при наступному відкритті розділу.":"There are no active needs matching your opportunities right now."}</div>}

    <details style={{marginTop:22}}><summary style={{cursor:"pointer",fontWeight:800,color:"#476052"}}>{uk?"Попередні пошуки":"Previous searches"}</summary><div style={{marginTop:14}}><SearchHistoryList lang={lang}/><small className="historyPrivacy">{uk?"Історія пошуку зберігається лише на цьому пристрої.":"Search history is stored only on this device."}</small></div></details>
  </section></main>;
}
