import {useEffect,useMemo,useState} from "react";
import {ArrowLeft,CheckCircle2,Copy,Inbox,PlusCircle,Share2,Trash2,XCircle} from "lucide-react";
import {Link} from "react-router-dom";
import {addMyOpportunity,deleteMyOpportunity,loadIncomingRequests,loadMyPassport,respondToPassportRequest,saveMyPassport} from "../services/passportStore";

const kinds=[
  {value:"help",uk:"Можу допомогти",en:"I can help"},
  {value:"share",uk:"Можу поділитися",en:"I can share"},
  {value:"sell",uk:"Продам",en:"I can sell"},
  {value:"give",uk:"Подарую",en:"I can give away"},
  {value:"lend",uk:"Позичу",en:"I can lend"},
  {value:"rent",uk:"Здам в оренду",en:"I can rent out"},
  {value:"other",uk:"Інше",en:"Other"}
];

function friendlyError(error,uk){
  const text=String(error?.message||error||"");
  if(/anonymous|signups|disabled/i.test(text))return uk
    ?"У Supabase потрібно один раз увімкнути Anonymous Sign-Ins для пілотної версії Atlas."
    :"Anonymous Sign-Ins must be enabled once in Supabase for the Atlas pilot.";
  if(/atlas_requests|relation .*atlas_requests.*does not exist/i.test(text))return uk
    ?"Запити між користувачами ще не активовані в Supabase. Виконайте файл supabase-requests-v1.sql."
    :"User requests are not active in Supabase yet. Run supabase-requests-v1.sql.";
  if(/atlas_passports|atlas_opportunities|atlas_private_contacts|relation .* does not exist/i.test(text))return uk
    ?"Нова база Паспортів ще не активована в Supabase. Виконайте файл supabase-passports-v1.sql."
    :"The new Passport database is not active in Supabase yet. Run supabase-passports-v1.sql.";
  return text|| (uk?"Не вдалося виконати дію.":"The action could not be completed.");
}

export default function Profile({t,lang="uk"}){
  const uk=lang!=="en";
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [adding,setAdding]=useState(false);
  const [requestBusy,setRequestBusy]=useState("");
  const [error,setError]=useState("");
  const [requestError,setRequestError]=useState("");
  const [notice,setNotice]=useState("");
  const [passport,setPassport]=useState(null);
  const [opportunities,setOpportunities]=useState([]);
  const [incomingRequests,setIncomingRequests]=useState([]);
  const [form,setForm]=useState({displayName:"",city:"",contact:""});
  const [entry,setEntry]=useState({kind:"help",text:""});

  const shareUrl=useMemo(()=>passport?.slug?`${window.location.origin}/p/${passport.slug}`:"",[passport?.slug]);
  const pendingCount=incomingRequests.filter(item=>item.status==="pending").length;

  useEffect(()=>{
    let alive=true;
    setLoading(true);
    loadMyPassport()
      .then(async data=>{
        if(!alive)return;
        setPassport(data.passport);
        setOpportunities(data.opportunities||[]);
        setForm({
          displayName:data.passport?.display_name||"",
          city:data.passport?.city||"",
          contact:data.contact||""
        });
        if(data.passport?.id){
          try{
            const requests=await loadIncomingRequests();
            if(alive)setIncomingRequests(requests||[]);
          }catch(e){
            if(alive)setRequestError(friendlyError(e,uk));
          }
        }
      })
      .catch(e=>{if(alive)setError(friendlyError(e,uk))})
      .finally(()=>{if(alive)setLoading(false)});
    return()=>{alive=false};
  },[uk]);

  async function savePassport(e){
    e.preventDefault();
    if(saving)return;
    setError("");setNotice("");setSaving(true);
    try{
      const saved=await saveMyPassport(form);
      setPassport(saved);
      setNotice(uk?"✓ Паспорт збережено. Тепер додавайте свої можливості.":"✓ Passport saved. Now add your opportunities.");
    }catch(e){setError(friendlyError(e,uk))}
    finally{setSaving(false)}
  }

  async function addOpportunity(e){
    e.preventDefault();
    if(adding||!passport?.id||!entry.text.trim())return;
    setError("");setNotice("");setAdding(true);
    try{
      const added=await addMyOpportunity(passport.id,entry);
      setOpportunities(items=>[added,...items]);
      setEntry(value=>({...value,text:""}));
      setNotice(uk?"✓ Можливість уже доступна для пошуку Atlas.":"✓ This opportunity is now searchable by Atlas.");
    }catch(e){setError(friendlyError(e,uk))}
    finally{setAdding(false)}
  }

  async function removeOpportunity(id){
    setError("");setNotice("");
    try{
      await deleteMyOpportunity(id);
      setOpportunities(items=>items.filter(item=>item.id!==id));
      setNotice(uk?"Можливість видалено.":"Opportunity removed.");
    }catch(e){setError(friendlyError(e,uk))}
  }

  async function answerRequest(id,status){
    if(requestBusy)return;
    setRequestBusy(id);setRequestError("");setNotice("");
    try{
      const updated=await respondToPassportRequest(id,status);
      setIncomingRequests(items=>items.map(item=>item.id===id?{...item,...updated}:item));
      setNotice(status==="accepted"
        ?(uk?"✓ Запит прийнято. Ваш контакт відкрито тільки цьому користувачу.":"✓ Request accepted. Your contact is visible only to this requester.")
        :(uk?"Запит відхилено.":"Request declined."));
    }catch(e){setRequestError(friendlyError(e,uk))}
    finally{setRequestBusy("")}
  }

  async function copyLink(){
    if(!shareUrl)return;
    await navigator.clipboard.writeText(shareUrl);
    setNotice(uk?"Посилання на Паспорт скопійовано.":"Passport link copied.");
  }

  async function sharePassport(){
    if(!shareUrl)return;
    if(navigator.share){
      await navigator.share({title:"Atlas · Паспорт можливостей",url:shareUrl}).catch(()=>{});
      return;
    }
    await copyLink();
  }

  if(loading)return <main className="page"><section className="profileShell" style={{maxWidth:760}}><p>{uk?"Відкриваю ваш Паспорт…":"Opening your Passport…"}</p></section></main>;

  return <main className="page">
    <section className="profileShell" style={{maxWidth:760}}>
      <Link className="back" to="/"><ArrowLeft size={18}/>{uk?"Назад до Atlas":"Back to Atlas"}</Link>
      <span className="kicker">ATLAS · {uk?"ПАСПОРТ МОЖЛИВОСТЕЙ":"OPPORTUNITY PASSPORT"}</span>
      <h1 style={{marginBottom:8}}>{passport?(uk?"Ваш Паспорт можливостей":"Your Opportunity Passport"):(uk?"Створіть Паспорт можливостей":"Create an Opportunity Passport")}</h1>
      <p style={{margin:"0 0 24px",color:"#66746c",fontSize:17,lineHeight:1.55}}>
        {uk
          ?"Напишіть, що у вас є і чим ви можете бути корисні. Додавайте можливості будь-коли — кожна одразу стає доступною Atlas для пошуку."
          :"Write what you have and how you can help. Add opportunities at any time — each becomes searchable by Atlas immediately."}
      </p>

      <form className="profileForm" onSubmit={savePassport} style={{gridTemplateColumns:"1fr",marginBottom:passport?28:0}}>
        <label><span>{uk?"Ім’я або псевдонім":"Name or nickname"}</span><input required disabled={saving} value={form.displayName} onChange={e=>setForm({...form,displayName:e.target.value})} placeholder={uk?"Наприклад: Василь":"For example: Vasyl"}/></label>
        <label><span>{uk?"Контакт — публічно не показується":"Contact — never shown publicly"}</span><input required disabled={saving} value={form.contact} onChange={e=>setForm({...form,contact:e.target.value})} placeholder={uk?"Телефон або email":"Phone or email"}/></label>
        <label><span>{uk?"Місто / район":"City / area"}</span><input disabled={saving} value={form.city} onChange={e=>setForm({...form,city:e.target.value})} placeholder={uk?"Наприклад: Тернопіль":"For example: Ternopil"}/></label>
        <button className="primary" disabled={saving}>{saving?(t?.saving||"Зберігаю…"):(passport?(uk?"Зберегти Паспорт":"Save Passport"):(uk?"Створити Паспорт":"Create Passport"))}</button>
      </form>

      {passport&&<>
        <div style={{borderTop:"1px solid #e4ebe6",paddingTop:26}}>
          <h2 style={{margin:"0 0 6px",fontSize:25}}>{uk?"Додати можливість":"Add an opportunity"}</h2>
          <p style={{margin:"0 0 16px",color:"#66746c"}}>{uk?"Одне поле — одна конкретна можливість. Додати або видалити можна за кілька секунд.":"One field — one concrete opportunity. Add or remove it in seconds."}</p>
          <form onSubmit={addOpportunity} style={{display:"grid",gap:12}}>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {kinds.map(item=><button key={item.value} type="button" onClick={()=>setEntry({...entry,kind:item.value})} style={{border:entry.kind===item.value?"2px solid #11934b":"1px solid #d8e1da",background:entry.kind===item.value?"#eef9f2":"white",borderRadius:999,padding:"9px 13px",fontWeight:700,cursor:"pointer"}}>{uk?item.uk:item.en}</button>)}
            </div>
            <textarea autoFocus value={entry.text} onChange={e=>setEntry({...entry,text:e.target.value})} placeholder={uk?"Наприклад: маю генератор 5 кВт, можу безкоштовно позичити сусідам":"For example: I have a 5 kW generator and can lend it to neighbours for free"} style={{minHeight:110,fontSize:17,padding:14,border:"1px solid #d8e1da",borderRadius:12}}/>
            <button className="primary" disabled={adding||!entry.text.trim()}><PlusCircle size={20}/>{adding?(uk?"Додаю…":"Adding…"):(uk?"Додати можливість":"Add opportunity")}</button>
          </form>
        </div>

        <div style={{marginTop:30}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"center",flexWrap:"wrap"}}>
            <div><h2 style={{margin:"0 0 4px",fontSize:25}}>{uk?"Мої можливості":"My opportunities"} · {opportunities.length}</h2><span style={{color:"#66746c"}}>{uk?"Atlas шукає серед цих записів, коли комусь потрібна ваша можливість.":"Atlas searches these entries when someone needs your capability."}</span></div>
            {shareUrl&&<div style={{display:"flex",gap:8}}><button type="button" onClick={copyLink} className="secondary"><Copy size={17}/>{uk?"Копіювати":"Copy"}</button><button type="button" onClick={sharePassport} className="secondary"><Share2 size={17}/>{uk?"Поділитися":"Share"}</button></div>}
          </div>

          <div style={{display:"grid",gap:10,marginTop:16}}>
            {opportunities.length===0&&<div style={{padding:18,border:"1px dashed #cbd8ce",borderRadius:12,color:"#66746c"}}>{uk?"Поки немає можливостей. Додайте першу вище.":"No opportunities yet. Add the first one above."}</div>}
            {opportunities.map(item=>{
              const kind=kinds.find(k=>k.value===item.kind);
              return <div key={item.id} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:14,padding:16,border:"1px solid #e1e9e3",borderRadius:14,background:"#fff"}}>
                <div><strong style={{display:"block",fontSize:13,color:"#0b8d46",marginBottom:5}}>{kind?(uk?kind.uk:kind.en):(uk?"Можливість":"Opportunity")}</strong><span style={{fontSize:17,lineHeight:1.45}}>{item.text}</span></div>
                <button type="button" onClick={()=>removeOpportunity(item.id)} title={uk?"Видалити":"Delete"} style={{border:"1px solid #e1e9e3",background:"white",borderRadius:10,padding:9,cursor:"pointer",flex:"0 0 auto"}}><Trash2 size={18}/></button>
              </div>;
            })}
          </div>
        </div>

        <div style={{marginTop:34,paddingTop:28,borderTop:"1px solid #e4ebe6"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:5}}><Inbox size={24}/><h2 style={{margin:0,fontSize:25}}>{uk?"Вхідні запити":"Incoming requests"}{pendingCount?` · ${pendingCount}`:""}</h2></div>
          <p style={{margin:"0 0 16px",color:"#66746c"}}>{uk?"Люди, яким Atlas показав ваші можливості, можуть написати сюди. Контакт відкривається тільки після вашої згоди.":"People matched to your opportunities can write here. Your contact is revealed only after you accept."}</p>
          {requestError&&<div className="error" style={{marginBottom:14}}>{requestError}</div>}
          <div style={{display:"grid",gap:10}}>
            {!requestError&&incomingRequests.length===0&&<div style={{padding:18,border:"1px dashed #cbd8ce",borderRadius:12,color:"#66746c"}}>{uk?"Поки немає запитів.":"No requests yet."}</div>}
            {incomingRequests.map(item=><article key={item.id} style={{padding:16,border:"1px solid #e1e9e3",borderRadius:14,background:"#fff"}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",flexWrap:"wrap"}}>
                <div style={{flex:"1 1 360px"}}>
                  <strong style={{display:"block",color:"#0b8d46",marginBottom:5}}>{item.requester_name||(uk?"Користувач Atlas":"Atlas user")}</strong>
                  {item.opportunity?.text&&<div style={{fontWeight:700,marginBottom:7}}>{item.opportunity.text}</div>}
                  <div style={{lineHeight:1.5}}>{item.message}</div>
                  <small style={{display:"block",marginTop:8,color:"#7a867f"}}>{new Date(item.created_at).toLocaleString(uk?"uk-UA":"en-US")}</small>
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {item.status==="pending"&&<><button className="primary" type="button" disabled={requestBusy===item.id} onClick={()=>answerRequest(item.id,"accepted")}><CheckCircle2 size={17}/>{uk?"Прийняти":"Accept"}</button><button className="secondary" type="button" disabled={requestBusy===item.id} onClick={()=>answerRequest(item.id,"declined")}><XCircle size={17}/>{uk?"Відхилити":"Decline"}</button></>}
                  {item.status==="accepted"&&<span style={{padding:"9px 12px",borderRadius:10,background:"#edf9f1",color:"#08783c",fontWeight:700}}>{uk?"Прийнято":"Accepted"}</span>}
                  {item.status==="declined"&&<span style={{padding:"9px 12px",borderRadius:10,background:"#f7f3f2",color:"#765d57",fontWeight:700}}>{uk?"Відхилено":"Declined"}</span>}
                </div>
              </div>
            </article>)}
          </div>
        </div>

        <div style={{marginTop:28,padding:16,borderRadius:14,background:"#f4f8f5",color:"#526159",fontSize:14,lineHeight:1.5}}>
          {uk?"Пілотна версія: право редагування прив’язане до цього браузера через захищений анонімний акаунт Supabase. Не очищайте дані браузера. Далі підключимо відновлення через телефон/email.":"Pilot version: editing rights are tied to this browser through a protected anonymous Supabase account. Do not clear browser data. Phone/email recovery will be added next."}
        </div>
      </>}

      {error&&<div className="error" style={{marginTop:16}}>{error}</div>}
      {notice&&<div className="success" style={{marginTop:16}}>{notice}</div>}
      <p className="principle" style={{textAlign:"center"}}>{uk?"Твої можливості є частинкою чиєїсь задачі.":"Your capabilities are part of someone else's solution."}</p>
    </section>
  </main>;
}
