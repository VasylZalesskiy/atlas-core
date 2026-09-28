import {useEffect,useMemo,useState} from "react";
import {Activity,ArrowLeft,Clock3,Eye,KeyRound,LogOut,MessageCircle,RefreshCw,Search,ShieldCheck,Sparkles,UserRound} from "lucide-react";
import {Link} from "react-router-dom";
import {
  loadActivityAdminState,loadActivityEvents,requestActivityAdminLink,
  signOutActivityAdmin,watchActivityAdminAuth
} from "../services/activityStore";
import "../styles/activityAdmin.css";

const EVENT_LABELS={
  page_view:"Перегляд сторінки",
  search:"Пошук",
  passport_created:"Створено паспорт",
  passport_updated:"Оновлено паспорт",
  opportunity_added:"Додано можливість",
  need_added:"Додано потребу",
  solution_request:"Запит на допомогу",
  solution_passport_request:"Розпочато діалог",
  solution_offer:"Запропоновано можливість",
  solution_message:"Надіслано повідомлення",
  solution_respond:"Відповідь на запит",
  solution_provided:"Позначено як надано",
  solution_complete:"Завершено рішення",
  solution_cancel:"Скасовано рішення"
};

function eventLabel(name){
  if(EVENT_LABELS[name])return EVENT_LABELS[name];
  return String(name||"").replace(/^Atlas\s+/,"").replace(/_/g," ");
}

function timeText(value){
  return new Intl.DateTimeFormat("uk-UA",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(value));
}

function shortSession(value){
  const text=String(value||"");
  return text?text.slice(0,4).toUpperCase()+"…"+text.slice(-4).toUpperCase():"—";
}

function friendlyError(error){
  const text=String(error?.message||error||"");
  if(/email-required/i.test(text))return "Вкажіть правильний email.";
  if(/rate limit|over_email_send_rate_limit/i.test(text))return "Лист уже надсилався. Зачекайте хвилину й спробуйте ще раз.";
  if(/row-level security|42501|permission denied/i.test(text))return "Цей email не має доступу до статистики.";
  return text||"Не вдалося завантажити статистику.";
}

export default function ActivityAdmin(){
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [user,setUser]=useState(null);
  const [isAdmin,setIsAdmin]=useState(false);
  const [email,setEmail]=useState("");
  const [linkSent,setLinkSent]=useState(false);
  const [sending,setSending]=useState(false);
  const [days,setDays]=useState(7);
  const [events,setEvents]=useState([]);
  const [error,setError]=useState("");

  async function refreshAccess(){
    setLoading(true);setError("");
    try{
      const state=await loadActivityAdminState();
      setUser(state.user);setIsAdmin(state.isAdmin);
      if(state.user?.email)setEmail(state.user.email);
      if(state.isAdmin){
        const rows=await loadActivityEvents({days});
        setEvents(rows);
      }else setEvents([]);
    }catch(e){setError(friendlyError(e))}finally{setLoading(false)}
  }

  async function refreshEvents(nextDays=days){
    if(!isAdmin)return;
    setRefreshing(true);setError("");
    try{setEvents(await loadActivityEvents({days:nextDays}))}
    catch(e){setError(friendlyError(e))}finally{setRefreshing(false)}
  }

  useEffect(()=>{
    const stop=watchActivityAdminAuth(()=>refreshAccess());
    refreshAccess();
    return stop;
  },[]);

  useEffect(()=>{if(isAdmin)refreshEvents(days)},[days]);

  const stats=useMemo(()=>{
    const now=Date.now();
    const sessions=new Set(events.map(item=>item.session_id).filter(Boolean));
    const active=new Set(events.filter(item=>now-new Date(item.created_at).getTime()<=15*60000).map(item=>item.session_id).filter(Boolean));
    const count=name=>events.filter(item=>item.event_name===name).length;
    return {
      sessions:sessions.size,active:active.size,
      pageViews:count("page_view"),
      searches:count("search"),
      opportunities:count("opportunity_added"),
      needs:count("need_added"),
      messages:events.filter(item=>["solution_message","solution_request","solution_passport_request"].includes(item.event_name)).length
    };
  },[events]);

  const searches=useMemo(()=>events.filter(item=>item.event_name==="search"&&item.label).slice(0,30),[events]);

  async function sendLink(event){
    event.preventDefault();setSending(true);setError("");
    try{await requestActivityAdminLink(email);setLinkSent(true)}
    catch(e){setError(friendlyError(e))}finally{setSending(false)}
  }

  async function signOut(){
    await signOutActivityAdmin().catch(()=>{});
    setUser(null);setIsAdmin(false);setEvents([]);
  }

  if(loading)return <main className="activityAdminPage"><section className="activityAccessCard"><RefreshCw className="spin"/><h1>Відкриваю статистику Atlas…</h1></section></main>;

  if(!isAdmin)return <main className="activityAdminPage"><section className="activityAccessCard">
    <Link className="activityBack" to="/"><ArrowLeft size={18}/>До Atlas</Link>
    <div className="activityShield"><KeyRound size={30}/></div>
    <span className="activityEyebrow">ATLAS · ПРИВАТНА СТАТИСТИКА</span>
    <h1>Вхід для власника</h1>
    <p>Ця сторінка не доступна користувачам Atlas. Вхід — через одноразове посилання на дозволений email адміністратора.</p>
    <form onSubmit={sendLink} className="activityLoginForm">
      <label><span>Email адміністратора</span><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/></label>
      <button disabled={sending}>{sending?<RefreshCw className="spin" size={18}/>:<KeyRound size={18}/>}Надіслати посилання</button>
    </form>
    {linkSent&&<div className="activityNotice">Перевірте пошту й відкрийте одноразове посилання.</div>}
    {error&&<div className="activityError">{error}</div>}
  </section></main>;

  return <main className="activityAdminPage"><section className="activityAdminShell">
    <header className="activityHeader">
      <div>
        <Link className="activityBack" to="/"><ArrowLeft size={18}/>До Atlas</Link>
        <span className="activityEyebrow">ATLAS · ПРИВАТНА СТАТИСТИКА</span>
        <h1>Що відбувається в Atlas</h1>
        <p>Дії користувачів без тексту приватних повідомлень, контактів і точних координат.</p>
      </div>
      <div className="activityIdentity"><ShieldCheck size={20}/><span><small>Захищений вхід</small><strong>{user?.email}</strong></span><button onClick={signOut} title="Вийти"><LogOut size={18}/></button></div>
    </header>

    <div className="activityToolbar">
      <div className="activityRange">
        {[1,7,30].map(value=><button key={value} className={days===value?"active":""} onClick={()=>setDays(value)}>{value===1?"Сьогодні":value===7?"7 днів":"30 днів"}</button>)}
      </div>
      <button className="activityRefresh" onClick={()=>refreshEvents()} disabled={refreshing}><RefreshCw className={refreshing?"spin":""} size={17}/>Оновити</button>
    </div>

    {error&&<div className="activityError">{error}</div>}

    <div className="activityStats">
      <article><UserRound/><span><small>Користувачі / пристрої</small><strong>{stats.sessions}</strong><b>{stats.active} активні за 15 хв</b></span></article>
      <article><Eye/><span><small>Перегляди сторінок</small><strong>{stats.pageViews}</strong></span></article>
      <article><Search/><span><small>Пошуки</small><strong>{stats.searches}</strong></span></article>
      <article><Sparkles/><span><small>Нові можливості</small><strong>{stats.opportunities}</strong></span></article>
      <article><Activity/><span><small>Нові потреби</small><strong>{stats.needs}</strong></span></article>
      <article><MessageCircle/><span><small>Діалоги / повідомлення</small><strong>{stats.messages}</strong></span></article>
    </div>

    <section className="activityPanel">
      <div className="activityPanelTitle"><Search size={20}/><div><h2>Що шукали</h2><p>Останні запити користувачів</p></div></div>
      {searches.length===0?<div className="activityEmpty">Пошуків у вибраному періоді ще немає.</div>:<div className="activitySearches">
        {searches.map(item=><article key={item.id}><span>{timeText(item.created_at)}</span><strong>{item.label}</strong><small>{shortSession(item.session_id)}</small></article>)}
      </div>}
    </section>

    <section className="activityPanel">
      <div className="activityPanelTitle"><Clock3 size={20}/><div><h2>Останні дії</h2><p>{events.length} подій за вибраний період</p></div></div>
      {events.length===0?<div className="activityEmpty">Статистика почне наповнюватися з моменту підключення.</div>:<div className="activityTable">
        <div className="activityTableHead"><span>Час</span><span>Користувач</span><span>Дія</span><span>Деталі</span></div>
        {events.slice(0,250).map(item=><div key={item.id}>
          <span>{timeText(item.created_at)}</span>
          <code>{shortSession(item.session_id)}</code>
          <strong>{eventLabel(item.event_name)}</strong>
          <span className="activityDetail">{item.label||item.path||"—"}</span>
        </div>)}
      </div>}
    </section>

    <p className="activityFootnote">Статистика збирається від моменту підключення цього модуля. Приватний текст чатів не зберігається в журналі активності.</p>
  </section></main>;
}
