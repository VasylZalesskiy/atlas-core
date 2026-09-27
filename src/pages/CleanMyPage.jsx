import {useEffect,useState} from "react";
import {Bell,Home as HomeIcon,KeyRound,LogIn,LogOut,MapPin,MessageCircleMore,MessagesSquare,Pencil,Plus,Power,PowerOff,Sparkles,Trash2,UserRound} from "lucide-react";
import {Link} from "react-router-dom";
import OnlinePresence from "../components/OnlinePresence";
import CleanHistoryNav from "../components/CleanHistoryNav";
import {deleteMyOpportunity,loadMyPassport,loginAtlasAccount,logoutAtlasAccount,registerAtlasAccount,saveMyPassport,setMyOpportunityActive} from "../services/passportStore";
import "../styles/cleanHome.css";
import "../styles/cleanMyPage.css";

function friendlyAccountError(error,uk){
  const text=String(error?.message||error||"");
  if(/login-taken/i.test(text))return uk?"Такий логін уже зайнятий.":"This login is already taken.";
  if(/invalid-login/i.test(text))return uk?"Неправильний логін або пароль.":"Incorrect login or password.";
  if(/password-invalid/i.test(text))return uk?"Пароль має містити щонайменше 8 символів.":"Password must contain at least 8 characters.";
  if(/login-invalid/i.test(text))return uk?"Логін має містити від 3 до 60 символів.":"Login must contain 3 to 60 characters.";
  return text|| (uk?"Не вдалося виконати дію.":"Could not complete the action.");
}

export default function CleanMyPage({lang="uk",setLang,inboxUnread=0}){
  const uk=lang!=="en";
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [editing,setEditing]=useState(false);
  const [form,setForm]=useState({displayName:"",city:"",contact:"",profession:"",skills:""});
  const [login,setLogin]=useState("");
  const [password,setPassword]=useState("");
  const [accountMode,setAccountMode]=useState("login");
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
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
      setEditing(Boolean(next.accounts?.length&&!next.passport));
      return next;
    }catch(cause){
      setError(String(cause?.message||cause||"profile-load-failed"));
      return null;
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

  async function enterAccount(kind){
    if(busy||!login.trim()||password.length<8)return;
    setBusy(kind);
    setError("");
    setNotice("");
    try{
      if(kind==="register")await registerAtlasAccount(login,password);
      else await loginAtlasAccount(login,password);
      setPassword("");
      const next=await reload();
      window.dispatchEvent(new Event("atlas:account-changed"));
      setNotice(kind==="register"
        ?(uk?"Акаунт створено. Ваші існуючі дані прив’язані до нього.":"Account created. Your existing data is linked to it.")
        :(uk?"Вхід виконано. Ваші можливості завантажено.":"Signed in. Your capabilities are loaded.")
      );
      if(next?.passport)setEditing(false);
    }catch(cause){
      setError(friendlyAccountError(cause,uk));
    }finally{
      setBusy("");
    }
  }

  async function signOut(){
    if(busy)return;
    setBusy("logout");
    setError("");
    try{
      await logoutAtlasAccount();
      setData(null);
      setNotice("");
      setEditing(false);
      await reload();
      window.dispatchEvent(new Event("atlas:account-changed"));
    }catch(cause){
      setError(friendlyAccountError(cause,uk));
    }finally{
      setBusy("");
    }
  }

  async function save(event){
    event.preventDefault();
    setBusy("profile");
    setError("");
    setNotice("");
    try{
      await saveMyPassport({
        passportId:data?.passport?.id||null,
        accountId:data?.accounts?.[0]?.account_id||null,
        displayName:form.displayName,
        city:form.city,
        contact:form.contact,
        profession:form.profession,
        skills:form.skills
      });
      await reload();
      setEditing(false);
      setNotice(uk?"Мою сторінку збережено.":"My page was saved.");
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

  const account=data?.accounts?.[0]||null;
  const p=data?.passport;
  const opportunities=data?.opportunities||[];
  const localPassportExists=Boolean(data?.passports?.length);
  const unread=Math.max(inboxUnread,noticeUnread);

  return <main className="cleanHomeShell cleanMyShell">
    <header className="cleanHomeTopbar">
      <div className="cleanHeaderBrandBlock">
        <Link className="cleanHomeBrand" to="/" aria-label={uk?"Головна":"Home"}>
          <span className="cleanHomeLogo">A</span>
          <span>ATLAS</span>
        </Link>
        <span className="cleanHeaderPageTitle">{uk?"Мій акаунт":"My account"}</span>
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

    <section className="cleanMyBody">
      {error&&<div className="cleanMyError">{error}</div>}
      {notice&&<div className="cleanMyNotice">{notice}</div>}

      {loading?<div className="cleanMyState">{uk?"Відкриваю акаунт…":"Opening account…"}</div>:!account?<>
        <div className="cleanMyHeading">
          <span>ATLAS</span>
          <h1>{uk?"Мій акаунт":"My account"}</h1>
          <p>{uk?"Створіть доступ один раз або увійдіть у вже створений акаунт. Після цього ваш паспорт і можливості завжди будуть тут.":"Create access once or sign in to an existing account. Your passport and capabilities will stay here."}</p>
        </div>

        <section className="cleanAccountGate">
          <div className="cleanAccountGateIcon"><KeyRound size={22}/></div>
          <div className="cleanAccountTabs">
            <button type="button" className={accountMode==="login"?"active":""} onClick={()=>setAccountMode("login")}>{uk?"Увійти":"Sign in"}</button>
            <button type="button" className={accountMode==="register"?"active":""} onClick={()=>setAccountMode("register")}>{uk?"Створити акаунт":"Create account"}</button>
          </div>

          {localPassportExists&&<div className="cleanAccountLinkHint">
            <strong>{uk?"Ваші дані вже є в Atlas":"Your data already exists in Atlas"}</strong>
            <span>{uk?"Створіть акаунт — і наявний паспорт буде автоматично прив’язаний до нього.":"Create an account and your existing passport will be linked automatically."}</span>
          </div>}

          <label>
            <span>{uk?"Логін":"Login"}</span>
            <input autoComplete="username" value={login} onChange={e=>setLogin(e.target.value)} placeholder={uk?"Наприклад: Vasyl":"For example: Vasyl"}/>
          </label>
          <label>
            <span>{uk?"Пароль":"Password"}</span>
            <input type="password" autoComplete={accountMode==="login"?"current-password":"new-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder={uk?"Мінімум 8 символів":"At least 8 characters"}/>
          </label>

          <button className="cleanAccountSubmit" type="button" disabled={busy||!login.trim()||password.length<8} onClick={()=>enterAccount(accountMode)}>
            {accountMode==="login"?<LogIn size={17}/>:<KeyRound size={17}/>}
            {busy===accountMode
              ?(uk?"Зачекайте…":"Please wait…")
              :accountMode==="login"?(uk?"Увійти в мій акаунт":"Sign in to my account"):(uk?"Створити мій акаунт":"Create my account")}
          </button>
          <small>{uk?"Цей самий логін і пароль можна використати на іншому телефоні або комп’ютері.":"Use the same login and password on another phone or computer."}</small>
        </section>
      </>:<>
        <section className="cleanAccountSummary">
          <div>
            <UserRound size={18}/>
            <span><small>{uk?"Мій акаунт":"My account"}</small><strong>{account.login}</strong></span>
          </div>
          <button type="button" onClick={signOut} disabled={busy==="logout"}><LogOut size={15}/>{uk?"Вийти":"Sign out"}</button>
        </section>

        <div className="cleanMyHeading cleanMyHeadingAccount">
          <span>{uk?"МОЯ СТОРІНКА":"MY PAGE"}</span>
          <h1>{p?.display_name||(uk?"Створити мою сторінку":"Create my page")}</h1>
          <p>{uk?"Це ваш паспорт у Atlas. Дані вводяться один раз і потім лише редагуються за потреби.":"This is your Atlas passport. Enter the details once and edit only when needed."}</p>
        </div>

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
            <strong>{p?(uk?"Змінити дані моєї сторінки":"Edit my page"):(uk?"Створити мою сторінку":"Create my page")}</strong>
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
              {busy==="profile"?(uk?"Зберігаю…":"Saving…"):(p?(uk?"Зберегти зміни":"Save changes"):(uk?"Створити мою сторінку":"Create my page"))}
            </button>
            {p&&<button className="cleanMySecondary" type="button" onClick={()=>setEditing(false)}>{uk?"Скасувати":"Cancel"}</button>}
          </div>
        </form>}

        {p&&<section className="cleanMyCapabilities">
          <div className="cleanMySectionHead">
            <div>
              <h2>{uk?"Мої можливості":"My capabilities"}</h2>
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
      <Link className="active" aria-current="page" to="/profile"><UserRound size={19}/><span>{uk?"Мій акаунт":"My account"}</span></Link>
      <Link to="/messages"><MessagesSquare size={19}/><span>{uk?"Повідомлення":"Messages"}</span>{inboxUnread>0&&<b>{inboxUnread>9?"9+":inboxUnread}</b>}</Link>
      <Link to="/chat"><MessageCircleMore size={19}/><span>{uk?"Кімнати":"Rooms"}</span></Link>
    </nav>
  </main>;
}
