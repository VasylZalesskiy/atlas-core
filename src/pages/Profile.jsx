import {useState} from "react";
import supabase from "../services/supabase";
import PageNavigation from "../components/PageNavigation";
import {useNavigate} from "react-router-dom";

export default function Profile({t,clearRequest}){
  const navigate=useNavigate();
  const [saved,setSaved]=useState(false);const [saving,setSaving]=useState(false);const [error,setError]=useState("");const [f,setF]=useState({name:"",city:"",can_help:"",have:"",can_share:"",useful:"",needs:"",contact:""});const fields=[["name",t.name],["city",t.city],["can_help",t.can],["have",t.have],["can_share",t.share],["useful",t.useful],["needs",t.need],["contact",t.contact]];
  async function submit(e){e.preventDefault();if(saving)return;setError("");setSaved(false);if(!supabase){setError(t.supabaseMissing);return}setSaving(true);const payload={slug:`${f.name.toLowerCase().replace(/[^a-zа-яіїє0-9]+/gi,"-")}-${Date.now().toString().slice(-5)}`,name:f.name,city:f.city,headline:f.useful||f.can_help||"Можливість",can_help:[f.can_help,f.have,f.useful].filter(Boolean).join(". "),can_share:f.can_share,needs:f.needs,contact:f.contact};const r=await supabase.from("profiles").insert(payload);setSaving(false);if(r.error){setError(r.error.message);return}setSaved(true)}
  function newRequest(){clearRequest();navigate("/",{state:{focusQuery:true}})}
  return <main className="page"><PageNavigation title={t.profile} t={t} showForward onNewRequest={newRequest}/><section className="profileShell"><span className="kicker">ATLAS</span><h1>{t.profile}</h1><form className="profileForm" onSubmit={submit}>{fields.map(([n,l],i)=><label key={n}><span>{l}</span>{i<2||n==="contact"?<input disabled={saving} required={n==="name"||n==="contact"} value={f[n]} onChange={e=>setF({...f,[n]:e.target.value})}/>:<textarea disabled={saving} value={f[n]} onChange={e=>setF({...f,[n]:e.target.value})}/>}</label>)}{error&&<div className="error">{error}</div>}{saved&&<div className="success">{t.saved}</div>}<button className="primary" disabled={saving}>{saving?t.saving:t.save}</button></form></section></main>;
}
