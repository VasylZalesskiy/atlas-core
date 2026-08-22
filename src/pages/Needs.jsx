import {useEffect,useState} from "react";
import {ArrowRight,HeartHandshake,IdCard,LockKeyhole,MapPin} from "lucide-react";
import NeedManager from "../components/NeedManager";
import {loadMyPassport,saveMyPassport} from "../services/passportStore";
import "../styles/needsPage.css";

function friendlyError(error,uk){
  const text=String(error?.message||error||"");
  if(/anonymous|signups|disabled/i.test(text))return uk?"У Supabase потрібно увімкнути анонімний вхід.":"Anonymous sign-in must be enabled in Supabase.";
  if(/atlas_passports|atlas_private_contacts|atlas_needs|relation .* does not exist/i.test(text))return uk?"Паспорт потреб ще не активований у базі Atlas.":"The Needs Passport is not active in Atlas yet.";
  return text||(uk?"Не вдалося виконати дію.":"The action could not be completed.");
}

export default function Needs({lang="uk"}){
  const uk=lang!=="en";
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [passport,setPassport]=useState(null);
  const [needs,setNeeds]=useState([]);
  const [form,setForm]=useState({displayName:"",city:"",contact:"",profession:"",skills:""});
  const [error,setError]=useState("");

  useEffect(()=>{
    let alive=true;
    loadMyPassport().then(data=>{
      if(!alive)return;
      setPassport(data.passport);
      setNeeds(data.needs||[]);
      setForm(value=>({...value,
        displayName:data.passport?.display_name||"",
        city:data.passport?.city||"",
        contact:data.contact||""
      }));
    }).catch(cause=>{if(alive)setError(friendlyError(cause,uk))}).finally(()=>{if(alive)setLoading(false)});
    return()=>{alive=false};
  },[uk]);

  async function createPassport(event){
    event.preventDefault();
    if(saving)return;
    setSaving(true);setError("");
    try{
      const saved=await saveMyPassport(form);
      setPassport(saved);
    }catch(cause){setError(friendlyError(cause,uk))}finally{setSaving(false)}
  }

  if(loading)return <main className="page appPage needsPage"><section className="needsPageLoading"><HeartHandshake size={28}/><span>{uk?"Відкриваю Паспорт потреб…":"Opening your Needs Passport…"}</span></section></main>;

  if(!passport)return <main className="page appPage needsPage"><section className="needsOnboarding">
    <div className="needsOnboardingIntro">
      <span className="needsOnboardingIcon"><HeartHandshake size={32}/></span>
      <span className="needsOnboardingEyebrow">ATLAS · {uk?"ПАСПОРТ ПОТРЕБ":"NEEDS PASSPORT"}</span>
      <h1>{uk?"Що вам потрібно?":"What do you need?"}</h1>
      <p>{uk?"Створіть короткий профіль один раз — і одразу додавайте конкретні потреби з кількістю та терміном актуальності.":"Create a short profile once, then add specific needs with quantity and validity dates."}</p>
      <div className="needsOnboardingBenefits">
        <div><IdCard size={19}/><span><strong>{uk?"Один профіль":"One profile"}</strong><small>{uk?"для потреб і можливостей":"for needs and opportunities"}</small></span></div>
        <div><LockKeyhole size={19}/><span><strong>{uk?"Контакт приватний":"Private contact"}</strong><small>{uk?"відкривається лише за згодою":"revealed only with consent"}</small></span></div>
      </div>
    </div>

    <form className="needsOnboardingForm" onSubmit={createPassport}>
      <div><span>01</span><strong>{uk?"Створіть основу Паспорта":"Create your Passport"}</strong></div>
      <label><span>{uk?"Ім’я або псевдонім":"Name or nickname"}</span><input required autoComplete="name" value={form.displayName} onChange={event=>setForm({...form,displayName:event.target.value})} placeholder={uk?"Як до вас звертатися":"How should Atlas address you"}/></label>
      <label><span><MapPin size={15}/>{uk?"Місто / район":"City / area"}</span><input autoComplete="address-level2" value={form.city} onChange={event=>setForm({...form,city:event.target.value})} placeholder={uk?"Наприклад: Тернопіль":"For example: Ternopil"}/></label>
      <label><span>{uk?"Приватний контакт":"Private contact"}</span><input required value={form.contact} onChange={event=>setForm({...form,contact:event.target.value})} placeholder={uk?"Телефон, email або месенджер":"Phone, email or messenger"}/><small>{uk?"Інші користувачі не бачать його без вашої згоди.":"Other users cannot see it without your consent."}</small></label>
      {error&&<div className="needsOnboardingError" role="alert">{error}</div>}
      <button disabled={saving}>{saving?(uk?"Створюю…":"Creating…"):(uk?"Створити й додати потребу":"Create and add a need")}<ArrowRight size={19}/></button>
    </form>
  </section></main>;

  return <main className="page appPage needsPage"><NeedManager passportId={passport.id} passportSlug={passport.slug} passportCity={passport.city||""} initialNeeds={needs} lang={lang}/>{error&&<div className="needsOnboardingError" role="alert">{error}</div>}</main>;
}
