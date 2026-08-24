import {useEffect,useMemo,useState} from "react";
import {ArrowRight,CalendarRange,Check,Clock3,Leaf,MapPin,PackageCheck,Plus,Scale,Search,Sparkles,Trash2,X} from "lucide-react";
import {useNavigate} from "react-router-dom";
import {addMyNeed,deleteMyNeed,updateMyNeedStatus} from "../services/passportStore";
import {loadNeedCatalog} from "../services/catalogStore";
import {searchPassportProfiles} from "../services/passportSearch";
import {startOpportunityRequest} from "../services/solutionFlowStore";
import "../styles/needs.css";

const emptyNeeds=[];
const quickNeeds={
  uk:[
    {label:"Помідори",term:"помідор",icon:"🍅"},
    {label:"Картопля",term:"картопля",icon:"🥔"},
    {label:"Огірки",term:"огірок",icon:"🥒"},
    {label:"Цибуля",term:"цибуля",icon:"🧅"},
    {label:"Морква",term:"морква",icon:"🥕"},
    {label:"Капуста",term:"капуста",icon:"🥬"}
  ],
  en:[
    {label:"Tomatoes",term:"tomato",icon:"🍅"},
    {label:"Potatoes",term:"potato",icon:"🥔"},
    {label:"Cucumbers",term:"cucumber",icon:"🥒"},
    {label:"Onions",term:"onion",icon:"🧅"},
    {label:"Carrots",term:"carrot",icon:"🥕"},
    {label:"Cabbage",term:"cabbage",icon:"🥬"}
  ]
};

function isoDate(offset=0){const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()+offset);return date.toISOString().slice(0,10)}
function normalize(value){return String(value||"").toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu," ").replace(/\s+/g," ").trim()}
function stem(word){return word.length>5?word.slice(0,5):word}
function tokens(value){return normalize(value).split(" ").filter(word=>word.length>2&&!/^\d/.test(word)).map(stem)}
function formatDateRange(from,to,uk){const locale=uk?"uk-UA":"en-GB";const formatter=new Intl.DateTimeFormat(locale,{day:"numeric",month:"short",year:"numeric"});const start=from?formatter.format(new Date(`${from}T12:00:00`)):"—";const end=to?formatter.format(new Date(`${to}T12:00:00`)):"—";return `${start} — ${end}`}
function friendlyNeedError(error,uk){const text=String(error?.message||error||"");if(/atlas_needs|atlas_need_groups|atlas_need_items|relation .*atlas_need.*does not exist/i.test(text))return uk?"Сховище потреб ще не активоване в Atlas.":"Needs storage is not active in Atlas yet.";if(/date-range-invalid/i.test(text))return uk?"Дата завершення не може бути раніше дати початку.":"The end date cannot be before the start date.";if(/quantity-invalid/i.test(text))return uk?"Вкажіть правильну кількість.":"Enter a valid quantity.";return text||(uk?"Не вдалося виконати дію.":"The action could not be completed.")}

function quantityFromText(text,targetUnit){
  const match=normalize(text).match(/(\d+(?:[.,]\d+)?)\s*(кг|kg|кілограм\S*|т|тонн\S*|ton\S*|шт|штук\S*|pcs?)/iu);
  if(!match)return "";
  const value=Number(String(match[1]).replace(",","."));
  if(!Number.isFinite(value)||value<=0)return "";
  const source=String(match[2]).toLowerCase();
  if(targetUnit==="кг"&&/^(т|тон|ton)/u.test(source))return String(value*1000);
  if(targetUnit==="т"&&/^(кг|kg|кілограм)/u.test(source))return String(value/1000);
  return String(value);
}

function itemScore(item,query,uk){
  const queryTokens=tokens(query);
  if(!queryTokens.length)return 0;
  const itemText=`${item.name_uk||""} ${item.name_en||""} ${item.item_key||""}`;
  const itemTokens=new Set(tokens(itemText));
  const normalizedQuery=normalize(query);
  const primary=normalize(uk?(item.name_uk||""):(item.name_en||item.name_uk||""));
  let score=queryTokens.reduce((total,token)=>total+(itemTokens.has(token)?3:0),0);
  if(primary&&normalizedQuery.includes(primary))score+=10;
  return score;
}

export default function NeedManager({passportId,passportSlug="",passportCity="",initialNeeds=emptyNeeds,lang="uk"}){
  const uk=lang!=="en";
  const navigate=useNavigate();
  const [needs,setNeeds]=useState(()=>initialNeeds);
  const [groups,setGroups]=useState([]);
  const [catalogItems,setCatalogItems]=useState([]);
  const [catalogLoading,setCatalogLoading]=useState(true);
  const [needText,setNeedText]=useState("");
  const [showAll,setShowAll]=useState(false);
  const [form,setForm]=useState({groupKey:"",itemKey:"",unit:"кг",quantity:"",neededFrom:isoDate(),neededUntil:isoDate(7)});
  const [adding,setAdding]=useState(false);
  const [busyId,setBusyId]=useState("");
  const [matchBusy,setMatchBusy]=useState("");
  const [confirmDeleteId,setConfirmDeleteId]=useState("");
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [matchesByNeed,setMatchesByNeed]=useState({});

  const activeItems=useMemo(()=>catalogItems.filter(item=>item.is_active),[catalogItems]);
  const selectedItem=activeItems.find(item=>item.group_key===form.groupKey&&item.item_key===form.itemKey)||null;
  const catalogLookup=useMemo(()=>new Map(catalogItems.map(item=>[`${item.group_key}:${item.item_key}`,item])),[catalogItems]);
  const groupLookup=useMemo(()=>new Map(groups.map(group=>[group.group_key,group])),[groups]);
  const openCount=needs.filter(item=>item.status==="not_received").length;

  const suggestions=useMemo(()=>{
    if(!needText.trim())return showAll?activeItems.slice(0,30):[];
    return activeItems
      .map(item=>({item,score:itemScore(item,needText,uk)}))
      .filter(entry=>entry.score>0)
      .sort((a,b)=>b.score-a.score)
      .slice(0,8)
      .map(entry=>entry.item);
  },[activeItems,needText,showAll,uk]);

  useEffect(()=>{
    let alive=true;
    setCatalogLoading(true);
    loadNeedCatalog().then(catalog=>{
      if(!alive)return;
      setGroups(catalog.groups||[]);
      setCatalogItems(catalog.items||[]);
    }).catch(e=>{if(alive)setError(friendlyNeedError(e,uk))}).finally(()=>{if(alive)setCatalogLoading(false)});
    return()=>{alive=false};
  },[uk]);

  useEffect(()=>{
    let alive=true;
    if(catalogLoading)return()=>{alive=false};
    const today=isoDate();
    const activeNeeds=needs.filter(item=>item.status==="not_received"&&(!item.needed_until||item.needed_until>=today));
    if(!activeNeeds.length){setMatchesByNeed({});return()=>{alive=false}}
    setMatchesByNeed(current=>{const next={...current};activeNeeds.forEach(item=>{delete next[item.id]});return next});
    Promise.all(activeNeeds.map(async item=>{
      const catalogItem=catalogLookup.get(`${item.group_key}:${item.item_key}`);
      const itemUk=catalogItem?.name_uk||item.item_key;
      const itemEn=catalogItem?.name_en||itemUk;
      const plan={goal:`${itemUk} ${item.quantity||""} ${item.unit||""}`.trim(),passport_search:{terms:[itemUk,itemEn].map(normalize).filter(Boolean),capability_description:uk?`має ${itemUk}`:`has ${itemEn}`}};
      const {matches}=await searchPassportProfiles(plan,{limit:8});
      const filtered=(matches||[])
        .filter(match=>match.slug&&match.slug!==passportSlug&&match.opportunity_id)
        .sort((a,b)=>{const aLocal=passportCity&&normalize(a.city)===normalize(passportCity)?1:0;const bLocal=passportCity&&normalize(b.city)===normalize(passportCity)?1:0;return bLocal-aLocal||Number(b.score||0)-Number(a.score||0)})
        .slice(0,3);
      return [item.id,filtered];
    })).then(entries=>{if(alive)setMatchesByNeed(Object.fromEntries(entries))}).catch(()=>{if(alive)setMatchesByNeed({})});
    return()=>{alive=false};
  },[needs,catalogLoading,catalogLookup,passportSlug,passportCity,uk]);

  function chooseItem(option){
    if(!option?.is_active)return;
    const quantity=quantityFromText(needText,option.unit);
    setForm(value=>({...value,groupKey:option.group_key,itemKey:option.item_key,unit:option.unit,quantity:quantity||value.quantity}));
    setShowAll(false);
  }

  function onNeedTextChange(value){
    setNeedText(value);
    setNotice("");
    if(selectedItem){
      const quantity=quantityFromText(value,selectedItem.unit);
      if(quantity)setForm(current=>({...current,quantity}));
    }
  }

  function chooseQuick(option){
    setNeedText(option.term);
    setForm(value=>({...value,groupKey:"",itemKey:"",quantity:""}));
    setShowAll(false);
  }

  async function submitNeed(event){
    event.preventDefault();
    if(adding)return;
    if(!selectedItem){setError(uk?"Оберіть товар із підказок Atlas.":"Choose an item from Atlas suggestions.");return}
    if(!form.quantity){setError(uk?"Вкажіть кількість.":"Enter a quantity.");return}
    setError("");setNotice("");setAdding(true);
    try{
      const added=await addMyNeed(passportId,form);
      setNeeds(items=>[added,...items]);
      const itemName=uk?(selectedItem.name_uk||"Товар"):(selectedItem.name_en||selectedItem.name_uk||"Item");
      setNeedText("");
      setForm({groupKey:"",itemKey:"",unit:"кг",quantity:"",neededFrom:isoDate(),neededUntil:isoDate(7)});
      setNotice(uk?`✓ Потребу «${itemName}» додано. Atlas шукає людей, які можуть допомогти.`:`✓ “${itemName}” was added. Atlas is looking for people who can help.`);
    }catch(e){setError(friendlyNeedError(e,uk))}finally{setAdding(false)}
  }

  async function changeStatus(item,status){
    if(busyId)return;setBusyId(item.id);setError("");setNotice("");
    try{const updated=await updateMyNeedStatus(item.id,status);setNeeds(items=>items.map(value=>value.id===item.id?{...value,...updated}:value));setNotice(status==="received"?(uk?"✓ Позначено як отримано.":"✓ Marked as received."):(uk?"Потребу знову активовано.":"The need is active again."))}catch(e){setError(friendlyNeedError(e,uk))}finally{setBusyId("")}
  }

  async function removeNeed(id){
    if(busyId)return;setBusyId(id);setError("");setNotice("");
    try{await deleteMyNeed(id);setNeeds(items=>items.filter(item=>item.id!==id));setConfirmDeleteId("");setNotice(uk?"Потребу видалено.":"Need deleted.")}catch(e){setError(friendlyNeedError(e,uk))}finally{setBusyId("")}
  }

  async function startMatchedSolution(item,match,needTextValue){
    const key=`${item.id}-${match.opportunity_id}`;
    if(matchBusy)return;setMatchBusy(key);setError("");
    try{await startOpportunityRequest({opportunityId:match.opportunity_id,needId:item.id,message:uk?`Atlas знайшов збіг. Мені потрібно: ${needTextValue}. Хочу почати вирішення.`:`Atlas found a match. I need: ${needTextValue}. I want to start solving it.`});navigate("/matches")}catch(e){setError(friendlyNeedError(e,uk))}finally{setMatchBusy("")}
  }

  return <section className="needsWorkspace" id="passport-needs">
    <div className="needsHeading">
      <div className="needsHeadingIcon"><Leaf size={24}/></div>
      <div>
        <div className="needsEyebrow">ATLAS · {uk?"ПАСПОРТ ПОТРЕБ":"NEEDS PASSPORT"}</div>
        <h2>{uk?"Що вам потрібно?":"What do you need?"}</h2>
        <p>{uk?"Напишіть простими словами. Atlas допоможе вибрати товар і шукатиме людей, які можуть допомогти.":"Write it in simple words. Atlas will help identify the item and look for people who can help."}</p>
      </div>
      <div className="needsHeadingTools"><div className="needsPilotBadge">{uk?"Atlas Match активний":"Atlas Match active"}</div></div>
    </div>

    <form className="needComposer" onSubmit={submitNeed}>
      <div className="needStep" style={{paddingBottom:10}}>
        <div className="needStepTitle"><span>1</span><div><strong>{uk?"Напишіть потребу":"Describe your need"}</strong><small>{uk?"Наприклад: потрібно 10 кг помідорів":"For example: I need 10 kg of tomatoes"}</small></div></div>
        <div style={{position:"relative"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,border:"2px solid #b9ddc7",borderRadius:16,padding:"4px 12px",background:"#fff"}}>
            <Search size={20} color="#0b7b43"/>
            <input autoFocus value={needText} onChange={e=>onNeedTextChange(e.target.value)} placeholder={uk?"Що вам потрібно?":"What do you need?"} style={{width:"100%",border:0,outline:0,fontSize:17,padding:"13px 0",background:"transparent"}}/>
          </div>
          {catalogLoading&&<div className="needCatalogLoading">{uk?"Завантажую підказки…":"Loading suggestions…"}</div>}
          {!catalogLoading&&suggestions.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:8,marginTop:10}}>{suggestions.map(option=><button key={`${option.group_key}-${option.item_key}`} type="button" onClick={()=>chooseItem(option)} style={{display:"flex",alignItems:"center",gap:9,textAlign:"left",padding:"10px 12px",border:selectedItem?.item_key===option.item_key?"2px solid #0b8c48":"1px solid #dce7df",borderRadius:12,background:selectedItem?.item_key===option.item_key?"#edf9f1":"#fff",cursor:"pointer"}}><span style={{fontSize:22}}>{option.icon||"📦"}</span><span><strong style={{display:"block",fontSize:14}}>{uk?option.name_uk:(option.name_en||option.name_uk)}</strong><small style={{color:"#6c786f"}}>{option.unit}</small></span>{selectedItem?.item_key===option.item_key&&<Check size={16} color="#0b8c48" style={{marginLeft:"auto"}}/>}</button>)}</div>}
        </div>
        <div style={{display:"flex",gap:7,flexWrap:"wrap",marginTop:12}}>{quickNeeds[uk?"uk":"en"].map(option=><button key={option.term} type="button" onClick={()=>chooseQuick(option)} style={{border:"1px solid #d8e5dc",background:"#f8fbf9",borderRadius:999,padding:"8px 11px",fontWeight:800,fontSize:12,cursor:"pointer"}}>{option.icon} {option.label}</button>)}<button type="button" onClick={()=>setShowAll(value=>!value)} style={{border:"1px dashed #aacbb6",background:"#fff",borderRadius:999,padding:"8px 11px",fontWeight:800,fontSize:12,color:"#0b7b43",cursor:"pointer"}}>{showAll?(uk?"Сховати":"Hide"):(uk?"Ще товари…":"More items…")}</button></div>
        {selectedItem&&<div style={{display:"flex",alignItems:"center",gap:8,marginTop:12,padding:"10px 12px",borderRadius:12,background:"#eaf8ef",color:"#155c35"}}><Check size={18}/><span>{uk?"Atlas зрозумів:":"Atlas understood:"} <strong>{selectedItem.icon} {uk?selectedItem.name_uk:(selectedItem.name_en||selectedItem.name_uk)}</strong></span></div>}
      </div>

      <div className="needStep">
        <div className="needStepTitle"><span>2</span><div><strong>{uk?"Скільки і до коли?":"How much and by when?"}</strong><small>{uk?"Цього достатньо для створення потреби":"That is enough to create the need"}</small></div></div>
        <div className="needDetailsGrid" style={{gridTemplateColumns:"minmax(170px,1fr) minmax(190px,1fr)"}}>
          <label className="needQuantityLabel"><span><Scale size={16}/>{uk?"Кількість":"Quantity"}</span><div><input type="number" min="0.1" max="1000000" step="0.1" inputMode="decimal" required value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} placeholder="0"/><b>{selectedItem?.unit||form.unit}</b></div></label>
          <label><span><CalendarRange size={16}/>{uk?"Потрібно до":"Needed by"}</span><input type="date" required min={form.neededFrom} value={form.neededUntil} onChange={e=>setForm({...form,neededUntil:e.target.value})}/></label>
        </div>
      </div>

      <div className="needComposerFooter">
        <div><Clock3 size={17}/><span>{uk?"До цієї дати Atlas вважатиме потребу актуальною.":"Atlas will keep the need active until this date."}</span></div>
        <button className="needAddButton" disabled={adding||!form.quantity||!selectedItem}><Plus size={19}/>{adding?(uk?"Додаю…":"Adding…"):(uk?"Додати потребу":"Add need")}</button>
      </div>
    </form>

    {(error||notice)&&<div className={`needMessage ${error?"errorState":"successState"}`} role="status" aria-live="polite">{error||notice}</div>}

    <div className="needsListHeading"><div><h3>{uk?"Мої активні потреби":"My active needs"}</h3><p>{uk?"Atlas автоматично звіряє їх із Паспортами можливостей інших людей.":"Atlas automatically matches them with other people's Opportunity Passports."}</p></div><span>{openCount} {uk?"не отримано":"not received"}</span></div>

    <div className="needsList">
      {needs.length===0&&<div className="needsEmpty"><Leaf size={24}/><strong>{uk?"Потреб ще немає":"No needs yet"}</strong><span>{uk?"Напишіть першу потребу вище — це займає кілька секунд.":"Add your first need above — it only takes a few seconds."}</span></div>}
      {needs.map(item=>{
        const received=item.status==="received";
        const deleting=confirmDeleteId===item.id;
        const catalogItem=catalogLookup.get(`${item.group_key}:${item.item_key}`);
        const catalogGroup=groupLookup.get(item.group_key);
        const itemName=uk?(catalogItem?.name_uk||item.item_key):(catalogItem?.name_en||catalogItem?.name_uk||item.item_key);
        const groupName=uk?(catalogGroup?.name_uk||item.group_key):(catalogGroup?.name_en||catalogGroup?.name_uk||item.group_key);
        const matches=matchesByNeed[item.id];
        const needTextValue=`${Number(item.quantity).toLocaleString(uk?"uk-UA":"en-GB")} ${item.unit} ${itemName}`;
        return <article className={`needRecord ${received?"received":""}`} key={item.id}>
          <div className="needRecordProduct"><span aria-hidden="true">{catalogItem?.icon||"📦"}</span><div><small>{groupName.toLocaleUpperCase(uk?"uk-UA":"en-GB")}</small><h4>{itemName}</h4></div></div>
          <div className="needRecordMeta"><div><Scale size={16}/><span><small>{uk?"Кількість":"Quantity"}</small><strong>{Number(item.quantity).toLocaleString(uk?"uk-UA":"en-GB")} {item.unit}</strong></span></div><div><CalendarRange size={16}/><span><small>{uk?"Актуальність":"Validity"}</small><strong>{formatDateRange(item.needed_from,item.needed_until,uk)}</strong></span></div></div>

          {!received&&<div style={{gridColumn:"1/-1",marginTop:4,padding:matches?.length?18:14,border:matches?.length?"2px solid #58b87a":"1px solid #cfe4d7",borderRadius:16,background:matches?.length?"#eaf8ef":"#f8faf9"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,color:"#08753f",fontWeight:900,fontSize:13}}><Sparkles size={17}/>{matches?.length?(uk?"ATLAS ЗНАЙШОВ ЛЮДЕЙ, ЯКІ МОЖУТЬ ДОПОМОГТИ":"ATLAS FOUND PEOPLE WHO MAY HELP"):(uk?"ATLAS MATCH":"ATLAS MATCH")}</div>
            {matches===undefined?<div style={{marginTop:7,color:"#66746c",fontSize:13}}>{uk?"Перевіряю Паспорти можливостей…":"Checking Opportunity Passports…"}</div>:matches.length===0?<div style={{marginTop:7,color:"#66746c",fontSize:13}}>{uk?"Поки відповідних можливостей людей не знайдено. Потреба залишається активною.":"No matching people yet. The need remains active."}</div>:<div style={{display:"grid",gap:8,marginTop:12}}>{matches.map(match=>{const key=`${item.id}-${match.opportunity_id}`;return <div key={`${item.id}-${match.slug}`} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,alignItems:"center",padding:"12px 13px",border:"1px solid #cce5d5",borderRadius:13,background:"#fff"}}><div style={{minWidth:0}}><strong style={{display:"block",fontSize:15,color:"#173526",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{match.headline||match.name}</strong><span style={{display:"flex",alignItems:"center",gap:5,marginTop:4,color:"#68766e",fontSize:12}}>{match.city&&<><MapPin size={13}/>{match.city}</>} {match.name&&` · ${match.name}`}</span></div><button type="button" disabled={matchBusy===key} onClick={()=>startMatchedSolution(item,match,needTextValue)} style={{display:"flex",alignItems:"center",gap:5,color:"#fff",background:"#0b8c48",border:0,borderRadius:10,padding:"9px 11px",fontSize:12,fontWeight:900,cursor:"pointer",opacity:matchBusy===key?0.65:1}}>{matchBusy===key?(uk?"З'єдную…":"Connecting…"):(uk?"Зв'язатися":"Connect")}<ArrowRight size={14}/></button></div>})}</div>}
          </div>}

          <div className="needRecordActions">
            <div className="needStatus" role="group" aria-label={uk?"Статус потреби":"Need status"}><button type="button" className={!received?"active":""} disabled={busyId===item.id} onClick={()=>changeStatus(item,"not_received")}><Clock3 size={15}/>{uk?"Не отримано":"Not received"}</button><button type="button" className={received?"active receivedActive":""} disabled={busyId===item.id} onClick={()=>changeStatus(item,"received")}><PackageCheck size={15}/>{uk?"Отримано":"Received"}</button></div>
            {deleting?<div className="needDeleteConfirm"><span>{uk?"Точно видалити?":"Delete it?"}</span><button type="button" disabled={busyId===item.id} onClick={()=>removeNeed(item.id)}><Check size={16}/>{uk?"Так":"Yes"}</button><button type="button" onClick={()=>setConfirmDeleteId("")}><X size={16}/></button></div>:<button className="needDeleteButton" type="button" title={uk?"Видалити потребу":"Delete need"} onClick={()=>setConfirmDeleteId(item.id)}><Trash2 size={18}/></button>}
          </div>
        </article>;
      })}
    </div>
  </section>;
}
