import {useEffect,useMemo,useState} from "react";
import {ArrowLeft,Check,ChevronRight,Edit3,FolderPlus,KeyRound,Layers3,LogOut,PackagePlus,Power,RefreshCw,Save,ShieldCheck,Trash2,X} from "lucide-react";
import {Link} from "react-router-dom";
import {
  addCatalogGroup,addCatalogItem,deleteCatalogGroup,deleteCatalogItem,loadCatalogAdminState,loadNeedCatalog,
  requestCatalogAdminLink,signOutCatalogAdmin,updateCatalogGroup,updateCatalogItem,watchCatalogAdminAuth
} from "../services/catalogStore";
import {loadTomatoPilotAdmin,setTomatoPilotEnabled,updateTomatoOrderStatus} from "../services/tomatoPilotStore";
import "../styles/catalogAdmin.css";
import "../styles/catalogTomatoAdmin.css";

const units=["кг","шт","л","т","м","м²","м³","уп"];
const blankGroup={nameUk:"",nameEn:"",icon:"📦",isActive:false,sortOrder:100};
const blankItem={nameUk:"",nameEn:"",icon:"📦",unit:"кг",isActive:false,sortOrder:100,canonicalCode:"",familyCode:""};

function friendlyError(error){
  const text=String(error?.message||error||"");
  if(/email-required/i.test(text))return "Вкажіть правильний email.";
  if(/rate limit|over_email_send_rate_limit/i.test(text))return "Лист уже надсилався. Зачекайте приблизно хвилину й спробуйте ще раз.";
  if(/not authorized|email.*not.*allowed/i.test(text))return "Supabase поки не дозволяє надсилати листи на цю адресу. Потрібно дозволити її в налаштуваннях пошти проєкту.";
  if(/row-level security|42501|permission denied/i.test(text))return "Цей email не має прав адміністратора каталогу.";
  if(/duplicate key|23505/i.test(text))return "Такий код Atlas уже використовується іншим товаром.";
  if(/foreign key|23503/i.test(text))return "Цей запис уже використовується. Його можна вимкнути, але не видалити.";
  if(/atlas_need_groups|atlas_need_items|atlas_catalog_admins|relation .* does not exist/i.test(text))return "Керований каталог ще не активований у базі Atlas.";
  if(/atlas_tomato_pilots|atlas_tomato_orders|tomato-/i.test(text))return "Пілот помідорів ще не активований у базі Atlas.";
  return text||"Не вдалося виконати дію.";
}

export default function CatalogAdmin(){
  const [loading,setLoading]=useState(true);
  const [catalogLoading,setCatalogLoading]=useState(false);
  const [user,setUser]=useState(null);
  const [isAdmin,setIsAdmin]=useState(false);
  const [email,setEmail]=useState("");
  const [linkSent,setLinkSent]=useState(false);
  const [sendingLink,setSendingLink]=useState(false);
  const [groups,setGroups]=useState([]);
  const [items,setItems]=useState([]);
  const [selectedGroup,setSelectedGroup]=useState("");
  const [groupForm,setGroupForm]=useState(blankGroup);
  const [itemForm,setItemForm]=useState(blankItem);
  const [editingGroup,setEditingGroup]=useState("");
  const [editingItem,setEditingItem]=useState("");
  const [busy,setBusy]=useState("");
  const [confirmDelete,setConfirmDelete]=useState("");
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [tomatoPilot,setTomatoPilot]=useState(null);
  const [tomatoOrders,setTomatoOrders]=useState([]);
  const [tomatoLoading,setTomatoLoading]=useState(false);

  async function refreshCatalog(){
    setCatalogLoading(true);
    try{
      const catalog=await loadNeedCatalog();
      setGroups(catalog.groups);
      setItems(catalog.items);
      setSelectedGroup(current=>catalog.groups.some(group=>group.group_key===current)?current:(catalog.groups[0]?.group_key||""));
    }finally{setCatalogLoading(false)}
  }

  async function refreshTomatoPilot(){
    setTomatoLoading(true);
    try{
      const state=await loadTomatoPilotAdmin();
      setTomatoPilot(state.pilot);setTomatoOrders(state.orders);
    }finally{setTomatoLoading(false)}
  }

  async function refreshAccess(){
    setLoading(true);setError("");
    try{
      const [state]=await Promise.all([loadCatalogAdminState(),refreshCatalog()]);
      setUser(state.user);setIsAdmin(state.isAdmin);
      if(state.user?.email)setEmail(state.user.email);
      if(state.isAdmin)await refreshTomatoPilot();
      else{setTomatoPilot(null);setTomatoOrders([])}
    }catch(e){setError(friendlyError(e))}finally{setLoading(false)}
  }

  useEffect(()=>{
    const stop=watchCatalogAdminAuth(()=>refreshAccess());
    refreshAccess();
    return stop;
  },[]);

  const selectedGroupRecord=groups.find(group=>group.group_key===selectedGroup)||null;
  const visibleItems=useMemo(()=>items.filter(item=>item.group_key===selectedGroup),[items,selectedGroup]);
  const activeGroupCount=groups.filter(group=>group.is_active).length;
  const activeItemCount=items.filter(item=>item.is_active).length;
  const codedItemCount=items.filter(item=>item.canonical_code).length;
  const activeTomatoOrders=tomatoOrders.filter(order=>order.status!=="cancelled");

  async function sendLink(event){
    event.preventDefault();if(sendingLink)return;
    setSendingLink(true);setError("");setNotice("");
    try{await requestCatalogAdminLink(email);setLinkSent(true);setNotice("Одноразове посилання надіслано. Відкрийте лист на цьому пристрої.")}
    catch(e){setError(friendlyError(e))}finally{setSendingLink(false)}
  }

  async function signOut(){
    setBusy("logout");setError("");
    try{await signOutCatalogAdmin();setUser(null);setIsAdmin(false);setEmail("");setNotice("Ви вийшли з режиму адміністратора.")}
    catch(e){setError(friendlyError(e))}finally{setBusy("")}
  }

  async function toggleTomatoPilot(){
    if(busy||!tomatoPilot)return;
    setBusy("tomato-pilot");setError("");setNotice("");
    try{
      const next=await setTomatoPilotEnabled(!tomatoPilot.enabled);setTomatoPilot(next);
      setNotice(next.enabled?"Прийом заявок на помідори відкрито.":"Прийом нових заявок призупинено.");
    }catch(e){setError(friendlyError(e))}finally{setBusy("")}
  }

  async function changeTomatoStatus(order,status){
    if(busy)return;
    setBusy(`tomato-${order.id}`);setError("");setNotice("");
    try{
      await updateTomatoOrderStatus(order.id,status);await refreshTomatoPilot();
      setNotice(status==="received"?`Видачу для квартири № ${order.apartment_number} підтверджено.`:"Статус заявки оновлено.");
    }catch(e){setError(friendlyError(e))}finally{setBusy("")}
  }

  function beginGroupEdit(group){
    setEditingGroup(group.group_key);setConfirmDelete("");
    setGroupForm({nameUk:group.name_uk,nameEn:group.name_en,icon:group.icon,isActive:group.is_active,sortOrder:group.sort_order});
    document.getElementById("catalog-group-form")?.scrollIntoView({behavior:"smooth",block:"center"});
  }

  function resetGroupForm(){setEditingGroup("");setGroupForm(blankGroup)}

  async function saveGroup(event){
    event.preventDefault();if(busy)return;
    setBusy("group-save");setError("");setNotice("");
    try{
      if(editingGroup){await updateCatalogGroup(editingGroup,groupForm);setNotice("Групу оновлено.")}
      else{await addCatalogGroup(groupForm);setNotice("Нову групу додано до каталогу.")}
      resetGroupForm();await refreshCatalog();
    }catch(e){setError(friendlyError(e))}finally{setBusy("")}
  }

  async function toggleGroup(group){
    setBusy(`group-${group.group_key}`);setError("");setNotice("");
    try{
      await updateCatalogGroup(group.group_key,{nameUk:group.name_uk,nameEn:group.name_en,icon:group.icon,isActive:!group.is_active,sortOrder:group.sort_order});
      setNotice(group.is_active?"Групу вимкнено.":"Групу активовано для користувачів.");await refreshCatalog();
    }catch(e){setError(friendlyError(e))}finally{setBusy("")}
  }

  async function removeGroup(groupKey){
    setBusy(`group-${groupKey}`);setError("");setNotice("");
    try{await deleteCatalogGroup(groupKey);setConfirmDelete("");setNotice("Групу видалено.");await refreshCatalog()}
    catch(e){setError(friendlyError(e))}finally{setBusy("")}
  }

  function beginItemEdit(item){
    setEditingItem(item.item_key);setConfirmDelete("");
    setItemForm({nameUk:item.name_uk,nameEn:item.name_en,icon:item.icon,unit:item.unit,isActive:item.is_active,sortOrder:item.sort_order,canonicalCode:item.canonical_code||"",familyCode:item.family_code||""});
    document.getElementById("catalog-item-form")?.scrollIntoView({behavior:"smooth",block:"center"});
  }

  function resetItemForm(){setEditingItem("");setItemForm(blankItem)}

  async function saveItem(event){
    event.preventDefault();if(busy||!selectedGroup)return;
    setBusy("item-save");setError("");setNotice("");
    try{
      if(editingItem){await updateCatalogItem(selectedGroup,editingItem,itemForm);setNotice("Товар оновлено.")}
      else{await addCatalogItem({...itemForm,groupKey:selectedGroup});setNotice("Новий товар додано до групи.")}
      resetItemForm();await refreshCatalog();
    }catch(e){setError(friendlyError(e))}finally{setBusy("")}
  }

  async function toggleItem(item){
    setBusy(`item-${item.item_key}`);setError("");setNotice("");
    try{
      await updateCatalogItem(item.group_key,item.item_key,{nameUk:item.name_uk,nameEn:item.name_en,icon:item.icon,unit:item.unit,isActive:!item.is_active,sortOrder:item.sort_order,canonicalCode:item.canonical_code||"",familyCode:item.family_code||""});
      setNotice(item.is_active?"Товар вимкнено.":"Товар активовано для користувачів.");await refreshCatalog();
    }catch(e){setError(friendlyError(e))}finally{setBusy("")}
  }

  async function removeItem(item){
    setBusy(`item-${item.item_key}`);setError("");setNotice("");
    try{await deleteCatalogItem(item.group_key,item.item_key);setConfirmDelete("");setNotice("Товар видалено.");await refreshCatalog()}
    catch(e){setError(friendlyError(e))}finally{setBusy("")}
  }

  if(loading)return <main className="catalogAdminPage"><section className="catalogAccessCard"><RefreshCw className="spin"/><h1>Відкриваю керування каталогом…</h1></section></main>;

  if(!isAdmin)return <main className="catalogAdminPage"><section className="catalogAccessCard">
    <Link className="catalogBack" to="/profile"><ArrowLeft size={18}/>До Паспортa</Link>
    <div className="catalogShield"><KeyRound size={30}/></div>
    <span className="catalogEyebrow">ATLAS · ЗАХИЩЕНА ЗОНА</span>
    <h1>Керування пілотом</h1>
    <p>Заявки на помідори й каталог бачить лише адміністратор. Вхід — через одноразове посилання на підтверджений email.</p>
    <form className="catalogLoginForm" onSubmit={sendLink}>
      <label><span>Адміністраторський email</span><input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/></label>
      <button disabled={sendingLink}>{sendingLink?<RefreshCw className="spin" size={18}/>:<KeyRound size={18}/>}Надіслати посилання</button>
    </form>
    {linkSent&&<div className="catalogInfo"><Check size={18}/><span>Перевірте пошту та натисніть посилання у листі. Воно діє один раз.</span></div>}
    {user&&!isAdmin&&<button className="catalogTextButton" type="button" onClick={signOut}>Вийти з поточного email і спробувати інший</button>}
    {error&&<div className="catalogMessage errorState" role="alert">{error}</div>}
    {notice&&<div className="catalogMessage successState" role="status">{notice}</div>}
  </section></main>;

  return <main className="catalogAdminPage"><section className="catalogAdminShell">
    <header className="catalogAdminHeader">
      <div><Link className="catalogBack" to="/profile"><ArrowLeft size={18}/>До Паспортa</Link><span className="catalogEyebrow">ATLAS · АДМІНІСТРАТОР</span><h1>Пілот помідорів та каталог</h1><p>Тут видно всі заявки будинку, залишок 850 кг і стан кожної видачі.</p></div>
      <div className="catalogAdminIdentity"><ShieldCheck size={20}/><span><small>Захищений вхід</small><strong>{user?.email}</strong></span><button type="button" onClick={signOut} disabled={busy==="logout"} title="Вийти"><LogOut size={18}/></button></div>
    </header>

    <div className="catalogStats"><div><Layers3/><span><small>Групи</small><strong>{groups.length}</strong><b>{activeGroupCount} активні</b></span></div><div><PackagePlus/><span><small>Товари</small><strong>{items.length}</strong><b>{activeItemCount} активні</b></span></div><div><KeyRound/><span><small>Коди Atlas</small><strong>{codedItemCount}</strong><b>синхронізуються з OVI</b></span></div></div>

    {(error||notice)&&<div className={`catalogMessage ${error?"errorState":"successState"}`} role="status" aria-live="polite">{error||notice}</div>}

    <section className="catalogPilotPanel">
      <header><div><span className="catalogPilotEmoji">🍅</span><div><span className="catalogEyebrow">ПІЛОТ · 170 КВАРТИР</span><h2>Безкоштовна видача по 5 кг</h2><p>Статус «Отримано» завершує ланцюжок потреба → заявка → рішення.</p></div></div><button className={tomatoPilot?.enabled?"pilotEnabled":"pilotPaused"} type="button" onClick={toggleTomatoPilot} disabled={!tomatoPilot||busy==="tomato-pilot"||tomatoLoading}><Power size={17}/>{tomatoPilot?.enabled?"Прийом відкрито":"Прийом призупинено"}</button></header>
      <div className="catalogPilotStats"><div><small>Заявок</small><strong>{tomatoPilot?.order_count||0} / 170</strong></div><div><small>Зарезервовано</small><strong>{tomatoPilot?.reserved_kg||0} кг</strong></div><div><small>Залишилося</small><strong>{tomatoPilot?.remaining_kg??850} кг</strong></div><div><small>Видано</small><strong>{tomatoPilot?.received_kg||0} кг</strong></div></div>
      <div className="catalogPilotOrders">
        <div className="catalogPilotOrdersHead"><strong>Заявки мешканців</strong><span>{activeTomatoOrders.length} активних</span><button type="button" onClick={refreshTomatoPilot} disabled={tomatoLoading} title="Оновити"><RefreshCw className={tomatoLoading?"spin":""} size={17}/></button></div>
        {tomatoOrders.length===0?<div className="catalogPilotEmpty">Поки немає заявок. Після першого замовлення воно з’явиться тут.</div>:<div className="catalogPilotTable"><div className="catalogPilotTableHead"><span>Кв.</span><span>Мешканець</span><span>Час</span><span>Створено</span><span>Статус</span></div>{tomatoOrders.map(order=><div className={order.status==="cancelled"?"cancelled":""} key={order.id}><strong>№ {order.apartment_number}</strong><span>{order.customer_name}</span><span>{order.pickup_slot}</span><span>{new Intl.DateTimeFormat("uk-UA",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(order.created_at))}</span><select aria-label={`Статус заявки квартири № ${order.apartment_number}`} value={order.status} onChange={e=>changeTomatoStatus(order,e.target.value)} disabled={busy===`tomato-${order.id}`}><option value="requested">Заявку прийнято</option><option value="ready">Готово до видачі</option><option value="received">Отримано</option><option value="cancelled">Скасовано</option></select></div>)}</div>}
      </div>
    </section>

    <div className="catalogAdminGrid">
      <section className="catalogPanel">
        <div className="catalogPanelTitle"><div><span>01</span><div><h2>Групи</h2><p>Наприклад: Овочі, Послуги, Матеріали</p></div></div>{catalogLoading&&<RefreshCw className="spin" size={18}/>}</div>
        <form id="catalog-group-form" className="catalogEditor" onSubmit={saveGroup}>
          <div className="catalogEditorHeading"><FolderPlus size={20}/><strong>{editingGroup?"Редагувати групу":"Додати нову групу"}</strong></div>
          <div className="catalogFormGrid"><label className="iconField"><span>Значок</span><input value={groupForm.icon} onChange={e=>setGroupForm({...groupForm,icon:e.target.value})} maxLength={8}/></label><label><span>Назва українською</span><input required value={groupForm.nameUk} onChange={e=>setGroupForm({...groupForm,nameUk:e.target.value})} placeholder="Наприклад: Транспорт"/></label><label><span>Назва англійською</span><input value={groupForm.nameEn} onChange={e=>setGroupForm({...groupForm,nameEn:e.target.value})} placeholder="Transport"/></label><label className="orderField"><span>Порядок</span><input type="number" min="0" max="10000" value={groupForm.sortOrder} onChange={e=>setGroupForm({...groupForm,sortOrder:e.target.value})}/></label></div>
          <label className="catalogSwitch"><input type="checkbox" checked={groupForm.isActive} onChange={e=>setGroupForm({...groupForm,isActive:e.target.checked})}/><span></span><b>Одразу активувати для користувачів</b></label>
          <div className="catalogFormActions"><button className="catalogSaveButton" disabled={busy==="group-save"}><Save size={17}/>{editingGroup?"Зберегти зміни":"Додати групу"}</button>{editingGroup&&<button className="catalogCancelButton" type="button" onClick={resetGroupForm}><X size={17}/>Скасувати</button>}</div>
        </form>
        <div className="catalogRows">{groups.map(group=>{
          const deleting=confirmDelete===`group-${group.group_key}`;
          return <article key={group.group_key} className={`${group.is_active?"active":"inactive"} ${selectedGroup===group.group_key?"selected":""}`} onClick={()=>{setSelectedGroup(group.group_key);resetItemForm()}}><span className="catalogRowIcon">{group.icon}</span><div><strong>{group.name_uk}</strong><small>{group.name_en||"Без англійської назви"}</small></div><span className="catalogState">{group.is_active?"Активна":"Вимкнена"}</span><div className="catalogRowActions"><button type="button" title={group.is_active?"Вимкнути":"Активувати"} disabled={busy===`group-${group.group_key}`} onClick={e=>{e.stopPropagation();toggleGroup(group)}}><Power size={16}/></button><button type="button" title="Редагувати" onClick={e=>{e.stopPropagation();beginGroupEdit(group)}}><Edit3 size={16}/></button>{deleting?<><button className="dangerConfirm" type="button" onClick={e=>{e.stopPropagation();removeGroup(group.group_key)}}><Check size={15}/></button><button type="button" onClick={e=>{e.stopPropagation();setConfirmDelete("")}}><X size={15}/></button></>:<button type="button" title="Видалити" onClick={e=>{e.stopPropagation();setConfirmDelete(`group-${group.group_key}`)}}><Trash2 size={16}/></button>}<ChevronRight size={16}/></div></article>;
        })}</div>
      </section>

      <section className="catalogPanel">
        <div className="catalogPanelTitle"><div><span>02</span><div><h2>Товари</h2><p>{selectedGroupRecord?`${selectedGroupRecord.icon} ${selectedGroupRecord.name_uk}`:"Спочатку створіть групу"}</p></div></div>{catalogLoading&&<RefreshCw className="spin" size={18}/>}</div>
        <form id="catalog-item-form" className="catalogEditor" onSubmit={saveItem}>
          <div className="catalogEditorHeading"><PackagePlus size={20}/><strong>{editingItem?"Редагувати товар":"Додати новий товар"}</strong></div>
          <div className="catalogFormGrid itemFormGrid"><label className="iconField"><span>Значок</span><input value={itemForm.icon} onChange={e=>setItemForm({...itemForm,icon:e.target.value})} maxLength={8}/></label><label><span>Назва українською</span><input required disabled={!selectedGroup} value={itemForm.nameUk} onChange={e=>setItemForm({...itemForm,nameUk:e.target.value})} placeholder="Наприклад: Помідор червоний"/></label><label><span>Назва англійською</span><input disabled={!selectedGroup} value={itemForm.nameEn} onChange={e=>setItemForm({...itemForm,nameEn:e.target.value})} placeholder="Red tomato"/></label><label><span>Код Atlas</span><input disabled={!selectedGroup} value={itemForm.canonicalCode} onChange={e=>setItemForm({...itemForm,canonicalCode:e.target.value.toUpperCase()})} placeholder="VEG-TOMATO-RED"/></label><label><span>Родинний код</span><input disabled={!selectedGroup} value={itemForm.familyCode} onChange={e=>setItemForm({...itemForm,familyCode:e.target.value.toUpperCase()})} placeholder="VEG-TOMATO"/></label><label><span>Одиниця</span><select value={itemForm.unit} onChange={e=>setItemForm({...itemForm,unit:e.target.value})}>{units.map(unit=><option key={unit}>{unit}</option>)}</select></label><label className="orderField"><span>Порядок</span><input type="number" min="0" max="10000" value={itemForm.sortOrder} onChange={e=>setItemForm({...itemForm,sortOrder:e.target.value})}/></label></div>
          <label className="catalogSwitch"><input type="checkbox" checked={itemForm.isActive} onChange={e=>setItemForm({...itemForm,isActive:e.target.checked})}/><span></span><b>Одразу активувати для користувачів</b></label>
          <div className="catalogFormActions"><button className="catalogSaveButton" disabled={busy==="item-save"||!selectedGroup}><Save size={17}/>{editingItem?"Зберегти зміни":"Додати товар"}</button>{editingItem&&<button className="catalogCancelButton" type="button" onClick={resetItemForm}><X size={17}/>Скасувати</button>}</div>
        </form>
        <div className="catalogRows">{visibleItems.length===0&&<div className="catalogEmpty"><PackagePlus size={24}/><span>У цій групі ще немає товарів.</span></div>}{visibleItems.map(item=>{
          const deleting=confirmDelete===`item-${item.item_key}`;
          return <article key={item.item_key} className={item.is_active?"active":"inactive"}><span className="catalogRowIcon">{item.icon}</span><div><strong>{item.name_uk}</strong><small>{item.canonical_code||"Без коду Atlas"}{item.family_code?` · ${item.family_code}`:""} · {item.unit}</small></div><span className="catalogState">{item.is_active?"Активний":"Вимкнений"}</span><div className="catalogRowActions"><button type="button" title={item.is_active?"Вимкнути":"Активувати"} disabled={busy===`item-${item.item_key}`} onClick={()=>toggleItem(item)}><Power size={16}/></button><button type="button" title="Редагувати" onClick={()=>beginItemEdit(item)}><Edit3 size={16}/></button>{deleting?<><button className="dangerConfirm" type="button" onClick={()=>removeItem(item)}><Check size={15}/></button><button type="button" onClick={()=>setConfirmDelete("")}><X size={15}/></button></>:<button type="button" title="Видалити" onClick={()=>setConfirmDelete(`item-${item.item_key}`)}><Trash2 size={16}/></button>}</div></article>;
        })}</div>
      </section>
    </div>
  </section></main>;
}
