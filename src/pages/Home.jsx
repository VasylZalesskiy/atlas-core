import {useState} from "react";
import {Link,useNavigate} from "react-router-dom";
import {MapPin,Search} from "lucide-react";

export default function Home({t}){const [task,setTask]=useState("");const [where,setWhere]=useState("");const nav=useNavigate();function go(e){e.preventDefault();if(task.trim())nav("/solution",{state:{task,where}})}return <main className="home"><section className="hero"><h1>{t.h1}<span>{t.h2}</span></h1><form className="searchbox" onSubmit={go}><label>{t.task}</label><textarea value={task} onChange={e=>setTask(e.target.value)} placeholder={t.taskPh}/><label>{t.where}</label><div className="location"><MapPin size={20}/><input value={where} onChange={e=>setWhere(e.target.value)} placeholder={t.wherePh}/></div><button className="primary"><Search size={20}/>{t.build}</button></form><Link className="profileLink" to="/profile">{t.create}</Link><p className="principle">{t.principle}</p></section></main>}
