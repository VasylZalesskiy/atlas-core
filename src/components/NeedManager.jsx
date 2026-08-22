import {useEffect,useMemo,useState} from "react";
import {CalendarRange,Check,Clock3,Leaf,LockKeyhole,PackageCheck,Plus,Scale,Settings2,Trash2,X} from "lucide-react";
import {Link} from "react-router-dom";
import {addMyNeed,deleteMyNeed,updateMyNeedStatus} from "../services/passportStore";
import {loadNeedCatalog} from "../services/catalogStore";
import "../styles/needs.css";

function isoDate(offset=0){
  const date=new Date();
  date.setHours(12,0,0,0);
  date.setDate(date.getDate()+offset);
  return date.toISOString().slice(0,10);
}

function formatDateRange(from,to,uk){
  const locale=uk?"uk-UA":"en-GB";
  const formatter=new Intl.DateTimeFormat(locale,{day:"numeric",month:"short",year:"numeric"});
  const start=from?formatter.format(new Date(`${from}T12:00:00`)):"—";
  const end=to?formatter.format(new Date(`${to}T12:00:00`)):"—";
  return `${start} — ${end}`;
}

function friendlyNeedError(error,uk){
  const text=String(error?.message||error||"");
  if(/atlas_needs|atlas_need_groups|atlas_need_items|relation .*atlas_need.*does not exist/i.test(text))return uk?"Сховище потреб ще не активоване в Atlas.":"Needs storage is not active in Atlas yet.";
  if(/date-range-invalid/i.test(text))return uk?"Дата завершення не може бути раніше дати початку.":"The end date cannot be before the start date.";
  if(/quantity-invalid/i.test(text))return uk?"Вкажіть правильну кількість.":"Enter a valid quantity.";
  return text||(uk?"Не вдалося виконати дію.":"The action could not be completed.");
}

export default function NeedManager({passportId,initialNeeds=[],lang="uk"}){
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

  const openCount=needs.filter(item=>item.status==="not_received").length;
  const itemOptions=useMemo(()=>catalogItems.filter(item=>item.group_key===form.groupKey),[catalogItems,form.groupKey]);
  const selectedItem=catalogItems.find(item=>item.group_key===form.groupKey&&item.item_key===form.itemKey)||null;
  const catalogLookup=useMemo(()=>new Map(catalogItems.map(item=>[`${item.group_key}:${item.item_key}`,item])),[catalogItems]);
  const groupLookup=useMemo(()=>new Map(groups.map(group=>[group.group_key,group])),[groups]);

  useEffect(()=>{
    let alive=true;
    setCatalogLoading(true);
    loadNeedCatalog().then(catalog=>{
      if(!alive)return;
      setGroups(catalog.groups);setCatalogItems(catalog.items);
      const firstGroup=catalog.groups.find(group=>group.is_active);
      const firstItem=catalog.items.find(item=>item.group_key===firstGroup?.group_key&&item.is_active);
      setForm(value=>({...value,groupKey:firstGroup?.group_key||"",itemKey:firstItem?.item_key||"",unit:firstItem?.unit||"кг"}));
    }).catch(e=>{if(alive)setError(friendlyNeedError(e,uk))}).finally(()=>{if(alive)setCatalogLoading(false)});
    return()=>{alive=false};
  },[uk]);

  function chooseGroup(option){
    if(!option.is_active)return;
    const firstItem=catalogItems.find(item=>item.group_key===option.group_key&&item.is_active);
    setForm(value=>({...value,groupKey:option.group_key,itemKey:firstItem?.item_key||"",unit:firstItem?.unit||"кг"}));
  }

  function chooseItem(option){
    if(!option.is_active)return;
    setForm(value=>({...value,itemKey:option.item_key,unit:option.unit}));
  }

  async function submitNeed(event){
    event.preventDefault();
    if(adding)return;
    setError("");setNotice("");setAdding(true);
    try{
      const added=await addMyNeed(passportId,form);
      setNeeds(items=>[added,...items]);
      setForm(value=>({...value,quantity:"",neededFrom:isoDate(),neededUntil:isoDate(7)}));
      const itemName=uk?(selectedItem?.name_uk||"Товар"):(selectedItem?.name_en||selectedItem?.name_uk||"Item");
      setNotice(uk?`✓ Потребу «${itemName}» додано до вашого Паспортa.`:`✓ “${itemName}” was added to your Passport.`);
    }catch(e){setError(friendlyNeedError(e,uk))}finally{setAdding(false)}
  }

  async function changeStatus(item,status){
    if(busyId)return;
    setBusyId(item.id);setError("");setNotice("");
    try{
      const updated=await updateMyNeedStatus(item.id,status);
      setNeeds(items=>items.map(value=>value.id===item.id?{...value,...updated}:value));
      setNotice(status==="received"?(uk?"✓ Позначено як отримано.":"✓ Marked as received."):(uk?"Потребу знову позначено як не отриману.":"The need is marked as not received again."));
    }catch(e){setError(friendlyNeedError(e,uk))}finally{setBusyId("")}
  }

  async function removeNeed(id){
    if(busyId)return;
    setBusyId(id);setError("");setNotice("");
    try{
      await deleteMyNeed(id);
      setNeeds(items=>items.filter(item=>item.id!==id));
      setConfirmDeleteId("");
      setNotice(uk?"Потребу видалено.":"Need deleted.");
    }catch(e){setError(friendlyNeedError(e,uk))}finally{setBusyId("")}
  }

  return <section className="needsWorkspace" id="passport-needs">
    <div className="needsHeading">
      <div className="needsHeadingIcon"><Leaf size={24}/></div>
      <div>
        <div className="needsEyebrow">ATLAS · {uk?"ПАСПОРТ ПОТРЕБ":"NEEDS PASSPORT"}</div>
        <h2>{uk?"Мої потреби":"My needs"}</h2>
        <p>{uk?"Додайте конкретну потребу та керуйте її актуальністю в одному місці.":"Add a specific need and manage its validity in one place."}</p>
      </div>
      <div className="needsHeadingTools"><div className="needsPilotBadge">{uk?"Керований каталог":"Managed catalog"}</div><Link to="/admin/catalog" className="needsAdminLink"><Settings2 size={15}/>{uk?"Керування":"Manage"}</Link></div>
    </div>

    <form className="needComposer" onSubmit={submitNeed}>
      <div className="needStep">
        <div className="needStepTitle"><span>1</span><div><strong>{uk?"Оберіть групу":"Choose a group"}</strong><small>{uk?"Активні групи доступні для вибору":"Active groups are available to select"}</small></div></div>
        <div className="needGroupGrid">
          {catalogLoading&&<div className="needCatalogLoading">{uk?"Завантажую каталог…":"Loading catalog…"}</div>}
          {!catalogLoading&&groups.map(option=><button key={option.group_key} type="button" disabled={!option.is_active} className={`needChoice ${form.groupKey===option.group_key?"selected":""}`} onClick={()=>chooseGroup(option)}>
            <span className="needChoiceIcon" aria-hidden="true">{option.icon}</span>
            <span><strong>{uk?option.name_uk:(option.name_en||option.name_uk)}</strong><small>{option.is_active?(uk?"Доступно":"Available"):(uk?"Неактивно":"Inactive")}</small></span>
            {option.is_active?<Check size={17}/>:<LockKeyhole size={15}/>} 
          </button>)}
        </div>
      </div>

      <div className="needStep">
        <div className="needStepTitle"><span>2</span><div><strong>{uk?"Що саме потрібно?":"What exactly do you need?"}</strong><small>{uk?"Товари залежать від обраної групи":"Items depend on the selected group"}</small></div></div>
        <div className="needItemGrid">
          {!catalogLoading&&itemOptions.length===0&&<div className="needCatalogLoading">{uk?"У цій групі ще немає товарів.":"There are no items in this group yet."}</div>}
          {itemOptions.map(option=><button key={option.item_key} type="button" disabled={!option.is_active} className={`needItem ${form.itemKey===option.item_key?"selected":""}`} onClick={()=>chooseItem(option)}>
            <span aria-hidden="true">{option.icon}</span><strong>{uk?option.name_uk:(option.name_en||option.name_uk)}</strong>{!option.is_active&&<small>{uk?"Неактивно":"Inactive"}</small>}
          </button>)}
        </div>
      </div>

      <div className="needStep">
        <div className="needStepTitle"><span>3</span><div><strong>{uk?"Кількість та актуальність":"Quantity and validity"}</strong><small>{uk?"Коли ви можете отримати потребу":"When you can receive it"}</small></div></div>
        <div className="needDetailsGrid">
          <label className="needQuantityLabel"><span><Scale size={16}/>{uk?"Кількість":"Quantity"}</span><div><input type="number" min="0.1" max="1000000" step="0.1" inputMode="decimal" required value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} placeholder="0"/><b>{selectedItem?.unit||form.unit}</b></div></label>
          <label><span><CalendarRange size={16}/>{uk?"Можна отримати з":"Can receive from"}</span><input type="date" required value={form.neededFrom} onChange={e=>setForm({...form,neededFrom:e.target.value,neededUntil:e.target.value>form.neededUntil?e.target.value:form.neededUntil})}/></label>
          <label><span><CalendarRange size={16}/>{uk?"Можна отримати по":"Can receive until"}</span><input type="date" required min={form.neededFrom} value={form.neededUntil} onChange={e=>setForm({...form,neededUntil:e.target.value})}/></label>
        </div>
      </div>

      <div className="needComposerFooter">
        <div><Clock3 size={17}/><span>{uk?"Після завершення дати потреба автоматично перестане бути актуальною.":"After the end date, the need automatically stops being current."}</span></div>
        <button className="needAddButton" disabled={adding||!form.quantity||!form.groupKey||!form.itemKey}><Plus size={19}/>{adding?(uk?"Додаю…":"Adding…"):(uk?"Додати потребу":"Add need")}</button>
      </div>
    </form>

    {(error||notice)&&<div className={`needMessage ${error?"errorState":"successState"}`} role="status" aria-live="polite">{error||notice}</div>}

    <div className="needsListHeading">
      <div><h3>{uk?"Додані потреби":"Added needs"}</h3><p>{uk?"Статус можна змінити у будь-який момент.":"Status can be changed at any time."}</p></div>
      <span>{openCount} {uk?"не отримано":"not received"}</span>
    </div>

    <div className="needsList">
      {needs.length===0&&<div className="needsEmpty"><Leaf size={24}/><strong>{uk?"Потреб ще немає":"No needs yet"}</strong><span>{uk?"Перша потреба з’явиться тут після додавання.":"Your first need will appear here after you add it."}</span></div>}
      {needs.map(item=>{
        const received=item.status==="received";
        const deleting=confirmDeleteId===item.id;
        const catalogItem=catalogLookup.get(`${item.group_key}:${item.item_key}`);
        const catalogGroup=groupLookup.get(item.group_key);
        const itemName=uk?(catalogItem?.name_uk||item.item_key):(catalogItem?.name_en||catalogItem?.name_uk||item.item_key);
        const groupName=uk?(catalogGroup?.name_uk||item.group_key):(catalogGroup?.name_en||catalogGroup?.name_uk||item.group_key);
        return <article className={`needRecord ${received?"received":""}`} key={item.id}>
          <div className="needRecordProduct"><span aria-hidden="true">{catalogItem?.icon||"📦"}</span><div><small>{groupName.toLocaleUpperCase(uk?"uk-UA":"en-GB")}</small><h4>{itemName}</h4></div></div>
          <div className="needRecordMeta"><div><Scale size={16}/><span><small>{uk?"Кількість":"Quantity"}</small><strong>{Number(item.quantity).toLocaleString(uk?"uk-UA":"en-GB")} {item.unit}</strong></span></div><div><CalendarRange size={16}/><span><small>{uk?"Актуальність":"Validity"}</small><strong>{formatDateRange(item.needed_from,item.needed_until,uk)}</strong></span></div></div>
          <div className="needRecordActions">
            <div className="needStatus" role="group" aria-label={uk?"Статус потреби":"Need status"}>
              <button type="button" className={!received?"active":""} disabled={busyId===item.id} onClick={()=>changeStatus(item,"not_received")}><Clock3 size={15}/>{uk?"Не отримано":"Not received"}</button>
              <button type="button" className={received?"active receivedActive":""} disabled={busyId===item.id} onClick={()=>changeStatus(item,"received")}><PackageCheck size={15}/>{uk?"Отримано":"Received"}</button>
            </div>
            {deleting?<div className="needDeleteConfirm"><span>{uk?"Точно видалити?":"Delete it?"}</span><button type="button" disabled={busyId===item.id} onClick={()=>removeNeed(item.id)}><Check size={16}/>{uk?"Так":"Yes"}</button><button type="button" onClick={()=>setConfirmDeleteId("")}><X size={16}/></button></div>:<button className="needDeleteButton" type="button" title={uk?"Видалити потребу":"Delete need"} onClick={()=>setConfirmDeleteId(item.id)}><Trash2 size={18}/></button>}
          </div>
        </article>;
      })}
    </div>
  </section>;
}
