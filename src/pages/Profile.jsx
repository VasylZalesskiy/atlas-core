import {useState} from "react";
import {ArrowLeft,PlusCircle} from "lucide-react";
import {Link} from "react-router-dom";
import supabase from "../services/supabase";

export default function Profile({t}){
  const [saved,setSaved]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [f,setF]=useState({name:"",city:"",opportunity:"",contact:""});

  async function submit(e){
    e.preventDefault();
    if(saving)return;
    setError("");
    setSaved(false);
    if(!supabase){setError(t.supabaseMissing);return}
    setSaving(true);

    const text=f.opportunity.trim();
    const payload={
      slug:`${(f.name||"atlas").toLowerCase().replace(/[^a-zа-яіїє0-9]+/gi,"-")}-${Date.now().toString().slice(-6)}`,
      name:f.name.trim(),
      city:f.city.trim(),
      headline:text.slice(0,100)||"Можливість",
      can_help:text,
      can_share:text,
      needs:"",
      contact:f.contact.trim()
    };

    const r=await supabase.from("profiles").insert(payload);
    setSaving(false);
    if(r.error){setError(r.error.message);return}
    setSaved(true);
    setF(value=>({...value,opportunity:""}));
  }

  return <main className="page">
    <section className="profileShell" style={{maxWidth:720}}>
      <Link className="back" to="/"><ArrowLeft size={18}/>Назад до Atlas</Link>
      <span className="kicker">ATLAS · ПАСПОРТ МОЖЛИВОСТЕЙ</span>
      <h1 style={{marginBottom:10}}>Додайте можливість</h1>
      <p style={{margin:"0 0 26px",color:"#66746c",fontSize:17,lineHeight:1.55}}>
        Просто напишіть своїми словами, що у вас є або чим ви можете бути корисні. Можна позичити, продати, подарувати, віддати безкоштовно чи допомогти своїми знаннями.
      </p>

      <form className="profileForm" onSubmit={submit} style={{gridTemplateColumns:"1fr"}}>
        <label>
          <span>Ім’я або псевдонім</span>
          <input disabled={saving} required value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder="Наприклад: Василь або Atlas A17"/>
        </label>

        <label>
          <span>Контакт — іншим користувачам зараз не показується</span>
          <input disabled={saving} required value={f.contact} onChange={e=>setF({...f,contact:e.target.value})} placeholder="Телефон або email"/>
        </label>

        <label>
          <span>Місто / район (необов’язково)</span>
          <input disabled={saving} value={f.city} onChange={e=>setF({...f,city:e.target.value})} placeholder="Наприклад: Тернопіль"/>
        </label>

        <label>
          <span>Що ви можете додати?</span>
          <textarea
            autoFocus
            disabled={saving}
            required
            value={f.opportunity}
            onChange={e=>setF({...f,opportunity:e.target.value})}
            placeholder="Наприклад: маю генератор 5 кВт, можу інколи позичати безкоштовно"
            style={{minHeight:150,fontSize:17}}
          />
        </label>

        {error&&<div className="error">{error}</div>}
        {saved&&<div className="success">✓ Можливість додано. Можете одразу додати ще одну.</div>}

        <button className="primary" disabled={saving}>
          <PlusCircle size={20}/>{saving?t.saving:"Додати можливість"}
        </button>
      </form>

      <p className="principle" style={{textAlign:"center"}}>Твої можливості є частинкою чиєїсь задачі.</p>
    </section>
  </main>;
}
