import {useEffect,useMemo,useState} from "react";
import {ArrowRight,Check,CheckCircle2,Clock3,HeartHandshake,IdCard,MapPin,MessageCircle,PackageCheck,PackageSearch,RefreshCw,Search,Sparkles,X} from "lucide-react";
import {Link} from "react-router-dom";
import {loadMyPassport} from "../services/passportStore";
import {searchPassportProfiles} from "../services/passportSearch";
import {findNeedsForOpportunity} from "../services/needMatchStore";
import {cancelSolutionFlow,completeSolutionFlow,loadSolutionFlows,markSolutionProvided,offerOpportunityToNeed,respondToSolutionFlow,startOpportunityRequest} from "../services/solutionFlowStore";
import "../styles/matchSearch.css";

const needNames={tomatoes:{uk:"Томати",en:"Tomatoes"}};
const needAliases={tomatoes:["томати","томат","помідори","помідор","tomatoes","tomato"]};
const flowSteps={
  uk:["Збіг","Запит","Домовились","Виконано","Завершено"],
  en:["Match","Request","Agreed","Done","Closed"]
};

function normalize(value){return String(value||"").toLowerCase().trim()}
function needLabel(item,uk){
  const name=needNames[item?.item_key]?.[uk?"uk":"en"]||item?.item_key||(uk?"Потреба":"Need");
  return `${name}${item?.quantity?` · ${Number(item.quantity).toLocaleString(uk?"uk-UA":"en-GB")} ${item.unit||""}`:""}`;
}
function needQuery(item,uk){
  const name=needNames[item?.item_key]?.[uk?"uk":"en"]||item?.item_key||"";
  return `${name} ${item?.quantity||""} ${item?.unit||""}`.trim();
}
function formatDate(value,uk){
  if(!value)return "";
  return new Intl.DateTimeFormat(uk?"uk-UA":"en-GB",{day:"numeric",month:"short"}).format(new Date(`${value}T12:00:00`));
}
function stageFor(status){
  if(status==="completed")return 5;
  if(status==="provided")return 4;
  if(status==="accepted")return 3;
  if(status==="pending")return 2;
  return 2;
}
function flowStatus(flow,uk){
  if(flow.status==="pending")return flow.is_initiator?(uk?"Запит надіслано · очікуємо відповідь":"Request sent · awaiting response"):(uk?"Потрібна ваша відповідь":"Your response is needed");
  if(flow.status==="accepted")return uk?"Домовленість підтверджена":"Agreement confirmed";
  if(flow.status==="provided")return uk?"Можливість надано · очікуємо підтвердження отримання":"Provided · awaiting receipt confirmation";
  if(flow.status==="completed")return uk?"Рішення завершено":"Solution completed";
  if(flow.status==="declined")return uk?"Пропозицію відхилено":"Proposal declined";
  if(flow.status==="cancelled")return uk?"Рішення скасовано":"Solution cancelled";
  return flow.status;
}

export default function MatchSearch({lang="uk"}){
  const uk=lang!=="en";
  const [loading,setLoading]=useState(true);
  const [searching,setSearching]=useState(false);
  const [mode,setMode]=useState("need");
  const [passport,setPassport]=useState(null);
  const [needs,setNeeds]=useState([]);
  const [opportunities,setOpportunities]=useState([]);
  const [query,setQuery]=useState("");
  const [selectedNeedId,setSelectedNeedId]=useState("");
  const [selectedOpportunityId,setSelectedOpportunityId]=useState("");
  const [results,setResults]=useState([]);
  const [flows,setFlows]=useState([]);
  const [flowBusy,setFlowBusy]=useState("");
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [searched,setSearched]=useState(false);

  const activeNeeds=useMemo(()=>{
    const today=new Date().toISOString().slice(0,10);
    return needs.filter(item=>item.status==="not_received"&&(!item.needed_until||item.needed_until>=today));
  },[needs]);
  const activeOpportunities=useMemo(()=>opportunities.filter(item=>item.is_active),[opportunities]);
  const activeFlows=useMemo(()=>flows.filter(item=>!["completed","declined","cancelled"].includes(item.status)),[flows]);
  const closedFlows=useMemo(()=>flows.filter(item=>["completed","declined","cancelled"].includes(item.status)).slice(0,5),[flows]);

  async function reloadFlows(){
    const list=await loadSolutionFlows();
    setFlows(list);
    return list;
  }

  async function reloadPassport(){
    const data=await loadMyPassport();
    setPassport(data.passport||null);setNeeds(data.needs||[]);setOpportunities(data.opportunities||[]);
    return data;
  }

  useEffect(()=>{
    let alive=true;
    Promise.all([loadMyPassport(),loadSolutionFlows()]).then(([data,flowList])=>{
      if(!alive)return;
      setPassport(data.passport||null);setNeeds(data.needs||[]);setOpportunities(data.opportunities||[]);setFlows(flowList||[]);
      const firstNeed=(data.needs||[]).find(item=>item.status==="not_received");
      const firstOpportunity=(data.opportunities||[]).find(item=>item.is_active);
      if(firstNeed){setSelectedNeedId(firstNeed.id);setQuery(needQuery(firstNeed,uk))}
      if(firstOpportunity)setSelectedOpportunityId(firstOpportunity.id);
    }).catch(cause=>{if(alive)setError(String(cause?.message||cause||"Помилка"))}).finally(()=>{if(alive)setLoading(false)});
    return()=>{alive=false};
  },[uk]);

  function chooseMode(next){setMode(next);setResults([]);setSearched(false);setError("");setNotice("")}
  function chooseNeed(id){setSelectedNeedId(id);const item=activeNeeds.find(value=>value.id===id);if(item)setQuery(needQuery(item,uk))}

  async function searchOpportunities(event){
    event?.preventDefault();
    const clean=query.trim();
    if(!clean||searching)return;
    setSearching(true);setError("");setNotice("");setSearched(true);
    try{
      const selectedNeed=activeNeeds.find(item=>item.id===selectedNeedId);
      const aliases=selectedNeed?needAliases[selectedNeed.item_key]||[]:[];
      const terms=[clean,...clean.split(/\s+/),...aliases].map(normalize).filter(value=>value.length>2);
      const plan={goal:clean,passport_search:{terms:[...new Set(terms)],capability_description:uk?`має або може надати ${clean}`:`has or can provide ${clean}`}};
      const {matches,error:searchError}=await searchPassportProfiles(plan,{limit:20});
      if(searchError&&searchError!=="production-passports-not-initialized")setError(searchError);
      setResults((matches||[]).filter(item=>item.slug&&item.slug!==passport?.slug));
    }catch(cause){setError(String(cause?.message||cause||"match-search-failed"));setResults([])}finally{setSearching(false)}
  }

  async function searchNeeds(){
    if(!selectedOpportunityId||searching)return;
    setSearching(true);setError("");setNotice("");setSearched(true);
    try{
      const result=await findNeedsForOpportunity(selectedOpportunityId);
      if(result.error)setError(result.error);
      setResults(result.matches||[]);
    }catch(cause){setError(String(cause?.message||cause||"match-search-failed"));setResults([])}finally{setSearching(false)}
  }

  async function startRequest(item){
    if(!item.opportunity_id||flowBusy)return;
    setFlowBusy(item.opportunity_id);setError("");setNotice("");
    try{
      const selectedNeed=activeNeeds.find(value=>value.id===selectedNeedId);
      const needText=selectedNeed?needQuery(selectedNeed,uk):query.trim();
      const result=await startOpportunityRequest({opportunityId:item.opportunity_id,needId:selectedNeedId||null,message:uk?`Atlas знайшов збіг. Мені потрібно: ${needText}. Хочу почати вирішення.`:`Atlas found a match. I need: ${needText}. I want to start solving it.`});
      await reloadFlows();
      setNotice(result.duplicate?(uk?"Цей збіг уже в активному вирішенні.":"This match is already being solved."):(uk?"✓ Рішення запущено. Тепер Atlas веде його до завершення.":"✓ Solution started. Atlas will now guide it to completion."));
    }catch(cause){setError(String(cause?.message||cause||"solution-start-failed"))}finally{setFlowBusy("")}
  }

  async function sendOffer(item){
    if(!selectedOpportunityId||flowBusy)return;
    setFlowBusy(item.need_id);setError("");setNotice("");
    try{
      const result=await offerOpportunityToNeed({opportunityId:selectedOpportunityId,needId:item.need_id});
      await reloadFlows();
      setNotice(result.duplicate?(uk?"Ця пропозиція вже активна.":"This offer is already active."):(uk?"✓ Пропозицію допомоги надіслано. Atlas чекатиме відповідь власника потреби.":"✓ Help offer sent. Atlas will wait for the need owner's response."));
    }catch(cause){setError(String(cause?.message||cause||"offer-failed"))}finally{setFlowBusy("")}
  }

  async function flowAction(flow,action){
    if(flowBusy)return;
    setFlowBusy(flow.id);setError("");setNotice("");
    try{
      if(action==="accept")await respondToSolutionFlow(flow.id,"accepted");
      if(action==="decline")await respondToSolutionFlow(flow.id,"declined");
      if(action==="provided")await markSolutionProvided(flow.id);
      if(action==="complete")await completeSolutionFlow(flow.id);
      if(action==="cancel")await cancelSolutionFlow(flow.id);
      await Promise.all([reloadFlows(),reloadPassport()]);
      const messages={accept:uk?"✓ Домовленість підтверджено. Відкрито кімнату для узгодження.":"✓ Agreement confirmed. A room is open for coordination.",decline:uk?"Пропозицію відхилено.":"Proposal declined.",provided:uk?"✓ Позначено як надано. Чекаємо підтвердження отримання.":"✓ Marked as provided. Waiting for receipt confirmation.",complete:uk?"✓ Рішення завершено. Потребу закрито.":"✓ Solution completed. The need is closed.",cancel:uk?"Рішення скасовано.":"Solution cancelled."};
      setNotice(messages[action]||"");
    }catch(cause){setError(String(cause?.message||cause||"solution-flow-failed"))}finally{setFlowBusy("")}
  }

  if(loading)return <main className="page appPage matchPage"><section className="matchShell"><div className="matchLoading"><RefreshCw size={22}/>{uk?"Готую Atlas Match…":"Preparing Atlas Match…"}</div></section></main>;

  return <main className="page appPage matchPage"><section className="matchShell">
    <div className="matchHero"><span className="kicker">ATLAS MATCH</span><h1>{uk?"Збіг → готове рішення":"Match → completed solution"}</h1><p>{uk?"Atlas не зупиняється на збігу. Він веде обох людей від першого контакту до підтвердження, що задача реально завершена.":"Atlas does not stop at a match. It guides both people from first contact to confirmation that the task is actually complete."}</p></div>

    <section className="solutionFlows">
      <div className="matchResultsTitle"><div><CheckCircle2 size={20}/><strong>{uk?"Активні рішення":"Active solutions"}</strong></div><span>{activeFlows.length}</span></div>
      {activeFlows.length===0&&<div className="matchBlank">{uk?"Поки немає активних рішень. Знайдіть збіг нижче і натисніть «Почати вирішення».":"No active solutions yet. Find a match below and choose “Start solving”."}</div>}
      {activeFlows.map(flow=>{
        const stage=stageFor(flow.status);
        const steps=flowSteps[uk?"uk":"en"];
        const title=flow.opportunity?.text||(uk?"Можливість Atlas":"Atlas opportunity");
        const needText=flow.need?needLabel(flow.need,uk):"";
        const counterpart=flow.role==="provider"?flow.need_passport:flow.provider_passport;
        const closed=["declined","cancelled"].includes(flow.status);
        return <article className={`solutionFlowCard ${closed?"flowClosed":""}`} key={flow.id}>
          <div className="solutionFlowTop"><div><span className="matchFoundBadge">{flow.role==="provider"?(uk?"Я НАДАЮ":"I PROVIDE"):(uk?"МОЯ ПОТРЕБА":"MY NEED")}</span><strong>{title}</strong>{needText&&<small>{uk?"Потреба":"Need"}: {needText}</small>}{counterpart?.display_name&&<small><MapPin size={13}/>{counterpart.city||"Atlas"} · {counterpart.display_name}</small>}</div><b className={`flowStatus flow-${flow.status}`}>{flowStatus(flow,uk)}</b></div>
          {!closed&&<div className="flowSteps">{steps.map((label,index)=><div className={index+1<=stage?"done":""} key={label}><span>{index+1<stage?<Check size={13}/>:index+1}</span><small>{label}</small></div>)}</div>}
          <div className="flowActions">
            {flow.status==="pending"&&!flow.is_initiator&&<><button className="matchAction actionButton" disabled={flowBusy===flow.id} onClick={()=>flowAction(flow,"accept")}><CheckCircle2 size={16}/>{uk?"Прийняти":"Accept"}</button><button className="matchAction secondaryAction actionButton" disabled={flowBusy===flow.id} onClick={()=>flowAction(flow,"decline")}><X size={16}/>{uk?"Відхилити":"Decline"}</button></>}
            {flow.status==="pending"&&flow.is_initiator&&<button className="matchAction secondaryAction actionButton" disabled={flowBusy===flow.id} onClick={()=>flowAction(flow,"cancel")}><X size={16}/>{uk?"Скасувати":"Cancel"}</button>}
            {["accepted","provided"].includes(flow.status)&&flow.chat_hash&&<Link className="matchAction" to={`/chat${flow.chat_hash}`}><MessageCircle size={16}/>{uk?"Відкрити кімнату":"Open room"}</Link>}
            {["accepted","provided"].includes(flow.status)&&!flow.chat_hash&&flow.owner_contact&&flow.role==="need_owner"&&<span className="flowContact">{uk?"Контакт":"Contact"}: {flow.owner_contact}</span>}
            {flow.status==="accepted"&&flow.role==="provider"&&<button className="matchAction actionButton" disabled={flowBusy===flow.id} onClick={()=>flowAction(flow,"provided")}><PackageCheck size={16}/>{uk?"Я надав / виконав":"I provided / completed"}</button>}
            {["accepted","provided"].includes(flow.status)&&flow.role==="need_owner"&&<button className="matchAction actionButton" disabled={flowBusy===flow.id} onClick={()=>flowAction(flow,"complete")}><CheckCircle2 size={16}/>{uk?"Отримано · завершити":"Received · complete"}</button>}
            {["accepted","provided"].includes(flow.status)&&<button className="flowCancel" disabled={flowBusy===flow.id} onClick={()=>flowAction(flow,"cancel")}>{uk?"Скасувати рішення":"Cancel solution"}</button>}
          </div>
        </article>;
      })}
      {closedFlows.length>0&&<details className="closedFlows"><summary>{uk?"Завершені та закриті":"Completed and closed"} · {closedFlows.length}</summary><div>{closedFlows.map(flow=><article key={flow.id}><CheckCircle2 size={16}/><span><strong>{flow.opportunity?.text||(uk?"Рішення Atlas":"Atlas solution")}</strong><small>{flowStatus(flow,uk)}</small></span></article>)}</div></details>}
    </section>

    {(error||notice)&&<div className={error?"matchError":"matchNotice"} role="status">{error||notice}</div>}

    <div className="matchMode" role="tablist">
      <button type="button" className={mode==="need"?"active":""} onClick={()=>chooseMode("need")}><HeartHandshake size={20}/><span><strong>{uk?"У мене є потреба":"I have a need"}</strong><small>{uk?"Знайти можливості":"Find opportunities"}</small></span></button>
      <button type="button" className={mode==="opportunity"?"active":""} onClick={()=>chooseMode("opportunity")}><IdCard size={20}/><span><strong>{uk?"У мене є можливість":"I have an opportunity"}</strong><small>{uk?"Знайти потреби":"Find needs"}</small></span></button>
    </div>

    {mode==="need"?<form className="manualMatchBox" onSubmit={searchOpportunities}>
      <div className="manualMatchTitle"><Search size={20}/><div><strong>{uk?"Що шукаємо?":"What are we looking for?"}</strong><small>{uk?"Оберіть свою потребу або напишіть запит вручну.":"Choose your need or type a request manually."}</small></div></div>
      {activeNeeds.length>0&&<label><span>{uk?"Моя активна потреба":"My active need"}</span><select value={selectedNeedId} onChange={event=>chooseNeed(event.target.value)}><option value="">{uk?"Написати вручну":"Type manually"}</option>{activeNeeds.map(item=><option value={item.id} key={item.id}>{needLabel(item,uk)}</option>)}</select></label>}
      <label><span>{uk?"Пошук":"Search"}</span><input value={query} onChange={event=>{setQuery(event.target.value);setSelectedNeedId("")}} placeholder={uk?"Наприклад: потрібно 5 кг томатів":"For example: need 5 kg of tomatoes"}/></label>
      <button className="matchSearchButton" disabled={searching||!query.trim()}><Search size={19}/>{searching?(uk?"Шукаю…":"Searching…"):(uk?"Знайти можливості":"Find opportunities")}</button>
    </form>:<div className="manualMatchBox">
      <div className="manualMatchTitle"><PackageSearch size={20}/><div><strong>{uk?"Кому це потрібно?":"Who needs this?"}</strong><small>{uk?"Оберіть свою активну можливість і знайдіть актуальні потреби.":"Choose your active opportunity and find current needs."}</small></div></div>
      {activeOpportunities.length?<><label><span>{uk?"Моя можливість":"My opportunity"}</span><select value={selectedOpportunityId} onChange={event=>setSelectedOpportunityId(event.target.value)}>{activeOpportunities.map(item=><option value={item.id} key={item.id}>{item.text}</option>)}</select></label><button className="matchSearchButton" type="button" disabled={searching||!selectedOpportunityId} onClick={searchNeeds}><Search size={19}/>{searching?(uk?"Шукаю…":"Searching…"):(uk?"Знайти потреби":"Find needs")}</button></>:<div className="matchEmptyInline">{uk?"Спочатку додайте хоча б одну активну можливість у Паспорт.":"First add at least one active opportunity to your Passport."}<Link to="/profile">{uk?"Додати можливість":"Add opportunity"}<ArrowRight size={15}/></Link></div>}
    </div>}

    <section className="matchResults">
      <div className="matchResultsTitle"><div><Sparkles size={20}/><strong>{uk?"Знайдені збіги":"Found matches"}</strong></div>{searched&&!searching&&<span>{results.length}</span>}</div>
      {!searched&&!searching&&<div className="matchBlank">{uk?"Запустіть пошук — Atlas покаже актуальні збіги.":"Run a search and Atlas will show current matches."}</div>}
      {searched&&!searching&&results.length===0&&<div className="matchBlank">{uk?"Зараз збігів не знайдено. Можна змінити запит і перевірити ще раз.":"No matches found right now. Change the query and try again."}</div>}
      {mode==="need"&&results.map(item=><article className="matchResultCard" key={`${item.slug}-${item.opportunity_id||item.headline}`}>
        <div className="matchResultCopy"><span className="matchFoundBadge">{uk?"МОЖЛИВІСТЬ":"OPPORTUNITY"}</span><strong>{item.headline||item.name}</strong><small>{item.city&&<><MapPin size={13}/>{item.city}</>} {item.name&&` · ${item.name}`}</small></div>
        {item.opportunity_id?<button className="matchAction actionButton" disabled={flowBusy===item.opportunity_id} onClick={()=>startRequest(item)}>{flowBusy===item.opportunity_id?(uk?"Запускаю…":"Starting…"):(uk?"Почати вирішення":"Start solving")}<ArrowRight size={16}/></button>:<Link className="matchAction secondaryAction" to={`/p/${item.slug}`}>{uk?"Відкрити паспорт":"Open Passport"}<ArrowRight size={16}/></Link>}
      </article>)}
      {mode==="opportunity"&&results.map(item=><article className="matchResultCard" key={item.need_id}>
        <div className="matchResultCopy"><span className="matchFoundBadge needBadge">{uk?"ПОТРЕБА":"NEED"}</span><strong>{needLabel(item,uk)}</strong><small>{item.city&&<><MapPin size={13}/>{item.city}</>} {item.display_name&&` · ${item.display_name}`} {item.needed_until&&` · ${uk?"до":"until"} ${formatDate(item.needed_until,uk)}`}</small>{item.coverage==="full"&&<em>{uk?"Вашої кількості достатньо для цієї потреби":"Your available quantity can fully cover this need"}</em>}{item.coverage==="partial"&&<em>{uk?"Можливе часткове покриття потреби":"This opportunity may partially cover the need"}</em>}</div>
        <button className="matchAction actionButton" disabled={flowBusy===item.need_id} onClick={()=>sendOffer(item)}>{flowBusy===item.need_id?(uk?"Надсилаю…":"Sending…"):(uk?"Запропонувати допомогу":"Offer help")}<ArrowRight size={16}/></button>
      </article>)}
    </section>

    <div className="matchPrivacy"><Clock3 size={14}/>{uk?"Після прийняття Atlas відкриває тимчасову кімнату для домовленості. Приватні контакти не беруть участі в пошуку.":"After acceptance, Atlas opens a temporary room for coordination. Private contacts are not used in search."}</div>
  </section></main>;
}
