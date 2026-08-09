import {useEffect,useState} from "react";
import {Link,useNavigate} from "react-router-dom";
import {FileText,MapPin,MessageSquare,PlusCircle,Search} from "lucide-react";
import ThinkingState from "../components/ThinkingState";
import {saveAtlasFeedback} from "../services/feedbackStore";

const examples={
  uk:["Болить живіт","Потрібен генератор","Хочу продати овочі","Пробило колесо"],
  en:["I have stomach pain","I need a generator","I want to sell vegetables","I have a flat tire"]
};

export default function Home({t,lang}){
  const [task,setTask]=useState("");
  const [where,setWhere]=useState("");
  const [thinking,setThinking]=useState(false);
  const [activeStep,setActiveStep]=useState(0);
  const [feedback,setFeedback]=useState("");
  const [feedbackBusy,setFeedbackBusy]=useState(false);
  const [feedbackStatus,setFeedbackStatus]=useState("");
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

  async function sendFeedback(e){
    e.preventDefault();
    if(feedbackBusy||feedback.trim().length<2)return;
    setFeedbackBusy(true);
    setFeedbackStatus("");
    try{
      await saveAtlasFeedback(feedback,lang);
      setFeedback("");
      setFeedbackStatus(lang==="uk"?"✓ Дякуємо. Відгук збережено.":"✓ Thank you. Your feedback was saved.");
    }catch(error){
      const text=String(error?.message||error||"");
      setFeedbackStatus(/atlas_feedback|relation .*does not exist/i.test(text)
        ?(lang==="uk"?"Поле відгуків ще активується в тестовій базі.":"Feedback storage is still being activated in the test database.")
        :(lang==="uk"?"Не вдалося надіслати відгук. Спробуйте ще раз.":"Could not send feedback. Please try again."));
    }finally{
      setFeedbackBusy(false);
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
  const aboutUrl=lang==="uk"?"/atlas-about-uk.txt":"/atlas-about-en.txt";

  return <main className="home">
    <section className="hero" style={{paddingTop:40}}>
      <div style={{display:"inline-flex",alignItems:"center",gap:7,marginBottom:10,padding:"6px 10px",borderRadius:999,background:"#fff7df",border:"1px solid #ead79b",color:"#765f20",fontSize:11,fontWeight:900,letterSpacing:".08em"}}>
        ATLAS · {lang==="uk"?"ТЕСТОВА ВЕРСІЯ":"TEST VERSION"}
      </div>

      <div style={{marginBottom:18}}>
        <a href={aboutUrl} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:7,color:"#0d7a41",fontSize:13,fontWeight:800,textDecoration:"underline",textUnderlineOffset:3}}>
          <FileText size={16}/>
          {lang==="uk"?"Вперше тут? Прочитайте за 1 хвилину, що робить Atlas →":"New here? Read in 1 minute what Atlas does →"}
        </a>
      </div>

      <h1 style={{fontSize:"clamp(32px,4vw,48px)",lineHeight:1.08,letterSpacing:"-.035em",marginBottom:28}}>
        {title}
        <span style={{fontSize:"clamp(16px,1.8vw,20px)",lineHeight:1.45,letterSpacing:0,fontWeight:600,maxWidth:700,margin:"12px auto 0"}}>{subtitle}</span>
      </h1>

      <form className="searchbox" onSubmit={go} style={{padding:20}}>
        <label style={{fontSize:12}}>{lang==="uk"?"Опишіть вашу задачу":"Describe your task"}</label>
        <textarea autoFocus required value={task} onChange={e=>setTask(e.target.value)} placeholder={placeholder} style={{fontSize:16,minHeight:96}}/>

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

      <section style={{maxWidth:680,margin:"18px auto 0",padding:"18px 20px",background:"#f7faf8",border:"1px solid #dfe8e2",borderRadius:18,textAlign:"left"}}>
        <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:6}}><MessageSquare size={20} color="#0d7a41"/><h2 style={{margin:0,fontSize:17}}>{lang==="uk"?"Допоможіть покращити Atlas":"Help improve Atlas"}</h2></div>
        <p style={{margin:"0 0 12px",color:"#66746c",fontSize:13,lineHeight:1.45}}>{lang==="uk"?"Це тестова версія. Напишіть, що було незрозуміло, що не спрацювало або чого вам не вистачило.":"This is a test version. Tell us what was unclear, what did not work, or what was missing."}</p>
        <form onSubmit={sendFeedback} style={{display:"grid",gap:9}}>
          <textarea value={feedback} onChange={e=>setFeedback(e.target.value)} maxLength={2000} placeholder={lang==="uk"?"Ваш відгук…":"Your feedback…"} style={{minHeight:82,resize:"vertical",border:"1px solid #dce6df",borderRadius:12,padding:12,fontSize:14}}/>
          <button className="secondary" type="submit" disabled={feedbackBusy||feedback.trim().length<2} style={{justifyContent:"center"}}>{feedbackBusy?(lang==="uk"?"Надсилаю…":"Sending…"):(lang==="uk"?"Надіслати відгук":"Send feedback")}</button>
        </form>
        {feedbackStatus&&<div style={{marginTop:9,fontSize:12,color:feedbackStatus.startsWith("✓")?"#0d7a41":"#765f20"}}>{feedbackStatus}</div>}
      </section>

      <p className="principle" style={{fontSize:13,marginTop:26}}>{t.principle}</p>
    </section>
  </main>;
}
