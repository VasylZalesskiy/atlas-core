import {useEffect,useState} from "react";
import {MapPin,Pencil,Plus,Power,PowerOff,Trash2,UserRound} from "lucide-react";
import {Link} from "react-router-dom";
import {deleteMyOpportunity,loadMyPassport,saveMyPassport,setMyOpportunityActive} from "../services/passportStore";
import "../styles/pilotRedesign.css";

export default function MyPage({lang="uk"}){
  const uk=lang!=="en";
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [editing,setEditing]=useState(false);
  const [form,setForm]=useState({displayName:"",city:"",contact:"",profession:"",skills:""});
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");

  async function reload(){
    setLoading(true);setError("");
    try{
      const next=await loadMyPassport();
      setData(next);
      const p=next.passport||{};
      setForm({displayName:p.display_name||"",city:p.city||"",contact:next.contact||"",profession:p.profession||"",skills:p.skills||""});
      if(!next.passport)setEditing(true);
    }catch(cause){setError(String(cause?.message||cause||"profile-load-failed"))}
    finally{setLoading(false)}
  }
  useEffect(()=>{reload()},[]);

  async function save(event){
    event.preventDefault();
    setBusy("profile");setError("");
    try{
      await saveMyPassport({passportId:data?.passport?.id||null,displayName:form.displayName,city:form.city,contact:form.contact,profession:form.profession,skills:form.skills});
      await reload();setEditing(false);window.dispatchEvent(new Event("atlas:account-changed"));
    }catch(cause){setError(String(cause?.message||cause||"profile-save-failed"))}
    finally{setBusy("")}
  }

  async function toggle(item){
    setBusy(item.id);setError("");
    try{await setMyOpportunityActive(item.id,!item.is_active);await reload()}
    catch(cause){setError(String(cause?.message||cause||"update-failed"))}
    finally{setBusy("")}
  }

  async function remove(item){
    if(!confirm(uk?"Видалити цю можливість?":"Delete this capability?"))return;
    setBusy(item.id);setError("");
    try{await deleteMyOpportunity(item.id);await reload()}
    catch(cause){setError(String(cause?.message||cause||"delete-failed"))}
    finally{setBusy("")}
  }

  if(loading)return <main className="pilotPage"><div className="pilotState">{uk?"Відкриваю вашу сторінку…":"Opening your page…"}</div></main>;

  const p=data?.passport;
  const opportunities=data?.opportunities||[];

  return <main className="pilotPage pilotMe">
    <header className="pilotPageHead">
      <div><UserRound size={23}/><h1>{uk?"Моя сторінка":"My page"}</h1></div>
      <p>{uk?"Ваші дані та всі можливості, які ви вже додавали в Atlas.":"Your details and every capability you already added to Atlas."}</p>
    </header>

    {error&&<div className="pilotError">{error}</div>}

    {p&&!editing&&<section className="pilotProfileSummary">
      <div className="pilotAvatar">{(p.display_name||"A").slice(0,1).toUpperCase()}</div>
      <div><strong>{p.display_name}</strong>{p.city&&<span><MapPin size={14}/>{p.city}</span>}{p.profession&&<small>{p.profession}</small>}</div>
      <button type="button" onClick={()=>setEditing(true)}><Pencil size={16}/>{uk?"Змінити":"Edit"}</button>
    </section>}

    {editing&&<form className="pilotProfileForm" onSubmit={save}>
      <h2>{p?(uk?"Змінити дані":"Edit details"):(uk?"Створити мою сторінку":"Create my page")}</h2>
      <label><span>{uk?"Ім’я":"Name"}</span><input required value={form.displayName} onChange={e=>setForm(v=>({...v,displayName:e.target.value}))}/></label>
      <label><span>{uk?"Місто":"City"}</span><input value={form.city} onChange={e=>setForm(v=>({...v,city:e.target.value}))}/></label>
      <label><span>{uk?"Контакт":"Contact"}</span><input required value={form.contact} onChange={e=>setForm(v=>({...v,contact:e.target.value}))} placeholder={uk?"Телефон або email":"Phone or email"}/></label>
      <details><summary>{uk?"Додатково":"Optional"}</summary>
        <label><span>{uk?"Професія":"Profession"}</span><input value={form.profession} onChange={e=>setForm(v=>({...v,profession:e.target.value}))}/></label>
        <label><span>{uk?"Коротко про вміння":"Skills"}</span><textarea value={form.skills} onChange={e=>setForm(v=>({...v,skills:e.target.value}))}/></label>
      </details>
      <div className="pilotFormActions"><button className="pilotPrimary" type="submit" disabled={busy==="profile"}>{busy==="profile"?(uk?"Зберігаю…":"Saving…"):(uk?"Зберегти":"Save")}</button>{p&&<button type="button" onClick={()=>setEditing(false)}>{uk?"Скасувати":"Cancel"}</button>}</div>
    </form>}

    {p&&<section className="pilotCapabilitiesSection">
      <div className="pilotSectionTitle"><div><h2>{uk?"Твої можливості":"Your capabilities"}</h2><span>{opportunities.length}</span></div><Link className="pilotAddButton" to="/opportunities/new"><Plus size={18}/>{uk?"Додати можливість":"Add capability"}</Link></div>
      {!opportunities.length&&<div className="pilotEmpty"><strong>{uk?"Поки немає можливостей":"No capabilities yet"}</strong><span>{uk?"Додайте першу — простим текстом.":"Add the first one in plain text."}</span></div>}
      <div className="pilotCapabilityList">
        {opportunities.map(item=><article className={!item.is_active?"inactive":""} key={item.id}>
          <div><strong>{item.text}</strong><span>{item.place||p.city||""}</span></div>
          <div className="pilotItemActions">
            <button type="button" onClick={()=>toggle(item)} disabled={busy===item.id} title={item.is_active?(uk?"Призупинити":"Pause"):(uk?"Активувати":"Activate")}>{item.is_active?<Power size={17}/>:<PowerOff size={17}/>}</button>
            <button type="button" onClick={()=>remove(item)} disabled={busy===item.id} title={uk?"Видалити":"Delete"}><Trash2 size={17}/></button>
          </div>
        </article>)}
      </div>
    </section>}
  </main>;
}