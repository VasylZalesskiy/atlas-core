import {useEffect,useState} from "react";
import {Bell,Home as HomeIcon,MapPin,MessageCircleMore,MessagesSquare,Pencil,Plus,Power,PowerOff,Sparkles,Trash2,UserRound} from "lucide-react";
import {Link} from "react-router-dom";
import OnlinePresence from "../components/OnlinePresence";
import CleanHistoryNav from "../components/CleanHistoryNav";
import {deleteMyOpportunity,loadMyPassport,saveMyPassport,setMyOpportunityActive} from "../services/passportStore";
import "../styles/cleanHome.css";
import "../styles/cleanMyPage.css";

export default function CleanMyPage({lang="uk",setLang,inboxUnread=0}){
  const uk=lang!=="en";
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [editing,setEditing]=useState(false);
  const [form,setForm]=useState({displayName:"",city:"",contact:"",profession:"",skills:""});
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [noticeUnread,setNoticeUnread]=useState(0);

  async function reload(){
    setLoading(true);
    setError("");
    try{
      const next=await loadMyPassport();
      setData(next);
      const p=next.passport||{};
      setForm({
        displayName:p.display_name||"",
        city:p.city||"",
        contact:next.contact||"",
        profession:p.profession||"",
        skills:p.skills||""
      });
      if(!next.passport)setEditing(true);
    }catch(cause){
      setError(String(cause?.message||cause||"profile-load-failed"));
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{
    document.body.classList.add("clean-home-route");
    const onNotifications=event=>setNoticeUnread(Number(event?.detail?.unread)||0);
    window.addEventListener("atlas:notifications",onNotifications);
    reload();
    return()=>{
      window.removeEventListener("atlas:notifications",onNotifications);
      document.body.classList.remove("clean-home-route");
    };
  },[]);

  async function save(event){
    event.preventDefault();
    setBusy("profile");
    setError("");
    try{
      await saveMyPassport({
        passportId:data?.passport?.id||null,
        displayName:form.displayName,
        city:form.city,
        contact:form.contact,
        profession:form.profession,
        skills:form.skills
      });
      await reload();
      setEditing(false);
      window.dispatchEvent(new Event("atlas:account-changed"));
    }catch(cause){
      setError(String(cause?.message||cause||"profile-save-failed"));
    }finally{
      setBusy("");
    }
  }

  async function toggle(item){
    setBusy(item.id);
    setError("");
    try{
      await setMyOpportunityActive(item.id,!item.is_active);
      await reload();
    }catch(cause){
      setError(String(cause?.message||cause||"update-failed"));
    }finally{
      setBusy("");
    }
  }

  async function remove(item){
    if(!confirm(uk?"Видалити цю можливість?":"Delete this capability?"))return;
    setBusy(item.id);
    setError("");
    try{
      await deleteMyOpportunity(item.id);
      await reload();
    }catch(cause){
      setError(String(cause?.message||cause||"delete-failed"));
    }finally{
      setBusy("");
    }
  }

  const p=data?.passport;
  const opportunities=data?.opportunities||[];
  const unread=Math.max(inboxUnread,noticeUnread);

  return <main className="cleanHomeShell cleanMyShell">
    <header className="cleanHomeTopbar">
      <Link className="cleanHomeBrand" to="/" aria-label={uk?"Головна":"Home"}>
        <span className="cleanHomeLogo">A</span>
        <span>ATLAS</span>
      </Link>
      <div className="cleanHomeTopActions">
        <div className="cleanHomeLanguage" aria-label={uk?"Мова":"Language"}>
          <button type="button" className={lang==="uk"?"active":""} onClick={()=>setLang("uk")}>UA</button>
          <span>/</span>
          <button type="button" className={lang==="en"?"active":""} onClick={()=>setLang("en")}>EN</button>
        </div>
        <OnlinePresence lang={lang} compact/>
        <button className="cleanHomeBell" type="button" onClick={()=>window.dispatchEvent(new CustomEvent("atlas:open-notifications"))} aria-label={uk?"Сповіщення Atlas":"Atlas notifications"}>
          <Bell size={17}/>
          {unread>0&&<b>{unread>9?"9+":unread}</b>}
        </button>
      </div>
    </header>
    <CleanHistoryNav lang={lang} titleUk="Можливості" titleEn="Capabilities"/>

    <section className="cleanMyBody">
      <div className="cleanMyHeading">
        <span>ATLAS</span>
        <h1>{uk?"Твої можливості":"Your capabilities"}</h1>
        <p>{uk?"Що ви маєте, вмієте або можете запропонувати іншим.":"What you have, know or can offer to others."}</p>
      </div>

      {error&&<div className="cleanMyError">{error}</div>}

      {loading?<div className="cleanMyState">{uk?"Відкриваю вашу сторінку…":"Opening your page…"}</div>:<>
        {p&&!editing&&<section className="cleanMyProfile">
          <div className="cleanMyAvatar">{(p.display_name||"A").slice(0,1).toUpperCase()}</div>
          <div className="cleanMyProfileCopy">
            <strong>{p.display_name}</strong>
            {p.city&&<span><MapPin size={13}/>{p.city}</span>}
            {p.profession&&<small>{p.profession}</small>}
          </div>
          <button type="button" onClick={()=>setEditing(true)}><Pencil size={15}/>{uk?"Змінити":"Edit"}</button>
        </section>}

        {editing&&<form className="cleanMyForm" onSubmit={save}>
          <div className="cleanMyFormTitle">
            <UserRound size={18}/>
            <strong>{p?(uk?"Змінити дані":"Edit details"):(uk?"Створити свою сторінку":"Create your page")}</strong>
          </div>

          <label>
            <span>{uk?"Ім’я або псевдонім":"Name or nickname"}</span>
            <input required value={form.displayName} onChange={e=>setForm(v=>({...v,displayName:e.target.value}))}/>
          </label>

          <label>
            <span>{uk?"Місто / район":"City / area"}</span>
            <input value={form.city} onChange={e=>setForm(v=>({...v,city:e.target.value}))}/>
          </label>

          <label>
            <span>{uk?"Приватні контактні дані":"Private contact details"}</span>
            <input required value={form.contact} onChange={e=>setForm(v=>({...v,contact:e.target.value}))} placeholder={uk?"Телефон або email":"Phone or email"}/>
          </label>

          <details className="cleanMyOptional">
            <summary>{uk?"Додатково":"Optional"}</summary>
            <label>
              <span>{uk?"Професія":"Profession"}</span>
              <input value={form.profession} onChange={e=>setForm(v=>({...v,profession:e.target.value}))}/>
            </label>
            <label>
              <span>{uk?"Коротко про вміння":"Skills"}</span>
              <textarea value={form.skills} onChange={e=>setForm(v=>({...v,skills:e.target.value}))}/>
            </label>
          </details>

          <div className="cleanMyFormActions">
            <button className="cleanMyPrimary" type="submit" disabled={busy==="profile"}>
              {busy==="profile"?(uk?"Зберігаю…":"Saving…"):(p?(uk?"Зберегти":"Save"):(uk?"Створити сторінку":"Create page"))}
            </button>
            {p&&<button className="cleanMySecondary" type="button" onClick={()=>setEditing(false)}>{uk?"Скасувати":"Cancel"}</button>}
          </div>
        </form>}

        {p&&<section className="cleanMyCapabilities">
          <div className="cleanMySectionHead">
            <div>
              <h2>{uk?"Мої записи":"My entries"}</h2>
              <span>{opportunities.length}</span>
            </div>
            <Link to="/opportunities/new"><Plus size={16}/>{uk?"Додати":"Add"}</Link>
          </div>

          {!opportunities.length&&<div className="cleanMyEmpty">
            <Sparkles size={22}/>
            <strong>{uk?"Поки немає можливостей":"No capabilities yet"}</strong>
            <small>{uk?"Додайте першу простими словами.":"Add the first one in plain language."}</small>
          </div>}

          <div className="cleanMyList">
            {opportunities.map(item=><article className={!item.is_active?"inactive":""} key={item.id}>
              <div>
                <strong>{item.catalogItemName||item.text}</strong>
                {(item.place||p.city)&&<span><MapPin size={12}/>{item.place||p.city}</span>}
              </div>
              <div className="cleanMyItemActions">
                <button type="button" onClick={()=>toggle(item)} disabled={busy===item.id} aria-label={item.is_active?(uk?"Призупинити":"Pause"):(uk?"Активувати":"Activate")}>
                  {item.is_active?<Power size={16}/>:<PowerOff size={16}/>}
                </button>
                <button className="delete" type="button" onClick={()=>remove(item)} disabled={busy===item.id} aria-label={uk?"Видалити":"Delete"}>
                  <Trash2 size={16}/>
                </button>
              </div>
            </article>)}
          </div>
        </section>}
      </>}
    </section>

    <nav className="cleanHomeBottom" aria-label={uk?"Головна навігація":"Main navigation"}>
      <Link to="/"><HomeIcon size={19}/><span>{uk?"Головна":"Home"}</span></Link>
      <Link className="active" to="/profile"><Sparkles size={19}/><span>{uk?"Можливості":"Capabilities"}</span></Link>
      <Link to="/messages"><MessagesSquare size={19}/><span>{uk?"Повідомлення":"Messages"}</span>{inboxUnread>0&&<b>{inboxUnread>9?"9+":inboxUnread}</b>}</Link>
      <Link to="/chat"><MessageCircleMore size={19}/><span>{uk?"Кімнати":"Rooms"}</span></Link>
    </nav>
  </main>;
}
