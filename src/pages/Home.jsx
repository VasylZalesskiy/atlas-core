import {useEffect,useState} from "react";
import {Link,useNavigate} from "react-router-dom";
import {MapPin,PlusCircle,Search} from "lucide-react";
import ThinkingState from "../components/ThinkingState";

const examples={
  uk:["Болить живіт","Потрібен генератор","Хочу продати овочі","Пробило колесо"],
  en:["I have stomach pain","I need a generator","I want to sell vegetables","I have a flat tire"]
};

export default function Home({t,lang}){
  const [task,setTask]=useState("");
  const [where,setWhere]=useState("");
  const [thinking,setThinking]=useState(false);
  const [activeStep,setActiveStep]=useState(0);
  const nav=useNavigate();

  useEffect(()=>{
    if(!thinking)return;
    const timer=setInterval(()=>setActiveStep(step=>Math.min(step+1,t.thinkingSteps.length-1)),480);
    const done=setTimeout(()=>nav("/solution",{state:{task,where}}),2500);
    return()=>{clearInterval(timer);clearTimeout(done)};
  },[thinking,nav,task,where,t.thinkingSteps.length]);

  function go(e){
    e.preventDefault();
    if(task.trim()){
      setActiveStep(0);
      setThinking(true);
    }
  }

  if(thinking)return <ThinkingState steps={t.thinkingSteps} activeStep={activeStep}/>;

  const title=lang==="uk"?"Що вам потрібно?":"What do you need?";
  const subtitle=lang==="uk"
    ?"Напишіть задачу простими словами. Atlas спробує знайти найкоротший шлях до рішення."
    :"Describe the task in simple words. Atlas will try to find the shortest path to a solution.";
  const placeholder=lang==="uk"
    ?"Наприклад: потрібен генератор на сьогодні"
    :"For example: I need a generator today";
  const locationLabel=lang==="uk"?"Де це потрібно? (необов'язково)":"Where is it needed? (optional)";
  const capabilityTitle=lang==="uk"?"А що можете ви?":"What can you offer?";
  const capabilityText=lang==="uk"
    ?"Додайте те, що маєте, вмієте, можете позичити, продати, подарувати або зробити безкоштовно."
    :"Add what you have, can do, lend, sell, give away, or help with for free.";
  const capabilityButton=lang==="uk"?"+ Додати можливість":"+ Add an opportunity";

  return <main className="home">
    <section className="hero" style={{paddingTop:58}}>
      <h1 style={{fontSize:"clamp(32px,4vw,48px)",lineHeight:1.08,letterSpacing:"-.035em",marginBottom:28}}>
        {title}
        <span style={{fontSize:"clamp(16px,1.8vw,20px)",lineHeight:1.45,letterSpacing:0,fontWeight:600,maxWidth:700,margin:"12px auto 0"}}>{subtitle}</span>
      </h1>

      <form className="searchbox" onSubmit={go} style={{padding:20}}>
        <label style={{fontSize:12}}>{lang==="uk"?"Опишіть вашу задачу":"Describe your task"}</label>
        <textarea
          autoFocus
          required
          value={task}
          onChange={e=>setTask(e.target.value)}
          placeholder={placeholder}
          style={{fontSize:16,minHeight:96}}
        />

        <label style={{fontSize:12}}>{locationLabel}</label>
        <div className="location">
          <MapPin size={18}/>
          <input value={where} onChange={e=>setWhere(e.target.value)} placeholder={t.wherePh} style={{fontSize:14}}/>
        </div>

        <button className="primary" type="submit" style={{fontSize:14,padding:"13px 18px"}}><Search size={18}/>{t.build}</button>
      </form>

      <div className="examples" style={{fontSize:12,marginTop:16}}>
        <span>{t.examples}:</span>
        {examples[lang].map(example=><button key={example} type="button" onClick={()=>setTask(example)} style={{fontSize:12,padding:"7px 10px"}}>{example}</button>)}
      </div>

      <section style={{maxWidth:680,margin:"28px auto 0",padding:"18px 20px",background:"#fff",border:"1px solid #dfe8e2",borderRadius:18,textAlign:"left"}}>
        <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
          <PlusCircle size={24} color="#0d7a41" style={{flex:"0 0 auto"}}/>
          <div style={{flex:1}}>
            <h2 style={{margin:"0 0 5px",fontSize:18}}>{capabilityTitle}</h2>
            <p style={{margin:"0 0 13px",color:"#66746c",lineHeight:1.5,fontSize:14}}>{capabilityText}</p>
            <Link className="primary" style={{display:"inline-flex",padding:"10px 15px",fontSize:13}} to="/profile">{capabilityButton}</Link>
          </div>
        </div>
      </section>

      <p className="principle" style={{fontSize:13,marginTop:30}}>{t.principle}</p>
    </section>
  </main>;
}
