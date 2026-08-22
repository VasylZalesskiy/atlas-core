import {useEffect,useMemo,useRef,useState} from "react";
import {CheckCircle2,Copy,HeartHandshake,Inbox,Pencil,Pause,Play,Plus,Share2,Trash2,X} from "lucide-react";
import {Link} from "react-router-dom";
import {
  addMyOpportunity,
  deleteMyOpportunity,
  loadIncomingRequests,
  loadMyPassport,
  opportunityGroups,
  respondToPassportRequest,
  saveMyPassport,
  setMyOpportunityActive,
  updateMyOpportunity
} from "../services/passportStore";

const durations=[
  {value:"hour",label:"1 година"},
  {value:"day",label:"1 день"},
  {value:"month",label:"1 місяць"},
  {value:"year",label:"1 рік"}
];

const paymentOptions=[
  {value:"free",label:"Безкоштовно"},
  {value:"paid",label:"За оплату"},
  {value:"exchange",label:"Обмін"},
  {value:"negotiable",label:"За домовленістю"}
];

const priceUnits=["кг","шт.","година","консультація","послуга","день","поїздка","комплект"];
const currencySymbols={UAH:"грн",USD:"$",EUR:"€"};

const emptyEntry=()=>({
  group:"have",text:"",duration:"month",place:"",radiusValue:"",radiusUnit:"км",online:false,
  paymentType:"free",priceValue:"",priceUnit:"шт.",currency:"UAH",minimumQuantity:"",deliveryIncluded:false
});

function friendlyError(error){
  const text=String(error?.message||error||"");
  if(/anonymous|signups|disabled/i.test(text))return "У Supabase потрібно увімкнути анонімний вхід.";
  if(/atlas_requests|relation .*atlas_requests.*does not exist/i.test(text))return "Запити між користувачами ще не активовані.";
  if(/atlas_passports|atlas_opportunities|atlas_private_contacts|atlas_needs|relation .* does not exist/i.test(text))return "База Паспортів ще не активована.";
  return text||"Не вдалося виконати дію.";
}

function OpportunityFields({value,onChange,textareaRef,compact=false}){
  const paid=value.paymentType==="paid";
  return <div className="opportunityFields">
    <label><span>Підгрупа</span><select value={value.group} onChange={event=>onChange({...value,group:event.target.value})}>{opportunityGroups.map(group=><option key={group.value} value={group.value}>{group.label}</option>)}</select></label>
    <label><span>Можливість</span><textarea ref={textareaRef} required maxLength={1100} value={value.text} onChange={event=>onChange({...value,text:event.target.value})} placeholder="Наприклад: маю 20 кг зайвої картоплі" style={{minHeight:compact?72:82}}/><small>Записуйте своїми словами. Atlas не змінює зміст тексту.</small></label>
    <fieldset className="durationPicker"><legend>Актуальність</legend><div>{durations.map(item=><button type="button" className={value.duration===item.value?"active":""} key={item.value} onClick={()=>onChange({...value,duration:item.value})}>{item.label}</button>)}</div></fieldset>
    <label><span>Умови надання</span><select value={value.paymentType} onChange={event=>onChange({...value,paymentType:event.target.value})}>{paymentOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    {paid&&<div className="opportunityPrice">
      <label><span>Ціна за одиницю</span><input required inputMode="decimal" value={value.priceValue} onChange={event=>onChange({...value,priceValue:event.target.value.replace(/[^0-9.,]/g,"").slice(0,14)})} placeholder="40"/></label>
      <label><span>Одиниця</span><select value={value.priceUnit} onChange={event=>onChange({...value,priceUnit:event.target.value})}>{priceUnits.map(unit=><option key={unit}>{unit}</option>)}</select></label>
      <label><span>Валюта</span><select value={value.currency} onChange={event=>onChange({...value,currency:event.target.value})}><option value="UAH">грн</option><option value="USD">USD</option><option value="EUR">EUR</option></select></label>
      <label><span>Мінімальна кількість</span><input inputMode="decimal" value={value.minimumQuantity} onChange={event=>onChange({...value,minimumQuantity:event.target.value.replace(/[^0-9.,]/g,"").slice(0,14)})} placeholder="5"/></label>
      <label className="onlineCheck deliveryCheck"><input type="checkbox" checked={value.deliveryIncluded} onChange={event=>onChange({...value,deliveryIncluded:event.target.checked})}/><span>Доставка входить у ціну</span></label>
    </div>}
    <div className="opportunityLocation">
      <label><span>Місце надання</span><input value={value.place} maxLength={120} onChange={event=>onChange({...value,place:event.target.value})} placeholder="Місто, район або адреса"/></label>
      <label><span>Радіус</span><input inputMode="decimal" value={value.radiusValue} onChange={event=>onChange({...value,radiusValue:event.target.value.replace(/[^0-9.,]/g,"").slice(0,12)})} placeholder="30"/></label>
      <label><span>Одиниця</span><select value={value.radiusUnit} onChange={event=>onChange({...value,radiusUnit:event.target.value})}><option>км</option><option>м</option><option>см</option></select></label>
    </div>
    <label className="onlineCheck"><input type="checkbox" checked={value.online} onChange={event=>onChange({...value,online:event.target.checked})}/><span>Можна надати онлайн</span></label>
  </div>;
}

function opportunityMeta(item){
  const duration=durations.find(option=>option.value===item.duration)?.label;
  const distance=item.radiusValue?`${item.radiusValue} ${item.radiusUnit}`:"";
  const payment=paymentOptions.find(option=>option.value===item.paymentType)?.label;
  const price=item.paymentType==="paid"&&item.priceValue?`${item.priceValue} ${currencySymbols[item.currency]||item.currency} / ${item.priceUnit}`:"";
  const minimum=item.paymentType==="paid"&&item.minimumQuantity?`мін. ${item.minimumQuantity} ${item.priceUnit}`:"";
  return [payment,price,minimum,item.deliveryIncluded?"доставка включена":"",duration,item.place,distance,item.online?"онлайн":""].filter(Boolean);
}

export default function Profile(){
  const addRef=useRef(null);
  const textareaRef=useRef(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [adding,setAdding]=useState(false);
  const [busyId,setBusyId]=useState("");
  const [editing,setEditing]=useState(null);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [passport,setPassport]=useState(null);
  const [opportunities,setOpportunities]=useState([]);
  const [requests,setRequests]=useState([]);
  const [form,setForm]=useState({displayName:"",city:"",contact:"",profession:"",skills:""});
  const [entry,setEntry]=useState(emptyEntry);

  const shareUrl=useMemo(()=>passport?.slug?`${window.location.origin}/p/${passport.slug}`:"",[passport?.slug]);
  const activeCount=opportunities.filter(item=>item.is_active).length;
  const pendingCount=requests.filter(item=>item.status==="pending").length;

  useEffect(()=>{
    let alive=true;
    setLoading(true);
    loadMyPassport().then(async data=>{
      if(!alive)return;
      setPassport(data.passport);
      setOpportunities(data.opportunities||[]);
      setForm({
        displayName:data.passport?.display_name||"",
        city:data.passport?.city||"",
        contact:data.contact||"",
        profession:data.passport?.profession||"",
        skills:data.passport?.skills||""
      });
      if(data.passport?.id){
        try{const incoming=await loadIncomingRequests();if(alive)setRequests(incoming||[])}catch{/* Запити можуть ще не бути активовані. */}
      }
    }).catch(cause=>{if(alive)setError(friendlyError(cause))}).finally(()=>{if(alive)setLoading(false)});
    return()=>{alive=false};
  },[]);

  function scrollToAdd(){
    setEditing(null);
    addRef.current?.scrollIntoView({behavior:"smooth",block:"start"});
    window.setTimeout(()=>textareaRef.current?.focus(),320);
  }

  async function savePassport(event){
    event.preventDefault();
    if(saving)return;
    setSaving(true);setError("");setNotice("");
    try{
      const saved=await saveMyPassport(form);
      setPassport(saved);
      setNotice("Паспорт збережено.");
    }catch(cause){setError(friendlyError(cause))}finally{setSaving(false)}
  }

  async function addOpportunity(event){
    event.preventDefault();
    if(adding||!passport?.id||!entry.text.trim())return;
    if(entry.paymentType==="paid"&&!entry.priceValue){setError("Для платної можливості вкажіть ціну за одиницю.");return}
    setAdding(true);setError("");setNotice("");
    try{
      const added=await addMyOpportunity(passport.id,entry);
      setOpportunities(items=>[added,...items]);
      setEntry(value=>({...emptyEntry(),group:value.group}));
      setNotice("Можливість додано. Можна одразу додати наступну.");
      window.setTimeout(()=>textareaRef.current?.focus(),80);
    }catch(cause){setError(friendlyError(cause))}finally{setAdding(false)}
  }

  function startEdit(item){setEditing({...item});setError("");setNotice("")}

  async function saveEdit(){
    if(!editing?.id||!editing.text.trim()||busyId)return;
    if(editing.paymentType==="paid"&&!editing.priceValue){setError("Для платної можливості вкажіть ціну за одиницю.");return}
    setBusyId(editing.id);setError("");
    try{
      const updated=await updateMyOpportunity(editing.id,editing);
      setOpportunities(items=>items.map(item=>item.id===updated.id?updated:item));
      setEditing(null);setNotice("Зміни збережено.");
    }catch(cause){setError(friendlyError(cause))}finally{setBusyId("")}
  }

  async function toggleOpportunity(item){
    if(busyId)return;
    setBusyId(item.id);setError("");
    try{
      const updated=await setMyOpportunityActive(item.id,!item.is_active);
      setOpportunities(items=>items.map(current=>current.id===updated.id?updated:current));
      setNotice(updated.is_active?"Можливість знову активна.":"Можливість призупинено.");
    }catch(cause){setError(friendlyError(cause))}finally{setBusyId("")}
  }

  async function removeOpportunity(id){
    if(busyId||!window.confirm("Видалити цю можливість?"))return;
    setBusyId(id);setError("");
    try{
      await deleteMyOpportunity(id);
      setOpportunities(items=>items.filter(item=>item.id!==id));
      if(editing?.id===id)setEditing(null);
      setNotice("Можливість видалено.");
    }catch(cause){setError(friendlyError(cause))}finally{setBusyId("")}
  }

  async function answerRequest(id,status){
    if(busyId)return;
    setBusyId(id);setError("");
    try{
      const updated=await respondToPassportRequest(id,status);
      setRequests(items=>items.map(item=>item.id===id?{...item,...updated}:item));
      setNotice(status==="accepted"?"Запит прийнято.":"Запит відхилено.");
    }catch(cause){setError(friendlyError(cause))}finally{setBusyId("")}
  }

  async function copyLink(){if(shareUrl){await navigator.clipboard.writeText(shareUrl);setNotice("Посилання на Паспорт скопійовано.")}}
  async function sharePassport(){
    if(!shareUrl)return;
    if(navigator.share){await navigator.share({title:"Atlas · Паспорт можливостей",url:shareUrl}).catch(()=>{});return}
    await copyLink();
  }

  if(loading)return <main className="page appPage"><section className="profileShell"><p>Відкриваю ваш Паспорт…</p></section></main>;

  return <main className="page appPage"><section className="profileShell passportPage">
    <div className="passportHeading"><div><span className="kicker">ATLAS · ПАСПОРТ МОЖЛИВОСТЕЙ</span><h1>{passport?"Ваш Паспорт":"Створіть Паспорт"}</h1><p>Записуйте можливості так, як вони є. Кожна з них може стати частиною чиєїсь задачі.</p></div>{passport&&<div className="passportCounter"><strong>{activeCount}</strong><span>активних</span></div>}</div>

    <form className="passportIdentity" onSubmit={savePassport}>
      <label><span>Ім’я або псевдонім</span><input required value={form.displayName} onChange={event=>setForm({...form,displayName:event.target.value})}/></label>
      <label><span>Місто / район</span><input value={form.city} onChange={event=>setForm({...form,city:event.target.value})}/></label>
      <label className="contactField"><span>Приватний контакт</span><input required value={form.contact} onChange={event=>setForm({...form,contact:event.target.value})}/><small>Публічно не показується. Відкривається лише після вашої згоди.</small></label>
      <button className="secondary" disabled={saving}>{saving?"Зберігаю…":passport?"Зберегти дані":"Створити Паспорт"}</button>
    </form>

    {passport&&<>
      <section className="passportActions">
        <button className="primary" type="button" onClick={scrollToAdd}><Plus size={19}/>Додати можливість</button>
        <Link className="needsShortcut" to="/needs"><HeartHandshake size={18}/>Мої потреби</Link>
        <button className="secondary" type="button" onClick={sharePassport}><Share2 size={17}/>Поділитися</button>
        <button className="secondary iconButton" type="button" onClick={copyLink} aria-label="Копіювати посилання"><Copy size={17}/></button>
      </section>

      <section className="opportunityEditor" ref={addRef}>
        <div className="sectionTitle"><div><span>НОВА МОЖЛИВІСТЬ</span><h2>Додати як є</h2></div></div>
        <form onSubmit={addOpportunity}>
          <OpportunityFields value={entry} onChange={setEntry} textareaRef={textareaRef}/>
          <button className="primary addOpportunity" disabled={adding||!entry.text.trim()}><Plus size={18}/>{adding?"Додаю…":"Додати до Паспортa"}</button>
        </form>
      </section>

      <section className="opportunityGroups">
        <div className="sectionTitle"><div><span>МОЇ МОЖЛИВОСТІ</span><h2>{opportunities.length} записів у {opportunityGroups.length} підгрупах</h2></div></div>
        {opportunityGroups.map(group=>{
          const items=opportunities.filter(item=>item.group===group.value);
          return <details className="opportunityGroup" key={group.value} open={items.length>0}>
            <summary><span>{group.label}</span><b>{items.length}</b></summary>
            <div className="opportunityList">
              {items.length===0&&<p className="groupEmpty">Поки порожньо.</p>}
              {items.map(item=>{
                const meta=opportunityMeta(item);
                const isEditing=editing?.id===item.id;
                return <article className={`opportunityCard ${item.is_active?"":"paused"}`} key={item.id}>
                  {isEditing?<div className="editOpportunity"><OpportunityFields value={editing} onChange={setEditing} compact/><div className="editActions"><button className="primary" type="button" disabled={busyId===item.id||!editing.text.trim()} onClick={saveEdit}><CheckCircle2 size={17}/>Зберегти</button><button className="secondary" type="button" onClick={()=>setEditing(null)}><X size={17}/>Скасувати</button></div></div>:<>
                    <div className="opportunityCopy"><p>{item.text}</p><div className="opportunityMeta">{!item.is_active&&<span className="pausedTag">Призупинено</span>}{meta.map(value=><span key={value}>{value}</span>)}</div></div>
                    <div className="recordActions">
                      <button type="button" disabled={busyId===item.id} onClick={()=>toggleOpportunity(item)}>{item.is_active?<><Pause size={16}/>Призупинити</>:<><Play size={16}/>Активувати</>}</button>
                      <button type="button" onClick={()=>startEdit(item)}><Pencil size={16}/>Змінити</button>
                      <button className="deleteAction" type="button" disabled={busyId===item.id} onClick={()=>removeOpportunity(item.id)}><Trash2 size={16}/>Видалити</button>
                    </div>
                  </>}
                </article>;
              })}
            </div>
          </details>;
        })}
      </section>

      <section className="incomingRequests">
        <div className="sectionTitle"><div><span>ЗАПИТИ</span><h2><Inbox size={21}/>Вхідні{pendingCount?` · ${pendingCount}`:""}</h2></div></div>
        {requests.length===0?<p className="groupEmpty">Поки немає запитів.</p>:requests.map(item=><article key={item.id}><div><strong>{item.requester_name||"Користувач Atlas"}</strong>{item.opportunity?.text&&<span>{item.opportunity.text}</span>}<p>{item.message}</p></div>{item.status==="pending"?<div><button className="primary" disabled={busyId===item.id} onClick={()=>answerRequest(item.id,"accepted")}><CheckCircle2 size={16}/>Прийняти</button><button className="secondary" disabled={busyId===item.id} onClick={()=>answerRequest(item.id,"declined")}><X size={16}/>Відхилити</button></div>:<b>{item.status==="accepted"?"Прийнято":"Відхилено"}</b>}</article>)}
      </section>
    </>}

    {error&&<div className="error">{error}</div>}
    {notice&&<div className="success">{notice}</div>}
  </section></main>;
}
