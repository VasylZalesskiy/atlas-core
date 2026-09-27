import {useEffect,useState} from "react";
import {Bell,Home as HomeIcon,MapPin,MessageCircleMore,MessagesSquare,Save,Sparkles} from "lucide-react";
import {Link,useNavigate} from "react-router-dom";
import OnlinePresence from "../components/OnlinePresence";
import CleanHistoryNav from "../components/CleanHistoryNav";
import {addMyOpportunity,loadMyPassport} from "../services/passportStore";
import "../styles/cleanHome.css";
import "../styles/cleanAddOpportunity.css";

const types=[
  {value:"have",uk:"Я маю",en:"I have"},
  {value:"professional",uk:"Вмію",en:"I can"},
  {value:"help",uk:"Допоможу",en:"I can help"},
  {value:"sell",uk:"Продам",en:"Sell"}
];

export default function CleanAddOpportunity({lang="uk",setLang,inboxUnread=0}){
  const uk=lang!=="en";
  const navigate=useNavigate();
  const [passport,setPassport]=useState(null);
  const [loading,setLoading]=useState(true);
  const [text,setText]=useState("");
  const [group,setGroup]=useState("have");
  const [place,setPlace]=useState("");
  const [duration,setDuration]=useState("month");
  const [priceValue,setPriceValue]=useState("");
  const [priceUnit,setPriceUnit]=useState("шт.");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [noticeUnread,setNoticeUnread]=useState(0);

  useEffect(()=>{
    document.body.classList.add("clean-home-route");
    const onNotifications=event=>setNoticeUnread(Number(event?.detail?.unread)||0);
    window.addEventListener("atlas:notifications",onNotifications);
    loadMyPassport()
      .then(data=>{
        setPassport(data.passport||null);
        setPlace(data.passport?.city||"");
      })
      .catch(cause=>setError(String(cause?.message||cause||"profile-load-failed")))
      .finally(()=>setLoading(false));
    return()=>{
      window.removeEventListener("atlas:notifications",onNotifications);
      document.body.classList.remove("clean-home-route");
    };
  },[]);

  async function submit(event){
    event.preventDefault();
    if(!passport?.id){
      setError(uk?"Спочатку створіть свій паспорт можливостей.":"Create your capabilities passport first.");
      return;
    }
    if(!text.trim())return;
    setBusy(true);
    setError("");
    try{
      await addMyOpportunity(passport.id,{
        text:text.trim(),
        group,
        place:place.trim(),
        duration,
        paymentType:group==="sell"?"paid":"free",
        priceValue:group==="sell"?priceValue:"",
        priceUnit,
        currency:"UAH",
        visibilityScope:"global"
      });
      window.dispatchEvent(new Event("atlas:account-changed"));
      navigate("/profile");
    }catch(cause){
      setError(String(cause?.message||cause||"opportunity-save-failed"));
    }finally{
      setBusy(false);
    }
  }

  const unread=Math.max(inboxUnread,noticeUnread);

  return <main className="cleanHomeShell cleanAddShell">
    <header className="cleanHomeTopbar">
      <div className="cleanHeaderBrandBlock">
        <Link className="cleanHomeBrand" to="/" aria-label={uk?"Головна":"Home"}>
          <span className="cleanHomeLogo">A</span>
          <span>ATLAS</span>
        </Link>
        <span className="cleanHeaderPageTitle">{uk?"Додати можливість":"Add capability"}</span>
      </div>
      <CleanHistoryNav lang={lang}/>
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

    <section className="cleanAddBody">
      <div className="cleanAddHeading">
        <span>ATLAS</span>
        <h1>{uk?"Додати можливість":"Add capability"}</h1>
        <p>{uk?"Напишіть простими словами, що ви маєте або можете запропонувати.":"Describe in plain language what you have or can offer."}</p>
      </div>

      {loading&&<div className="cleanAddState">{uk?"Відкриваю паспорт…":"Opening passport…"}</div>}

      {!loading&&!passport&&<div className="cleanAddNeedPassport">
        <strong>{uk?"Спочатку потрібен ваш паспорт":"Your passport is needed first"}</strong>
        <span>{uk?"Створіть коротку сторінку з ім’ям і контактами, а тоді додавайте можливості.":"Create a short page with your name and contact details, then add capabilities."}</span>
        <Link to="/profile">{uk?"Перейти до мого паспорта":"Open my passport"}</Link>
      </div>}

      {!loading&&passport&&<form className="cleanAddForm" onSubmit={submit}>
        <label className="cleanAddMainField">
          <span>{uk?"Що ви маєте або можете?":"What do you have or can do?"}</span>
          <textarea
            autoFocus
            value={text}
            onChange={e=>setText(e.target.value)}
            placeholder={uk?"Наприклад: ремонтую комп’ютери, маю дриль, можу підвезти, продам картоплю":"For example: repair computers, have a drill, can give a ride, sell potatoes"}
          />
        </label>

        <div className="cleanAddTypes">
          {types.map(item=><button
            key={item.value}
            type="button"
            className={group===item.value?"active":""}
            onClick={()=>setGroup(item.value)}
          >{uk?item.uk:item.en}</button>)}
        </div>

        <details className="cleanAddOptional">
          <summary>{uk?"Додатково — необов’язково":"Optional details"}</summary>

          <label>
            <span>{uk?"Місце":"Location"}</span>
            <div className="cleanAddInputIcon"><MapPin size={15}/><input value={place} onChange={e=>setPlace(e.target.value)} placeholder={uk?"Місто або район":"City or area"}/></div>
          </label>

          <label>
            <span>{uk?"Актуальність":"Availability"}</span>
            <select value={duration} onChange={e=>setDuration(e.target.value)}>
              <option value="hour">{uk?"1 година":"1 hour"}</option>
              <option value="day">{uk?"1 день":"1 day"}</option>
              <option value="month">{uk?"1 місяць":"1 month"}</option>
              <option value="year">{uk?"1 рік":"1 year"}</option>
            </select>
          </label>

          {group==="sell"&&<div className="cleanAddPriceRow">
            <label>
              <span>{uk?"Ціна":"Price"}</span>
              <input inputMode="decimal" value={priceValue} onChange={e=>setPriceValue(e.target.value)} placeholder="0"/>
            </label>
            <label>
              <span>{uk?"За":"Per"}</span>
              <select value={priceUnit} onChange={e=>setPriceUnit(e.target.value)}>
                <option value="кг">кг</option>
                <option value="шт.">{uk?"шт.":"pc"}</option>
                <option value="послуга">{uk?"послуга":"service"}</option>
                <option value="година">{uk?"година":"hour"}</option>
              </select>
            </label>
          </div>}
        </details>

        {error&&<div className="cleanAddError">{error}</div>}

        <button className="cleanAddSave" type="submit" disabled={busy||!text.trim()}>
          <Save size={17}/>
          {busy?(uk?"Зберігаю…":"Saving…"):(uk?"Зберегти можливість":"Save capability")}
        </button>
      </form>}
    </section>

    <nav className="cleanHomeBottom" aria-label={uk?"Головна навігація":"Main navigation"}>
      <Link to="/"><HomeIcon size={19}/><span>{uk?"Головна":"Home"}</span></Link>
      <Link className="active" to="/profile"><Sparkles size={19}/><span>{uk?"Можливості":"Capabilities"}</span></Link>
      <Link to="/messages"><MessagesSquare size={19}/><span>{uk?"Повідомлення":"Messages"}</span></Link>
      <Link to="/chat"><MessageCircleMore size={19}/><span>{uk?"Кімнати":"Rooms"}</span></Link>
    </nav>
  </main>;
}
