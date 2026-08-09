import {useEffect,useState} from "react";
import {ArrowLeft,MapPin} from "lucide-react";
import {Link,useParams} from "react-router-dom";
import {loadPublicPassport} from "../services/passportStore";

const kindLabels={
  help:{uk:"Може допомогти",en:"Can help"},
  share:{uk:"Може поділитися",en:"Can share"},
  sell:{uk:"Продає",en:"Selling"},
  give:{uk:"Подарує",en:"Giving away"},
  lend:{uk:"Позичить",en:"Can lend"},
  rent:{uk:"Здає в оренду",en:"Renting out"},
  other:{uk:"Можливість",en:"Opportunity"}
};

export default function PublicPassport({lang="uk"}){
  const {slug}=useParams();
  const uk=lang!=="en";
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [passport,setPassport]=useState(null);
  const [opportunities,setOpportunities]=useState([]);

  useEffect(()=>{
    let alive=true;
    loadPublicPassport(slug)
      .then(data=>{if(alive){setPassport(data.passport);setOpportunities(data.opportunities||[])}})
      .catch(e=>{if(alive)setError(e?.message||String(e))})
      .finally(()=>{if(alive)setLoading(false)});
    return()=>{alive=false};
  },[slug]);

  return <main className="page">
    <section className="profileShell" style={{maxWidth:760}}>
      <Link className="back" to="/"><ArrowLeft size={18}/>{uk?"До Atlas":"Back to Atlas"}</Link>
      <span className="kicker">ATLAS · {uk?"ПАСПОРТ МОЖЛИВОСТЕЙ":"OPPORTUNITY PASSPORT"}</span>

      {loading&&<p>{uk?"Відкриваю Паспорт…":"Opening Passport…"}</p>}
      {!loading&&!passport&&!error&&<div className="error">{uk?"Паспорт не знайдено.":"Passport not found."}</div>}
      {error&&<div className="error">{error}</div>}

      {passport&&<>
        <h1 style={{marginBottom:8}}>{passport.display_name}</h1>
        {passport.city&&<div style={{display:"flex",alignItems:"center",gap:7,color:"#66746c",marginBottom:24}}><MapPin size={17}/>{passport.city}</div>}
        <p style={{margin:"0 0 26px",color:"#66746c",fontSize:16,lineHeight:1.5}}>{uk?"Контактні дані не показуються публічно. Коли Atlas підбере цю можливість під чиюсь задачу, зв’язок буде відбуватися через Atlas.":"Contact details are not public. When Atlas matches an opportunity to someone's task, contact will happen through Atlas."}</p>

        <div style={{display:"grid",gap:12}}>
          {opportunities.map(item=>{
            const label=kindLabels[item.kind]||kindLabels.other;
            return <article key={item.id} style={{padding:18,border:"1px solid #e1e9e3",borderRadius:14,background:"white"}}>
              <strong style={{display:"block",fontSize:13,color:"#0b8d46",marginBottom:7}}>{uk?label.uk:label.en}</strong>
              <div style={{fontSize:18,lineHeight:1.5}}>{item.text}</div>
            </article>;
          })}
          {opportunities.length===0&&<div style={{padding:18,border:"1px dashed #cbd8ce",borderRadius:12,color:"#66746c"}}>{uk?"У цьому Паспорті поки немає активних можливостей.":"This Passport has no active opportunities yet."}</div>}
        </div>
        <p className="principle" style={{textAlign:"center"}}>{uk?"Твої можливості є частинкою чиєїсь задачі.":"Your capabilities are part of someone else's solution."}</p>
      </>}
    </section>
  </main>;
}
