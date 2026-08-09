import {useEffect,useMemo,useState} from "react";
import {ArrowLeft,CheckCircle2,Copy,MapPin,MessageCircle,PlusCircle,Send} from "lucide-react";
import {Link,useParams} from "react-router-dom";
import {createPassportRequest,ensureAtlasSession,loadMyRequestsForPassport,loadPublicPassport} from "../services/passportStore";

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
  const [requestError,setRequestError]=useState("");
  const [notice,setNotice]=useState("");
  const [passport,setPassport]=useState(null);
  const [opportunities,setOpportunities]=useState([]);
  const [requests,setRequests]=useState([]);
  const [selected,setSelected]=useState(null);
  const [requesterName,setRequesterName]=useState("");
  const [message,setMessage]=useState("");
  const [sending,setSending]=useState(false);
  const [isOwner,setIsOwner]=useState(false);

  useEffect(()=>{
    let alive=true;
    setLoading(true);
    loadPublicPassport(slug).then(async data=>{
      if(!alive)return;
      setPassport(data.passport);
      setOpportunities(data.opportunities||[]);
      if(data.passport?.id){
        try{
          const user=await ensureAtlasSession();
          if(alive)setIsOwner(user.id===data.passport.owner_id);
          const mine=await loadMyRequestsForPassport(data.passport.id);
          if(alive)setRequests(mine||[]);
        }catch(e){
          if(alive&&/atlas_requests|relation .* does not exist/i.test(String(e?.message||"")))setRequestError(uk?"Запити через Atlas ще не активовані в базі.":"Atlas requests are not active in the database yet.");
        }
      }
    }).catch(e=>{if(alive)setError(e?.message||String(e))}).finally(()=>{if(alive)setLoading(false)});
    return()=>{alive=false};
  },[slug,uk]);

  const latestByOpportunity=useMemo(()=>{
    const map=new Map();
    for(const request of requests){if(request.opportunity_id&&!map.has(request.opportunity_id))map.set(request.opportunity_id,request)}
    return map;
  },[requests]);

  function openRequest(item){
    setSelected(item);setNotice("");setRequestError("");
    setMessage(uk?`Мене цікавить ваша можливість: ${item.text}`:`I'm interested in your opportunity: ${item.text}`);
    setTimeout(()=>document.getElementById("atlas-request-form")?.scrollIntoView({behavior:"smooth",block:"center"}),50);
  }

  async function sendRequest(e){
    e.preventDefault();if(!selected||!message.trim()||sending)return;
    setSending(true);setRequestError("");setNotice("");
    try{
      const created=await createPassportRequest(passport,selected,{message,requesterName});
      setRequests(items=>[created,...items]);setSelected(null);setMessage("");
      setNotice(uk?"✓ Запит надіслано власнику Паспортa. Поверніться сюди, щоб побачити відповідь.":"✓ Request sent to the Passport owner. Return here to see the response.");
    }catch(e){
      const text=String(e?.message||e||"");
      if(/own-passport-request/i.test(text))setRequestError(uk?"Це ваш власний Паспорт. Додавайте нові можливості через кнопку вище.":"This is your own Passport. Add new opportunities using the button above.");
      else if(/atlas_requests|relation .* does not exist/i.test(text))setRequestError(uk?"Таблиця запитів ще не активована в Supabase.":"The requests table is not active in Supabase yet.");
      else setRequestError(text||(uk?"Не вдалося надіслати запит.":"Could not send request."));
    }finally{setSending(false)}
  }

  async function copyContact(value){await navigator.clipboard.writeText(value);setNotice(uk?"Контакт скопійовано.":"Contact copied.")}

  return <main className="page"><section className="profileShell" style={{maxWidth:760}}>
    <Link className="back" to="/"><ArrowLeft size={18}/>{uk?"До Atlas":"Back to Atlas"}</Link>
    <span className="kicker">ATLAS · {uk?"ПАСПОРТ МОЖЛИВОСТЕЙ":"OPPORTUNITY PASSPORT"}</span>

    {loading&&<p>{uk?"Відкриваю Паспорт…":"Opening Passport…"}</p>}
    {!loading&&!passport&&!error&&<div className="error">{uk?"Паспорт не знайдено.":"Passport not found."}</div>}
    {error&&<div className="error">{error}</div>}

    {passport&&<>
      <h1 style={{marginBottom:8}}>{passport.display_name}</h1>
      {passport.city&&<div style={{display:"flex",alignItems:"center",gap:7,color:"#66746c",marginBottom:16}}><MapPin size={17}/>{passport.city}</div>}

      {(passport.profession||passport.skills)&&<section style={{margin:"0 0 22px",padding:18,border:"1px solid #dfe8e2",borderRadius:15,background:"#f8fbf9"}}>
        {passport.profession&&<div style={{marginBottom:passport.skills?13:0}}><span style={{display:"block",fontSize:12,fontWeight:800,color:"#6a776f",textTransform:"uppercase",letterSpacing:".05em",marginBottom:4}}>{uk?"Професія / основна діяльність":"Profession / main occupation"}</span><strong style={{fontSize:20,lineHeight:1.4}}>{passport.profession}</strong></div>}
        {passport.skills&&<div><span style={{display:"block",fontSize:12,fontWeight:800,color:"#6a776f",textTransform:"uppercase",letterSpacing:".05em",marginBottom:5}}>{uk?"Навички та досвід":"Skills and experience"}</span><div style={{fontSize:16,lineHeight:1.55,whiteSpace:"pre-wrap"}}>{passport.skills}</div></div>}
      </section>}

      {isOwner?<div style={{margin:"0 0 24px",padding:16,border:"1px solid #cfe6d7",borderRadius:14,background:"#f2fbf5"}}>
        <strong style={{display:"block",marginBottom:9}}>{uk?"Це ваш Паспорт":"This is your Passport"}</strong>
        <Link className="primary" to="/profile#add-opportunity" style={{display:"inline-flex",textDecoration:"none"}}><PlusCircle size={18}/>{uk?"Додати ще можливість":"Add another opportunity"}</Link>
      </div>:<p style={{margin:"0 0 26px",color:"#66746c",fontSize:16,lineHeight:1.5}}>{uk?"Контактні дані не показуються публічно. Надішліть запит через Atlas — власник сам вирішить, чи відкрити контакт.":"Contact details are not public. Send a request through Atlas — the owner decides whether to reveal contact details."}</p>}

      {notice&&<div className="success" style={{marginBottom:16}}>{notice}</div>}
      {requestError&&<div className="error" style={{marginBottom:16}}>{requestError}</div>}

      <div style={{display:"grid",gap:12}}>
        {opportunities.map(item=>{
          const label=kindLabels[item.kind]||kindLabels.other;
          const request=latestByOpportunity.get(item.id);
          return <article key={item.id} style={{padding:18,border:"1px solid #e1e9e3",borderRadius:14,background:"white"}}>
            <strong style={{display:"block",fontSize:13,color:"#0b8d46",marginBottom:7}}>{uk?label.uk:label.en}</strong>
            <div style={{fontSize:18,lineHeight:1.5}}>{item.text}</div>
            {!isOwner&&<>
              {request?.status==="pending"&&<div style={{marginTop:14,padding:"11px 13px",borderRadius:11,background:"#f4f8f5",color:"#526159",fontWeight:700}}>{uk?"Запит надіслано · очікує відповіді":"Request sent · awaiting response"}</div>}
              {request?.status==="declined"&&<div style={{marginTop:14,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><span style={{color:"#7a5b55"}}>{uk?"Власник відхилив попередній запит.":"The owner declined the previous request."}</span><button className="secondary" type="button" onClick={()=>openRequest(item)}><MessageCircle size={17}/>{uk?"Надіслати новий":"Send another"}</button></div>}
              {request?.status==="accepted"&&request.owner_contact&&<div style={{marginTop:14,padding:14,borderRadius:12,background:"#edf9f1",border:"1px solid #c7ead3"}}><strong style={{display:"flex",alignItems:"center",gap:7,color:"#08783c",marginBottom:7}}><CheckCircle2 size={18}/>{uk?"Власник прийняв запит":"Owner accepted your request"}</strong><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><span style={{fontSize:18}}>{request.owner_contact}</span><button className="secondary" type="button" onClick={()=>copyContact(request.owner_contact)}><Copy size={16}/>{uk?"Копіювати":"Copy"}</button></div></div>}
              {!request&&<button className="primary" type="button" onClick={()=>openRequest(item)} style={{marginTop:14}}><MessageCircle size={17}/>{uk?"Запросити через Atlas":"Request via Atlas"}</button>}
            </>}
          </article>;
        })}
        {opportunities.length===0&&<div style={{padding:18,border:"1px dashed #cbd8ce",borderRadius:12,color:"#66746c"}}>{uk?"Додаткових можливостей поки немає. Професія та навички цієї людини вже можуть знаходитися через Atlas.":"No additional opportunities yet. This person's profession and skills can already be found through Atlas."}</div>}
      </div>

      {!isOwner&&selected&&<form id="atlas-request-form" onSubmit={sendRequest} style={{display:"grid",gap:12,marginTop:22,padding:18,border:"1px solid #dbe6de",borderRadius:16,background:"#fff"}}>
        <div><strong style={{fontSize:20}}>{uk?"Запит власнику Паспортa":"Request to Passport owner"}</strong><div style={{color:"#66746c",marginTop:4}}>{selected.text}</div></div>
        <label><span>{uk?"Ім’я або псевдонім (необов’язково)":"Name or nickname (optional)"}</span><input value={requesterName} onChange={e=>setRequesterName(e.target.value)}/></label>
        <label><span>{uk?"Коротко напишіть, що вам потрібно":"Briefly describe what you need"}</span><textarea required value={message} onChange={e=>setMessage(e.target.value)} style={{minHeight:100}}/></label>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button className="primary" disabled={sending||!message.trim()}><Send size={17}/>{sending?(uk?"Надсилаю…":"Sending…"):(uk?"Надіслати запит":"Send request")}</button><button className="secondary" type="button" onClick={()=>setSelected(null)}>{uk?"Скасувати":"Cancel"}</button></div>
      </form>}

      <p className="principle" style={{textAlign:"center"}}>{uk?"Твої можливості є частинкою чиєїсь задачі.":"Your capabilities are part of someone else's solution."}</p>
    </>}
  </section></main>;
}
