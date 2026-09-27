import {useEffect,useState} from "react";
import {ArrowLeft,MapPin,PlusCircle,Tag} from "lucide-react";
import {Link,useNavigate} from "react-router-dom";
import {addMyOpportunity,loadMyPassport} from "../services/passportStore";
import "../styles/pilotRedesign.css";

const types=[
  {value:"have",uk:"Я маю",en:"I have"},
  {value:"professional",uk:"Вмію",en:"I can"},
  {value:"help",uk:"Допоможу",en:"I can help"},
  {value:"sell",uk:"Продам",en:"Sell"}
];

export default function AddOpportunity({lang="uk"}){
  const uk=lang!=="en";
  const nav=useNavigate();
  const [passport,setPassport]=useState(null);
  const [loading,setLoading]=useState(true);
  const [form,setForm]=useState({text:"",group:"have",place:"",duration:"month",paymentType:"free",priceValue:"",priceUnit:"шт.",currency:"UAH"});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{loadMyPassport().then(data=>{setPassport(data.passport||null);setForm(v=>({...v,place:data.passport?.city||""}))}).catch(c=>setError(String(c?.message||c))).finally(()=>setLoading(false))},[]);

  async function submit(event){
    event.preventDefault();
    if(!passport||!form.text.trim()||busy)return;
    setBusy(true);setError("");
    try{
      await addMyOpportunity(passport.id,{...form,text:form.text.trim(),online:false,radiusValue:"",radiusUnit:"км",visibilityScope:"global",saleQuantity:"",saleUnit:"кг",validUntil:"",minimumQuantity:"",deliveryIncluded:false});
      nav("/me");
    }catch(cause){setError(String(cause?.message||cause||"opportunity-save-failed"))}
    finally{setBusy(false)}
  }

  if(loading)return <main className="pilotPage"><div className="pilotState">{uk?"Відкриваю форму…":"Opening form…"}</div></main>;
  if(!passport)return <main className="pilotPage"><div className="pilotEmpty"><strong>{uk?"Спочатку створіть свою сторінку":"Create your page first"}</strong><Link className="pilotPrimary" to="/me">{uk?"Моя сторінка":"My page"}</Link></div></main>;

  return <main className="pilotPage pilotAddOpportunity">
    <header className="pilotPageHead"><div><PlusCircle size={23}/><h1>{uk?"Додати можливість":"Add capability"}</h1></div><p>{uk?"Пишіть просто своїми словами. Atlas збереже структуру сам.":"Write naturally. Atlas will keep the structure for you."}</p></header>
    <Link className="pilotBackLink" to="/me"><ArrowLeft size={16}/>{uk?"Назад до моєї сторінки":"Back to my page"}</Link>
    {error&&<div className="pilotError">{error}</div>}
    <form className="pilotOpportunityForm" onSubmit={submit}>
      <label className="pilotBigField"><span>{uk?"Що ви маєте або можете?":"What do you have or can do?"}</span><textarea autoFocus required value={form.text} onChange={e=>setForm(v=>({...v,text:e.target.value}))} placeholder={uk?"Наприклад: маю дриль; ремонтую комп’ютери; можу підвезти машиною…":"For example: I have a drill; I repair computers; I can give a ride…"} /></label>
      <div className="pilotTypeChips" role="group" aria-label={uk?"Тип можливості":"Capability type"}>{types.map(type=><button key={type.value} className={form.group===type.value?"active":""} type="button" onClick={()=>setForm(v=>({...v,group:type.value,paymentType:type.value==="sell"?"paid":v.paymentType}))}>{uk?type.uk:type.en}</button>)}</div>
      <label className="pilotLineField"><MapPin size={17}/><input value={form.place} onChange={e=>setForm(v=>({...v,place:e.target.value}))} placeholder={uk?"Де доступно? — необов’язково":"Where available? — optional"}/></label>
      <details className="pilotOptional"><summary><Tag size={16}/>{uk?"Ціна й термін — необов’язково":"Price & duration — optional"}</summary>
        <label><span>{uk?"Актуальність":"Availability"}</span><select value={form.duration} onChange={e=>setForm(v=>({...v,duration:e.target.value}))}><option value="hour">{uk?"1 година":"1 hour"}</option><option value="day">{uk?"1 день":"1 day"}</option><option value="month">{uk?"1 місяць":"1 month"}</option><option value="year">{uk?"1 рік":"1 year"}</option></select></label>
        <label><span>{uk?"Умови":"Terms"}</span><select value={form.paymentType} onChange={e=>setForm(v=>({...v,paymentType:e.target.value}))} disabled={form.group==="sell"}><option value="free">{uk?"Безкоштовно":"Free"}</option><option value="paid">{uk?"Платно":"Paid"}</option><option value="exchange">{uk?"Обмін":"Exchange"}</option><option value="negotiable">{uk?"Домовимось":"Negotiable"}</option></select></label>
        {form.paymentType==="paid"&&<div className="pilotPriceRow"><input inputMode="decimal" value={form.priceValue} onChange={e=>setForm(v=>({...v,priceValue:e.target.value}))} placeholder={uk?"Ціна":"Price"}/><select value={form.currency} onChange={e=>setForm(v=>({...v,currency:e.target.value}))}><option>UAH</option><option>USD</option><option>EUR</option></select><select value={form.priceUnit} onChange={e=>setForm(v=>({...v,priceUnit:e.target.value}))}><option value="шт.">{uk?"шт.":"item"}</option><option value="кг">{uk?"кг":"kg"}</option><option value="година">{uk?"година":"hour"}</option><option value="послуга">{uk?"послуга":"service"}</option></select></div>}
      </details>
      <button className="pilotPrimary" type="submit" disabled={busy||!form.text.trim()}>{busy?(uk?"Зберігаю…":"Saving…"):(uk?"Додати можливість":"Add capability")}</button>
    </form>
  </main>;
}