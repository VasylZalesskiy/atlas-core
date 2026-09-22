import {KeyRound,LogIn,LogOut,Plus,UserRound,UsersRound} from "lucide-react";
import {useState} from "react";
import {Link} from "react-router-dom";
import "../styles/passportAccounts.css";

function accountError(error){
  const text=String(error?.message||error||"");
  if(/login-taken/i.test(text))return "Такий логін уже зайнятий.";
  if(/invalid-login/i.test(text))return "Неправильний логін або пароль.";
  if(/password-invalid/i.test(text))return "Пароль має містити щонайменше 8 символів.";
  if(/login-invalid/i.test(text))return "Логін має містити від 3 до 60 символів.";
  return text||"Не вдалося виконати дію.";
}

export default function PassportAccountPanel({accounts=[],passports=[],activePassportId,onLogin,onRegister,onSelect,onNew,onLogout}){
  const [login,setLogin]=useState("");
  const [password,setPassword]=useState("");
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const account=accounts[0]||null;

  async function submit(kind){
    if(busy)return;
    setError("");
    setBusy(kind);
    try{
      if(kind==="login")await onLogin(login,password);
      else await onRegister(login,password);
      setPassword("");
    }catch(cause){setError(accountError(cause))}
    finally{setBusy("")}
  }

  if(!account)return <section className="passportAccountPanel">
    <div className="passportAccountIntro">
      <KeyRound size={22}/>
      <div><strong>Вхід до моїх сторінок Atlas</strong><span>Один логін і пароль можуть відкривати кілька ваших Паспортів — людей або компаній.</span></div>
    </div>
    <div className="passportAccountLogin">
      <label><span>Логін / ім’я</span><input value={login} onChange={e=>setLogin(e.target.value)} autoComplete="username" placeholder="Наприклад: Vasyl"/></label>
      <label><span>Пароль</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" placeholder="Мінімум 8 символів"/></label>
      <div className="passportAccountButtons">
        <button type="button" className="primary" disabled={busy||!login.trim()||password.length<8} onClick={()=>submit("login")}><LogIn size={17}/>{busy==="login"?"Входжу…":"Увійти"}</button>
        <button type="button" className="secondary" disabled={busy||!login.trim()||password.length<8} onClick={()=>submit("register")}><KeyRound size={17}/>{busy==="register"?"Створюю…":"Створити доступ"}</button>
      </div>
    </div>
    {passports.length>0&&<small className="passportAccountHint">Якщо на цьому пристрої вже є Паспорт, кнопка «Створити доступ» прив’яже його до нового логіна.</small>}
    {error&&<div className="passportAccountError">{error}</div>}
  </section>;

  return <section className="passportAccountPanel logged">
    <div className="passportAccountTop">
      <div className="passportAccountIntro"><UserRound size={22}/><div><strong>Мої сторінки Atlas</strong><span>Вхід: <b>{account.login}</b> · сторінок: {passports.length}</span></div></div>
      <div className="passportAccountTopActions"><Link className="passportGroupsLink" to="/groups"><UsersRound size={16}/>Групи</Link><button type="button" className="passportLogout" onClick={()=>onLogout(account.account_id)}><LogOut size={16}/>Вийти</button></div>
    </div>
    <div className="passportSwitcher">
      <label><span>Вибрати сторінку</span>
        <select value={activePassportId||""} onChange={e=>onSelect(e.target.value)}>
          {passports.length===0&&<option value="">Сторінок ще немає</option>}
          {passports.map(item=><option key={item.id} value={item.id}>{item.entity_type==="company"?"🏢":"👤"} {item.display_name}{item.city?(" · "+item.city):""}</option>)}
        </select>
      </label>
      <button type="button" className="secondary passportNew" onClick={()=>onNew(account.account_id)}><Plus size={17}/>Нова сторінка</button>
    </div>
    <small className="passportAccountHint">На іншому телефоні або комп’ютері введіть цей самий логін і пароль — і побачите свої сторінки.</small>
  </section>;
}
