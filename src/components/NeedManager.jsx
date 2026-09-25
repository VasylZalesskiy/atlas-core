import {useEffect,useMemo,useState} from "react";
import {CalendarRange,Check,Clock3,HeartHandshake,PackageCheck,Plus,Scale,Trash2,X} from "lucide-react";
import {addMyNeed,deleteMyNeed,updateMyNeedStatus} from "../services/passportStore";
import {loadNeedCatalog} from "../services/catalogStore";
import "../styles/needs.css";

const emptyNeeds=[];

function isoDate(offset=0){
  const date=new Date();
  date.setHours(12,0,0,0);
  date.setDate(date.getDate()+offset);
  return date.toISOString().slice(0,10);
}

function formatDateRange(from,to,uk){
  const locale=uk?"uk-UA":"en-GB";
  const formatter=new Intl.DateTimeFormat(locale,{day:"numeric",month:"short",year:"numeric"});
  const start=from?formatter.format(new Date(from+"T12:00:00")):"—";
  const end=to?formatter.format(new Date(to+"T12:00:00")):"—";
  return start+" — "+end;
}

function friendlyNeedError(error,uk){
  const text=String(error?.message||error||"");
  if(/atlas_needs|atlas_need_groups|atlas_need_items|relation .*atlas_need.*does not exist/i.test(text))return uk?"Сховище потреб ще не активоване в Atlas.":"Needs storage is not active in Atlas yet.";
  if(/date-range-invalid/i.test(text))return uk?"Дата завершення не може бути раніше дати початку.":"The end date cannot be before the start date.";
  if(/quantity-invalid/i.test(text))return uk?"Вкажіть правильну кількість.":"Enter a valid quantity.";
  if(/catalog-item-required/i.test(text))return uk?"Оберіть потребу зі списку Atlas.":"Choose a need from the Atlas list.";
  return text||(uk?"Не вдалося виконати дію.":"The action could not be completed.");
}

export default function NeedManager({passportId,initialNeeds=emptyNeeds,lang="uk"}){
  const uk=lang!=="en";
  const [needs,setNeeds]=useState(()=>initialNeeds);
  const [groups,setGroups]=useState([]);
  const [catalogItems,setCatalogItems]=useState([]);
  const [catalogLoading,setCatalogLoading]=useState(true);
  const [form,setForm]=useState({groupKey:"",itemKey:"",unit:"кг",quantity:"",neededFrom:isoDate(),neededUntil:isoDate(7)});
  const [adding,setAdding]=useState(false);
  const [busyId,setBusyId]=useState("");
  const [confirmDeleteId,setConfirmDeleteId]=useState("");
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [showArchive,setShowArchive]=useState(false);

  const activeGroups=useMemo(()=>groups.filter(group=>group.is_active!==false),[groups]);
  const activeItems=useMemo(()=>{
    const activeGroupKeys=new Set(activeGroups.map(group=>group.group_key));
    return catalogItems.filter(item=>item.is_active&&activeGroupKeys.has(item.group_key));
  },[catalogItems,activeGroups]);
  const itemsForGroup=useMemo(()=>activeItems.filter(item=>item.group_key===form.groupKey),[activeItems,form.groupKey]);
  const selectedItem=itemsForGroup.find(item=>item.item_key===form.itemKey)||null;
  const catalogLookup=useMemo(()=>new Map(catalogItems.map(item=>[item.group_key+":"+item.item_key,item])),[catalogItems]);
  const groupLookup=useMemo(()=>new Map(groups.map(group=>[group.group_key,group])),[groups]);
  const openCount=needs.filter(item=>item.status==="not_received").length;
  const archivedCount=needs.length-openCount;
  const visibleNeeds=needs.filter(item=>(item.status==="received")===showArchive);

  useEffect(()=>{
    let alive=true;
    setCatalogLoading(true);
    loadNeedCatalog().then(catalog=>{
      if(!alive)return;
      const nextGroups=catalog.groups||[];
      const nextItems=catalog.items||[];
      setGroups(nextGroups);
      setCatalogItems(nextItems);
      const firstGroup=nextGroups.find(group=>group.is_active!==false);
      if(firstGroup)setForm(value=>value.groupKey?value:{...value,groupKey:firstGroup.group_key});
    }).catch(cause=>{if(alive)setError(friendlyNeedError(cause,uk))}).finally(()=>{if(alive)setCatalogLoading(false)});
    return()=>{alive=false};
  },[uk]);

  function changeGroup(groupKey){
    setForm(value=>({...value,groupKey,itemKey:"",unit:"кг"}));
    setError("");
    setNotice("");
  }

  function changeItem(itemKey){
    const item=activeItems.find(candidate=>candidate.group_key===form.groupKey&&candidate.item_key===itemKey);
    setForm(value=>({...value,itemKey,unit:item?.unit||"шт"}));
    setError("");
    setNotice("");
  }

  async function submitNeed(event){
    event.preventDefault();
    if(adding)return;
    if(!selectedItem){setError(uk?"Оберіть потребу зі списку Atlas.":"Choose a need from the Atlas list.");return}
    if(!form.quantity){setError(uk?"Вкажіть кількість.":"Enter a quantity.");return}
    setAdding(true);setError("");setNotice("");
    try{
      const added=await addMyNeed(passportId,form);
      setNeeds(items=>[added,...items]);
      const itemName=uk?(selectedItem.name_uk||selectedItem.item_key):(selectedItem.name_en||selectedItem.name_uk||selectedItem.item_key);
      setForm(value=>({...value,itemKey:"",unit:"кг",quantity:"",neededFrom:isoDate(),neededUntil:isoDate(7)}));
      setNotice(uk?"✓ Потребу «"+itemName+"» збережено в Atlas.":"✓ “"+itemName+"” was saved in Atlas.");
    }catch(cause){setError(friendlyNeedError(cause,uk))}finally{setAdding(false)}
  }

  async function changeStatus(item,status){
    if(busyId)return;
    setBusyId(item.id);setError("");setNotice("");
    try{
      const updated=await updateMyNeedStatus(item.id,status);
      setNeeds(items=>items.map(value=>value.id===item.id?{...value,...updated}:value));
      setNotice(status==="received"?(uk?"✓ Потребу отримано й перенесено в архів.":"✓ Need received and archived."):(uk?"Потребу знову активовано.":"The need is active again."));
    }catch(cause){setError(friendlyNeedError(cause,uk))}finally{setBusyId("")}
  }

  async function removeNeed(id){
    if(busyId)return;
    setBusyId(id);setError("");setNotice("");
    try{
      await deleteMyNeed(id);
      setNeeds(items=>items.filter(item=>item.id!==id));
      setConfirmDeleteId("");
      setNotice(uk?"Потребу видалено з вашого Паспорта.":"Need removed from your Passport.");
    }catch(cause){setError(friendlyNeedError(cause,uk))}finally{setBusyId("")}
  }

  return <section className="needsWorkspace" id="passport-needs">
    <div className="needsHeading">
      <div className="needsHeadingIcon"><HeartHandshake size={24}/></div>
      <div>
        <div className="needsEyebrow">ATLAS · {uk?"ПАСПОРТ ПОТРЕБ":"NEEDS PASSPORT"}</div>
        <h2>{uk?"Що вам потрібно?":"What do you need?"}</h2>
        <p>{uk?"Потреба обирається тільки зі списку Atlas. Так система точно знає, що саме потрібно людині або компанії.":"Needs are selected only from the Atlas list so the system knows exactly what a person or company needs."}</p>
      </div>
      <div className="needsHeadingTools"><div className="needsPilotBadge">{uk?"Структурована база потреб":"Structured needs database"}</div></div>
    </div>

    <form className="needComposer" onSubmit={submitNeed}>
      <div className="needStep">
        <div className="needStepTitle"><span>1</span><div><strong>{uk?"Оберіть потребу зі списку":"Choose a need from the list"}</strong><small>{uk?"Спочатку категорія, потім конкретна позиція":"First choose a category, then a specific item"}</small></div></div>
        <div className="needDetailsGrid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))"}}>
          <label><span>{uk?"Категорія":"Category"}</span>
            <select value={form.groupKey} onChange={event=>changeGroup(event.target.value)} disabled={catalogLoading}>
              <option value="">{uk?"Оберіть категорію":"Choose category"}</option>
              {activeGroups.map(group=><option key={group.group_key} value={group.group_key}>{group.icon?(group.icon+" "):""}{uk?group.name_uk:(group.name_en||group.name_uk)}</option>)}
            </select>
          </label>
          <label><span>{uk?"Що саме потрібно":"Specific need"}</span>
            <select required value={form.itemKey} onChange={event=>changeItem(event.target.value)} disabled={catalogLoading||!form.groupKey}>
              <option value="">{uk?"Оберіть зі списку":"Choose from the list"}</option>
              {itemsForGroup.map(item=><option key={item.item_key} value={item.item_key}>{item.icon?(item.icon+" "):""}{uk?item.name_uk:(item.name_en||item.name_uk)}</option>)}
            </select>
          </label>
        </div>
        {catalogLoading&&<div className="needCatalogLoading">{uk?"Завантажую список…":"Loading list…"}</div>}
        {selectedItem&&<div style={{display:"flex",alignItems:"center",gap:8,marginTop:12,padding:"10px 12px",borderRadius:12,background:"#eaf8ef",color:"#155c35"}}><Check size={18}/><span>{uk?"Обрано:":"Selected:"} <strong>{selectedItem.icon} {uk?selectedItem.name_uk:(selectedItem.name_en||selectedItem.name_uk)}</strong></span></div>}
      </div>

      <div className="needStep">
        <div className="needStepTitle"><span>2</span><div><strong>{uk?"Кількість і актуальність":"Quantity and validity"}</strong><small>{uk?"Atlas зберігає попит у структурованому вигляді":"Atlas stores demand in a structured form"}</small></div></div>
        <div className="needDetailsGrid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))"}}>
          <label className="needQuantityLabel"><span><Scale size={16}/>{uk?"Кількість":"Quantity"}</span><div><input type="number" min="0.1" max="1000000" step="0.1" inputMode="decimal" required value={form.quantity} onChange={event=>setForm({...form,quantity:event.target.value})} placeholder="0"/><b>{selectedItem?.unit||form.unit}</b></div></label>
          <label><span><CalendarRange size={16}/>{uk?"Актуально від":"Needed from"}</span><input type="date" required value={form.neededFrom} onChange={event=>setForm({...form,neededFrom:event.target.value,neededUntil:event.target.value>form.neededUntil?event.target.value:form.neededUntil})}/></label>
          <label><span><CalendarRange size={16}/>{uk?"Актуально до":"Needed until"}</span><input type="date" required min={form.neededFrom} value={form.neededUntil} onChange={event=>setForm({...form,neededUntil:event.target.value})}/></label>
        </div>
      </div>

      <div className="needComposerFooter">
        <div><Clock3 size={17}/><span>{uk?"Пошук рішення запускається окремо і перевіряє Паспорти можливостей.":"Solution search runs separately and checks Opportunity Passports."}</span></div>
        <button className="needAddButton" disabled={adding||!selectedItem||!form.quantity}><Plus size={19}/>{adding?(uk?"Додаю…":"Adding…"):(uk?"Додати потребу":"Add need")}</button>
      </div>
    </form>

    {(error||notice)&&<div className={"needMessage "+(error?"errorState":"successState")} role="status" aria-live="polite">{error||notice}</div>}

    <div className="needsListHeading"><div><h3>{uk?"Мої потреби":"My needs"}</h3><p>{uk?"Отримані потреби зберігаються в архіві.":"Received needs are kept in the archive."}</p></div></div>
    <div className="needsArchiveTabs" role="tablist" aria-label={uk?"Статус потреб":"Need status"}><button type="button" role="tab" aria-selected={!showArchive} className={!showArchive?"active":""} onClick={()=>setShowArchive(false)}>{uk?"Актуальні":"Active"} <b>{openCount}</b></button><button type="button" role="tab" aria-selected={showArchive} className={showArchive?"active":""} onClick={()=>setShowArchive(true)}>{uk?"Архів":"Archive"} <b>{archivedCount}</b></button></div>

    <div className="needsList">
      {visibleNeeds.length===0&&<div className="needsEmpty"><HeartHandshake size={24}/><strong>{showArchive?(uk?"Архів порожній":"Archive is empty"):(uk?"Актуальних потреб немає":"No active needs")}</strong><span>{showArchive?(uk?"Отримані потреби з’являться тут.":"Received needs will appear here."):(uk?"Додайте потребу зі списку вище.":"Add a need from the list above.")}</span></div>}
      {visibleNeeds.map(item=>{
        const received=item.status==="received";
        const deleting=confirmDeleteId===item.id;
        const catalogItem=catalogLookup.get(item.group_key+":"+item.item_key);
        const catalogGroup=groupLookup.get(item.group_key);
        const itemName=uk?(catalogItem?.name_uk||item.item_key):(catalogItem?.name_en||catalogItem?.name_uk||item.item_key);
        const groupName=uk?(catalogGroup?.name_uk||item.group_key):(catalogGroup?.name_en||catalogGroup?.name_uk||item.group_key);
        return <article className={"needRecord "+(received?"received":"")} key={item.id}>
          <div className="needRecordProduct"><span aria-hidden="true">{catalogItem?.icon||"📦"}</span><div><small>{String(groupName).toLocaleUpperCase(uk?"uk-UA":"en-GB")}</small><h4>{itemName}</h4></div></div>
          <div className="needRecordMeta"><div><Scale size={16}/><span><small>{uk?"Кількість":"Quantity"}</small><strong>{Number(item.quantity).toLocaleString(uk?"uk-UA":"en-GB")} {item.unit}</strong></span></div><div><CalendarRange size={16}/><span><small>{uk?"Актуальність":"Validity"}</small><strong>{formatDateRange(item.needed_from,item.needed_until,uk)}</strong></span></div></div>
          <div className="needRecordActions">
            <button type="button" className="needArchiveAction" disabled={busyId===item.id} onClick={()=>changeStatus(item,received?"not_received":"received")}>{received?<><Clock3 size={16}/>{uk?"Повернути":"Restore"}</>:<><PackageCheck size={16}/>{uk?"Отримано · в архів":"Received · archive"}</>}</button>
            {deleting?<div className="needDeleteConfirm"><span>{uk?"Точно видалити?":"Delete it?"}</span><button type="button" disabled={busyId===item.id} onClick={()=>removeNeed(item.id)}><Check size={16}/>{uk?"Так":"Yes"}</button><button type="button" onClick={()=>setConfirmDeleteId("")}><X size={16}/></button></div>:<button className="needDeleteButton" type="button" title={uk?"Видалити потребу":"Delete need"} onClick={()=>setConfirmDeleteId(item.id)}><Trash2 size={18}/></button>}
          </div>
        </article>;
      })}
    </div>
  </section>;
}
