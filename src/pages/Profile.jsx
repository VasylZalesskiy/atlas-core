import {useEffect,useMemo,useRef,useState} from "react";
import {ArrowLeft,Camera,Check,ChevronRight,Copy,HandHeart,HeartHandshake,Inbox,LayoutGrid,MessagesSquare,Package,Pause,Pencil,Play,Plus,Search,Share2,Sparkles,Tag,Trash2,X} from "lucide-react";
import {Link,useSearchParams} from "react-router-dom";
import {addMyOpportunity,deleteMyOpportunity,loadIncomingRequests,loadMyPassport,loginAtlasAccount,logoutAtlasAccount,opportunityGroups,recordMyOpportunityFulfillment,registerAtlasAccount,respondToPassportRequest,saveMyPassport,setMyOpportunityActive,setMyOpportunityCompleted,uploadOpportunityPhoto} from "../services/passportStore";
import {loadNeedCatalog} from "../services/catalogStore";
import {loadMyGroups,setOpportunityVisibility} from "../services/groupStore";
import PassportAccountPanel from "../components/PassportAccountPanel";
import "../styles/passportMobileMenu.css";
const durations=[{value:"hour",label:"1 година"},{value:"day",label:"1 день"},{value:"month",label:"1 місяць"},{value:"year",label:"1 рік"}];
const paymentOptions=[{value:"free",label:"Безкоштовно"},{value:"paid",label:"За оплату"},{value:"exchange",label:"Обмін"},{value:"negotiable",label:"За домовленістю"}];
const servicePriceUnits=["шт.","година","консультація","послуга","день","поїздка","комплект"];const saleUnits=["кг","шт.","т","л","комплект"];const currencySymbols={UAH:"грн",USD:"$",EUR:"€"};
const emptyEntry=()=>({group:"have",text:"",duration:"month",place:"",radiusValue:"",radiusUnit:"км",online:false,paymentType:"free",priceValue:"",priceUnit:"шт.",currency:"UAH",saleQuantity:"",saleUnit:"кг",validUntil:"",catalogGroupKey:"",catalogItemKey:"",catalogItemName:"",minimumQuantity:"",deliveryIncluded:false,photoUrl:"",photoLabel:"",photoTask:"",visibilityScope:"global",groupIds:[]});
function friendlyError(error){const text=String(error?.message||error||"");if(/anonymous|signups|disabled/i.test(text))return "Не вдалося створити сесію Atlas.";if(/login-taken/i.test(text))return "Такий логін уже зайнятий.";if(/invalid-login/i.test(text))return "Неправильний логін або пароль.";if(/password-invalid/i.test(text))return "Пароль має містити щонайменше 8 символів.";if(/login-invalid/i.test(text))return "Логін має містити від 3 до 60 символів.";if(/relation .* does not exist/i.test(text))return "Один із модулів Atlas ще не активований.";if(/permission denied|row-level security/i.test(text))return "Немає доступу до цієї сторінки. Увійдіть під своїм логіном і паролем.";return text||"Не вдалося виконати дію."}
function cleanRequestMessage(value){return String(value||"").replace(/[\u200B-\u200D\u2060\u2062\u2063\uFEFF]*ATLAS_META:[^\r\n]*/gu,"").replace(/\n{3,}/g,"\n\n").trim()}
function OpportunityFields({value,onChange,textareaRef,compact=false,onPhoto,catalogGroups=[],catalogItems=[],availableGroups=[]}){
  const selling=value.group==="sell";const paid=selling||value.paymentType==="paid";const photo=value.photoUrl||value.photo_url;
  const activeGroups=catalogGroups.filter(item=>item.is_active!==false);
  const itemsForGroup=catalogItems.filter(item=>item.is_active!==false&&item.group_key===value.catalogGroupKey);
  function setOpportunityGroup(group){
    if(group!=="sell"){onChange({...value,group});return}
    const firstGroup=activeGroups[0]||null;
    const groupKey=value.catalogGroupKey||firstGroup?.group_key||"";
    const firstItem=catalogItems.find(item=>item.is_active!==false&&item.group_key===groupKey)||null;
    const itemKey=value.catalogItemKey||firstItem?.item_key||"";
    const selectedItem=catalogItems.find(item=>item.item_key===itemKey&&item.group_key===groupKey)||firstItem;
    const unit=selectedItem?.unit||"шт";
    onChange({...value,group,paymentType:"paid",catalogGroupKey:groupKey,catalogItemKey:selectedItem?.item_key||"",catalogItemName:selectedItem?.name_uk||"",priceUnit:unit==="шт"?"шт.":unit,saleUnit:unit==="шт"?"шт.":unit});
  }
  function setCatalogGroup(groupKey){
    const firstItem=catalogItems.find(item=>item.is_active!==false&&item.group_key===groupKey)||null;
    const unit=firstItem?.unit||"шт";
    onChange({...value,catalogGroupKey:groupKey,catalogItemKey:firstItem?.item_key||"",catalogItemName:firstItem?.name_uk||"",priceUnit:unit==="шт"?"шт.":unit,saleUnit:unit==="шт"?"шт.":unit});
  }
  function setCatalogItem(itemKey){
    const item=catalogItems.find(candidate=>candidate.item_key===itemKey&&candidate.group_key===value.catalogGroupKey);
    const unit=item?.unit||"шт";
    onChange({...value,catalogItemKey:itemKey,catalogItemName:item?.name_uk||"",priceUnit:unit==="шт"?"шт.":unit,saleUnit:unit==="шт"?"шт.":unit});
  }
  return <div className="opportunityFields">
<label><span>Тип можливості</span><select value={value.group} onChange={e=>setOpportunityGroup(e.target.value)}>{opportunityGroups.map(g=><option key={g.value} value={g.value}>{g.label}</option>)}</select></label>
{selling&&<><label><span>Категорія</span><select required value={value.catalogGroupKey||""} onChange={e=>setCatalogGroup(e.target.value)}><option value="" disabled>Оберіть категорію</option>{activeGroups.map(group=><option key={group.group_key} value={group.group_key}>{group.icon?`${group.icon} `:""}{group.name_uk}</option>)}</select></label><label><span>Що продаєте</span><select required value={value.catalogItemKey||""} onChange={e=>setCatalogItem(e.target.value)}><option value="" disabled>Оберіть позицію</option>{itemsForGroup.map(item=><option key={item.item_key} value={item.item_key}>{item.icon?`${item.icon} `:""}{item.name_uk}</option>)}</select><small>Atlas використовує той самий ідентифікатор, що й у Паспорті потреб.</small></label></>}
<label><span>{selling?"Опис (необов’язково)":"Можливість"}</span><textarea ref={textareaRef} required={!selling} maxLength={1100} value={value.text} onChange={e=>onChange({...value,text:e.target.value})} placeholder={selling?"Наприклад: рожеві, власне виробництво":"Наприклад: маю велосипед, можу продати"} style={{minHeight:compact?72:82}}/></label>
{!compact&&<div className="opportunityPhotoField">{photo?<div className="opportunityPhotoPreview"><img src={photo} alt="Фото можливості"/><span>{value.photoLabel||value.photo_label||"Фото додано"}</span><button type="button" onClick={()=>onChange({...value,photoUrl:"",photoLabel:"",photoTask:""})}><X size={16}/></button></div>:<label className="opportunityPhotoButton"><Camera size={19}/><span>Додати фото</span><input type="file" accept="image/*" capture="environment" onChange={onPhoto}/></label>}<small>Сфотографуйте річ. Після активації AI Atlas зможе визначати її та знаходити схожі.</small></div>}
{selling?<label><span>Діє до</span><input required type="date" value={value.validUntil||""} onChange={e=>onChange({...value,validUntil:e.target.value})}/></label>:<fieldset className="durationPicker"><legend>Актуальність</legend><div>{durations.map(i=><button type="button" className={value.duration===i.value?"active":""} key={i.value} onClick={()=>onChange({...value,duration:i.value})}>{i.label}</button>)}</div></fieldset>}
{!selling&&<label><span>Умови надання</span><select value={value.paymentType} onChange={e=>onChange({...value,paymentType:e.target.value})}>{paymentOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>}
{paid&&<div className="opportunityPrice"><label><span>Ціна</span><input required inputMode="decimal" value={value.priceValue} onChange={e=>onChange({...value,priceValue:e.target.value.replace(/[^0-9.,]/g,"").slice(0,14)})}/></label><label><span>Ціна за</span><select value={value.priceUnit} onChange={e=>onChange({...value,priceUnit:e.target.value})}>{(selling?saleUnits:servicePriceUnits).map(u=><option key={u}>{u}</option>)}</select></label><label><span>Валюта</span><select value={value.currency} onChange={e=>onChange({...value,currency:e.target.value})}><option value="UAH">грн</option><option value="USD">USD</option><option value="EUR">EUR</option></select></label></div>}
{selling&&<div className="opportunityPrice"><label><span>Кількість у продажу</span><input required inputMode="decimal" value={value.saleQuantity||""} onChange={e=>onChange({...value,saleQuantity:e.target.value.replace(/[^0-9.,]/g,"").slice(0,14)})}/></label><label><span>Одиниця</span><select value={value.saleUnit||"кг"} onChange={e=>onChange({...value,saleUnit:e.target.value})}>{saleUnits.map(u=><option key={u}>{u}</option>)}</select></label></div>}
<div className="opportunityLocation"><label><span>Місце</span><input value={value.place} onChange={e=>onChange({...value,place:e.target.value})}/></label><label><span>Радіус</span><input inputMode="decimal" value={value.radiusValue} onChange={e=>onChange({...value,radiusValue:e.target.value.replace(/[^0-9.,]/g,"")})}/></label></div>
<fieldset className="opportunityVisibility"><legend>Де показувати цю можливість?</legend>
  <select value={value.visibilityScope||"global"} onChange={e=>onChange({...value,visibilityScope:e.target.value,groupIds:e.target.value==="global"?[]:(value.groupIds||[])})}>
    <option value="global">Усім користувачам Atlas</option>
    <option value="groups" disabled={!availableGroups.length}>Тільки вибраним групам</option>
    <option value="both" disabled={!availableGroups.length}>Усім в Atlas + вибраним групам</option>
  </select>
  {(value.visibilityScope==="groups"||value.visibilityScope==="both")&&<div className="opportunityGroupChoices">
    {availableGroups.map(group=><label key={group.id}><input type="checkbox" checked={(value.groupIds||[]).includes(group.id)} onChange={e=>{const current=new Set(value.groupIds||[]);if(e.target.checked)current.add(group.id);else current.delete(group.id);onChange({...value,groupIds:[...current]})}}/><span>{group.name}</span></label>)}
  </div>}
  {!availableGroups.length&&<small>Груп ще немає. Їх можна створити у «Моя сторінка → Групи».</small>}
</fieldset></div>}
function opportunityMeta(item){return [item.group==="sell"&&item.catalogItemName?item.catalogItemName:"",paymentOptions.find(o=>o.value===item.paymentType)?.label,item.paymentType==="paid"&&item.priceValue?`${item.priceValue} ${currencySymbols[item.currency]||item.currency} / ${item.priceUnit}`:"",item.group==="sell"&&item.saleQuantity?`${item.saleQuantity} ${item.saleUnit||"кг"} у продажу`:"",item.group==="sell"&&item.validUntil?`до ${item.validUntil}`:"",item.group!=="sell"?durations.find(o=>o.value===item.duration)?.label:"",item.place].filter(Boolean)}
function repeatableOpportunity(item){return ["professional","help","additional","hobby","rent","free_use"].includes(item.group)}
export default function Profile({lang="uk"}){
  const addRef=useRef(null),textareaRef=useRef(null);
  const [searchParams,setSearchParams]=useSearchParams();
  const requestedView=searchParams.get("view");
  const mobileView=["editor","records","rename","identity"].includes(requestedView)?requestedView:"menu";
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[adding,setAdding]=useState(false),[photoBusy,setPhotoBusy]=useState(false),[busyId,setBusyId]=useState("");
  const [error,setError]=useState(""),[notice,setNotice]=useState(""),[editingIdentity,setEditingIdentity]=useState(false);
  const [showMoreGroups,setShowMoreGroups]=useState(false);
  const [showArchive,setShowArchive]=useState(false);
  const [nameDraft,setNameDraft]=useState("");
  const [accounts,setAccounts]=useState([]),[passports,setPassports]=useState([]),[passport,setPassport]=useState(null),[activeAccountId,setActiveAccountId]=useState(null);
  const [opportunities,setOpportunities]=useState([]),[requests,setRequests]=useState([]),[catalog,setCatalog]=useState({groups:[],items:[]}),[availableGroups,setAvailableGroups]=useState([]);
  const [form,setForm]=useState({entityType:"person",displayName:"",city:"",contact:"",profession:"",skills:""}),[entry,setEntry]=useState(emptyEntry);
  useEffect(()=>{if(mobileView!=="identity"&&passport)setEditingIdentity(false)},[mobileView,passport?.id]);

  const shareUrl=useMemo(()=>passport?.slug?window.location.origin+"/p/"+passport.slug:"",[passport?.slug]);
  const activeCount=opportunities.filter(i=>i.is_active&&!i.completedAt).length;
  const archivedCount=opportunities.filter(i=>i.completedAt).length;
  const visibleOpportunities=opportunities.filter(i=>Boolean(i.completedAt)===showArchive);
  const pendingRequests=useMemo(()=>requests.filter(i=>i.status==="pending"),[requests]);

  function blankForm(){return {entityType:"person",displayName:"",city:"",contact:"",profession:"",skills:""}}
  async function applyPassportData(d){
    setAccounts(d.accounts||[]);
    setPassports(d.passports||[]);
    setPassport(d.passport||null);
    setActiveAccountId(d.passport?.account_id||d.accounts?.[0]?.account_id||null);
    setOpportunities(d.opportunities||[]);
    setForm({entityType:d.passport?.entity_type||"person",displayName:d.passport?.display_name||"",city:d.passport?.city||"",contact:d.contact||"",profession:d.passport?.profession||"",skills:d.passport?.skills||""});
    if(d.passport?.city){try{localStorage.setItem("atlas-city",d.passport.city)}catch{}}
    if(d.passport?.id){try{setRequests(await loadIncomingRequests(d.passport.id))}catch{setRequests([])}}else setRequests([]);
  }
  async function reloadProfile(passportId=null,{showLoader=false}={}){
    if(showLoader)setLoading(true);
    setError("");
    try{
      const [d,catalogData,groupData]=await Promise.all([loadMyPassport(passportId),loadNeedCatalog().catch(()=>({groups:[],items:[]})),loadMyGroups().catch(()=>[])]);
      setCatalog(catalogData);
      setAvailableGroups(groupData||[]);
      await applyPassportData(d);
      return d;
    }catch(cause){setError(friendlyError(cause));throw cause}
    finally{if(showLoader)setLoading(false)}
  }

  useEffect(()=>{
    let alive=true;
    Promise.all([loadMyPassport(),loadNeedCatalog().catch(()=>({groups:[],items:[]})),loadMyGroups().catch(()=>[])]).then(async ([d,catalogData,groupData])=>{
      if(!alive)return;
      setCatalog(catalogData);
      setAvailableGroups(groupData||[]);
      setAccounts(d.accounts||[]);setPassports(d.passports||[]);setPassport(d.passport||null);setActiveAccountId(d.passport?.account_id||d.accounts?.[0]?.account_id||null);
      setOpportunities(d.opportunities||[]);
      setForm({entityType:d.passport?.entity_type||"person",displayName:d.passport?.display_name||"",city:d.passport?.city||"",contact:d.contact||"",profession:d.passport?.profession||"",skills:d.passport?.skills||""});
      if(d.passport?.city){try{localStorage.setItem("atlas-city",d.passport.city)}catch{}}
      if(d.passport?.id){try{setRequests(await loadIncomingRequests(d.passport.id))}catch{}}
    }).catch(e=>alive&&setError(friendlyError(e))).finally(()=>alive&&setLoading(false));
    return()=>{alive=false};
  },[]);

  useEffect(()=>{
    if(!passport?.id)return;
    let alive=true;
    let busy=false;
    const refreshIncoming=async()=>{
      if(busy||!alive||document.visibilityState==="hidden")return;
      busy=true;
      try{
        const next=await loadIncomingRequests(passport.id);
        if(alive)setRequests(next||[]);
      }catch{}finally{busy=false}
    };
    const onVisible=()=>{if(document.visibilityState==="visible")refreshIncoming()};
    const onFocus=()=>refreshIncoming();
    const timer=setInterval(refreshIncoming,12000);
    document.addEventListener("visibilitychange",onVisible);
    window.addEventListener("focus",onFocus);
    refreshIncoming();
    return()=>{
      alive=false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange",onVisible);
      window.removeEventListener("focus",onFocus);
    };
  },[passport?.id]);

  async function accountLogin(login,password){await loginAtlasAccount(login,password);await reloadProfile(null,{showLoader:true});window.dispatchEvent(new Event("atlas:account-changed"));setNotice("Вхід виконано. Ваші сторінки завантажено.")}
  async function accountRegister(login,password){await registerAtlasAccount(login,password);await reloadProfile(null,{showLoader:true});window.dispatchEvent(new Event("atlas:account-changed"));setNotice("Доступ створено. Тепер ці сторінки можна відкрити на іншому пристрої за логіном і паролем.")}
  async function accountLogout(){setError("");setNotice("");await logoutAtlasAccount();window.location.replace("/")}
  async function selectPassport(id){if(!id)return;await reloadProfile(id,{showLoader:true});setEditingIdentity(false);openMobileView("menu");setNotice("")}
  function createNewPassport(accountId){
    setPassport(null);setOpportunities([]);setRequests([]);setEntry(emptyEntry());setForm(blankForm());setEditingIdentity(true);openMobileView("menu");setActiveAccountId(accountId||accounts[0]?.account_id||null);setError("");setNotice("Заповніть дані нової сторінки.");
    try{localStorage.removeItem("atlas-active-passport")}catch{}
  }

  function openMobileView(view){setSearchParams(previous=>{const next=new URLSearchParams(previous);if(view==="menu")next.delete("view");else next.set("view",view);return next});setError("");window.scrollTo({top:0,behavior:"auto"})}
  function scrollToAdd(){openMobileView("editor");if(window.innerWidth>760){requestAnimationFrame(()=>addRef.current?.scrollIntoView({behavior:"smooth",block:"start"}));setTimeout(()=>textareaRef.current?.focus(),320)}}
  function chooseOpportunityGroup(group){
    setEntry(current=>{
      if(group!=="sell")return {...current,group};
      const catalogGroup=catalog.groups.find(item=>item.is_active!==false);
      const catalogItem=catalog.items.find(item=>item.is_active!==false&&item.group_key===catalogGroup?.group_key);
      const unit=catalogItem?.unit==="шт"?"шт.":catalogItem?.unit||"кг";
      return {...current,group,paymentType:"paid",catalogGroupKey:catalogGroup?.group_key||"",catalogItemKey:catalogItem?.item_key||"",catalogItemName:catalogItem?.name_uk||"",priceUnit:unit,saleUnit:unit};
    });
    setShowMoreGroups(false);
    scrollToAdd();
  }
  async function savePassport(e){
    e.preventDefault();setSaving(true);setError("");
    try{
      const saved=await saveMyPassport({...form,passportId:passport?.id||null,accountId:passport?.account_id||activeAccountId||accounts[0]?.account_id||null});
      if(form.city.trim()){try{localStorage.setItem("atlas-city",form.city.trim())}catch{}}
      await reloadProfile(saved.id);
      setEditingIdentity(false);openMobileView("menu");
      setNotice(passport?.id?"Паспорт збережено.":"Нову сторінку Atlas створено.");
    }catch(cause){setError(friendlyError(cause))}finally{setSaving(false)}
  }
  async function savePassportName(e){
    e.preventDefault();setSaving(true);setError("");
    try{
      await saveMyPassport({...form,displayName:nameDraft,passportId:passport.id,accountId:passport.account_id||activeAccountId});
      await reloadProfile(passport.id);
      openMobileView("menu");setNotice("Назву сторінки змінено.");
    }catch(cause){setError(friendlyError(cause))}finally{setSaving(false)}
  }
  async function addPhoto(e){const file=e.target.files?.[0];if(!file)return;setPhotoBusy(true);setError("");try{const uploaded=await uploadOpportunityPhoto(file);let label="";try{const reader=new FileReader();const image=await new Promise((resolve,reject)=>{reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});const r=await fetch("/api/vision",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image,lang:"uk"})});const data=await r.json();if(r.ok)label=data.name||""}catch{}setEntry(v=>({...v,photoUrl:uploaded.url,photoLabel:label,photoTask:label?("Знайти схоже: "+label):""}));setNotice(label?("Фото додано · "+label):"Фото додано. Розпізнавання запрацює після активації AI.")}catch(cause){setError(friendlyError(cause))}finally{setPhotoBusy(false)}}
  async function addOpportunity(e){e.preventDefault();if(adding||photoBusy||!passport?.id)return;if(entry.group!=="sell"&&!entry.text.trim())return;if((entry.visibilityScope==="groups"||entry.visibilityScope==="both")&&!(entry.groupIds||[]).length){setError("Оберіть хоча б одну групу.");return}if(entry.group==="sell"){if(!entry.catalogGroupKey||!entry.catalogItemKey){setError("Для продажу виберіть категорію та позицію зі списку.");return}if(!entry.priceValue||!entry.saleQuantity||!entry.validUntil){setError("Для продажу вкажіть ціну, кількість і термін дії.");return}if(entry.validUntil<new Date().toISOString().slice(0,10)){setError("Термін продажу не може бути в минулому.");return}}setError("");setAdding(true);let created=null;try{const prepared=entry.group==="sell"?{...entry,text:entry.text.trim()||entry.catalogItemName}:entry;created=await addMyOpportunity(passport.id,prepared);if(prepared.visibilityScope==="groups"||prepared.visibilityScope==="both")await setOpportunityVisibility({opportunityId:created.id,visibilityScope:prepared.visibilityScope,groupIds:prepared.groupIds||[]});setOpportunities(x=>[created,...x]);setEntry(v=>({...emptyEntry(),group:v.group,...(v.group==="sell"?{paymentType:"paid",priceUnit:"кг",saleUnit:"кг"}:{})}));setNotice("Можливість додано до Паспорта.");openMobileView("records")}catch(cause){if(created?.id)await deleteMyOpportunity(created.id).catch(()=>{});setError(friendlyError(cause))}finally{setAdding(false)}}
  async function toggleOpportunity(i){setBusyId(i.id);try{const u=await setMyOpportunityActive(i.id,!i.is_active);setOpportunities(x=>x.map(v=>v.id===u.id?u:v))}catch(cause){setError(friendlyError(cause))}finally{setBusyId("")}}
  async function completeOpportunity(item,completed){setBusyId(item.id);setError("");try{const updated=await setMyOpportunityCompleted(item,completed);setOpportunities(items=>items.map(value=>value.id===updated.id?updated:value));setNotice(completed?"Пропозицію завершено й перенесено в архів.":"Можливість повернуто до активних.")}catch(cause){setError(friendlyError(cause))}finally{setBusyId("")}}
  async function recordFulfillment(item){setBusyId(item.id);setError("");try{const updated=await recordMyOpportunityFulfillment(item);setOpportunities(items=>items.map(value=>value.id===updated.id?updated:value));setNotice("Виконання зараховано. Можливість залишається активною.")}catch(cause){setError(friendlyError(cause))}finally{setBusyId("")}}
  async function removeOpportunity(id){if(!confirm("Видалити цю можливість?"))return;setBusyId(id);try{await deleteMyOpportunity(id);setOpportunities(x=>x.filter(i=>i.id!==id))}catch(cause){setError(friendlyError(cause))}finally{setBusyId("")}}
  async function answerRequest(id,status){setBusyId(id);try{const u=await respondToPassportRequest(id,status,passport?.id);setRequests(x=>x.map(i=>i.id===id?{...i,...u}:i))}catch(cause){setError(friendlyError(cause))}finally{setBusyId("")}}
  async function copyLink(){if(shareUrl){await navigator.clipboard.writeText(shareUrl);setNotice("Посилання скопійовано.")}}
  async function sharePassport(){if(navigator.share){await navigator.share({title:"Atlas",url:shareUrl}).catch(()=>{});return}await copyLink()}

  if(loading)return <main className="page appPage"><section className="profileShell"><p>Відкриваю ваші сторінки Atlas…</p></section></main>;
  return <main className={`page appPage passportMobileView-${mobileView}`}>
    <PassportAccountPanel accounts={accounts} passports={passports} activePassportId={passport?.id||""} onLogin={accountLogin} onRegister={accountRegister} onSelect={selectPassport} onNew={createNewPassport} onLogout={accountLogout}/>
    <section className="profileShell passportPage">
      <div className={passport?"passportHeading passportDesktopIntro":"passportHeading"}><div><span className="kicker">ATLAS · ПАСПОРТ МОЖЛИВОСТЕЙ</span><h1>{passport?"Ваш Паспорт":"Створіть Паспорт"}</h1><p>Людина або компанія описує, що має, вміє або може надати. Твої можливості — це частинка чиєїсь задачі.</p></div>{passport&&<div className="passportCounter"><strong>{activeCount}</strong><span>активних</span></div>}</div>
      {passport&&<div className="passportMobileMenu">
        <span className="passportMobileKicker">МОЇ МОЖЛИВОСТІ</span>
        <h1>Що можете запропонувати?</h1>
        <div className="passportMobileIdentity"><span className="passportMobileAvatar">{form.displayName?.trim().charAt(0).toUpperCase()||"А"}</span><span><strong>{form.displayName}{form.city?` · ${form.city}`:""}</strong><small>Моя сторінка Atlas</small></span><button type="button" className="passportEditName" onClick={()=>{setNameDraft(form.displayName);openMobileView("rename")}} aria-label="Редагувати назву сторінки"><Pencil size={16}/><span>Редагувати</span></button></div>
        <div className="passportQuickGrid">
          <button type="button" onClick={()=>chooseOpportunityGroup("have")}><span className="quickIcon have"><Package size={23}/></span><strong>Я маю</strong><small>Товар або річ</small></button>
          <button type="button" onClick={()=>chooseOpportunityGroup("sell")}><span className="quickIcon sell"><Tag size={23}/></span><strong>Продам</strong><small>Із ціною</small></button>
          <button type="button" onClick={()=>chooseOpportunityGroup("professional")}><span className="quickIcon skill"><Sparkles size={23}/></span><strong>Вмію</strong><small>Навички й послуги</small></button>
          <button type="button" onClick={()=>chooseOpportunityGroup("help")}><span className="quickIcon help"><HandHeart size={23}/></span><strong>Допоможу</strong><small>Безкоштовно</small></button>
        </div>
        <button type="button" className="passportMoreButton" aria-expanded={showMoreGroups} onClick={()=>setShowMoreGroups(value=>!value)}><Plus size={18}/>Інші категорії<ChevronRight size={19}/></button>
        {showMoreGroups&&<div className="passportMoreGroups">{opportunityGroups.filter(group=>!["have","sell","professional","help"].includes(group.value)).map(group=><button type="button" key={group.value} onClick={()=>chooseOpportunityGroup(group.value)}>{group.label}<ChevronRight size={16}/></button>)}</div>}
        <span className="passportMobileKicker passportMenuLabel">ВАШ ПАСПОРТ</span>
        <button type="button" className="passportMenuRow" onClick={()=>{setEditingIdentity(true);openMobileView("identity")}}><span className="menuIcon"><Pencil size={20}/></span><span><strong>Мої дані</strong><small>Ім’я, місто та приватний контакт</small></span><ChevronRight size={20}/></button>
        <button type="button" className="passportMenuRow" onClick={()=>openMobileView("records")}><span className="menuIcon"><LayoutGrid size={20}/></span><span><strong>Мої записи</strong><small>{opportunities.length-archivedCount} актуальних · {archivedCount} в архіві</small></span><ChevronRight size={20}/></button>
        <Link className="passportMenuRow" to="/matches?mode=opportunity"><span className="menuIcon"><Search size={20}/></span><span><strong>Знайти потреби</strong><small>Пошук запускається лише за вашою командою</small></span><ChevronRight size={20}/></Link>
        <Link className="passportMenuRow" to="/messages"><span className="menuIcon"><MessagesSquare size={20}/></span><span><strong>Повідомлення</strong><small>{pendingRequests.length?`${pendingRequests.length} нових звернень`:"Ваші розмови"}</small></span>{pendingRequests.length>0&&<b className="passportMenuBadge">{pendingRequests.length>99?"99+":pendingRequests.length}</b>}<ChevronRight size={20}/></Link>
      </div>}
      {passport&&mobileView==="rename"&&<section className="passportRenameScreen"><button type="button" className="passportMobileBack" onClick={()=>openMobileView("menu")}><ArrowLeft size={18}/>Можливості</button><h2>Назва сторінки</h2><form onSubmit={savePassportName}><label htmlFor="passport-new-name">Як називатиметься ваша сторінка?</label><input id="passport-new-name" required maxLength={100} value={nameDraft} onChange={e=>setNameDraft(e.target.value)}/><button type="submit" className="primary" disabled={saving||!nameDraft.trim()}>{saving?"Зберігаю…":"Зберегти назву"}</button></form></section>}
      {passport&&editingIdentity&&<button type="button" className="passportMobileBack" onClick={()=>{setEditingIdentity(false);openMobileView("menu")}}><ArrowLeft size={18}/>Можливості</button>}
      {passport&&!editingIdentity?<section className="passportIdentitySummary"><div><strong>{form.displayName}</strong>{form.city&&<span>{form.city}</span>}</div><button type="button" className="secondary" onClick={()=>setEditingIdentity(true)}>Змінити дані</button></section>:<form className="passportIdentity" onSubmit={savePassport}><label><span>Тип Паспорта</span><select value={form.entityType} onChange={e=>setForm({...form,entityType:e.target.value})}><option value="person">Людина</option><option value="company">Компанія / організація</option></select></label><label><span>{form.entityType==="company"?"Назва компанії":"Ім’я або псевдонім"}</span><input required value={form.displayName} onChange={e=>setForm({...form,displayName:e.target.value})}/></label><label><span>Місто / район</span><input value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/></label><label className="contactField"><span>Приватні контактні дані</span><input required value={form.contact} onChange={e=>setForm({...form,contact:e.target.value})}/></label><div className="passportIdentityButtons"><button className="secondary" disabled={saving}>{saving?"Зберігаю…":passport?"Зберегти зміни":"Створити Паспорт"}</button>{passport&&<button type="button" className="secondary" onClick={()=>{setEditingIdentity(false);openMobileView("menu")}}>Скасувати</button>}</div></form>}
      {passport&&<>
        <section className="passportActions"><Link className="secondary passportMessagesShortcut" to="/messages"><MessagesSquare size={18}/>Повідомлення{pendingRequests.length>0&&<b>{pendingRequests.length>99?"99+":pendingRequests.length}</b>}</Link><button className="primary" type="button" onClick={scrollToAdd}><Plus size={19}/>Додати можливість</button><Link className="secondary" to="/matches?mode=opportunity"><Search size={18}/>Знайти потреби</Link><Link className="needsShortcut" to="/needs"><HeartHandshake size={18}/>Мої потреби</Link><button className="secondary" type="button" onClick={sharePassport}><Share2 size={17}/>Поділитися</button><button className="secondary iconButton" type="button" onClick={copyLink}><Copy size={17}/></button></section>
        <section className="opportunityEditor" ref={addRef}><button type="button" className="passportMobileBack" onClick={()=>openMobileView("menu")}><ArrowLeft size={18}/>Можливості</button><div className="sectionTitle"><div><span>НОВА МОЖЛИВІСТЬ</span><h2>{opportunityGroups.find(group=>group.value===entry.group)?.label||"Додати можливість"}</h2></div></div><form onSubmit={addOpportunity}><OpportunityFields value={entry} onChange={setEntry} textareaRef={textareaRef} onPhoto={addPhoto} catalogGroups={catalog.groups} catalogItems={catalog.items} availableGroups={availableGroups}/><button className="primary addOpportunity" disabled={adding||photoBusy||(entry.group!=="sell"&&!entry.text.trim())}><Plus size={18}/>{photoBusy?"Додаю фото…":adding?"Додаю…":"Додати до Паспортa"}</button></form></section>
        <section id="passport-records" className="opportunityGroups"><button type="button" className="passportMobileBack" onClick={()=>openMobileView("menu")}><ArrowLeft size={18}/>Можливості</button><div className="sectionTitle"><div><span>МОЇ МОЖЛИВОСТІ</span><h2>{showArchive?"Архів":`${visibleOpportunities.length} записів`}</h2></div></div><div className="passportArchiveTabs" role="tablist" aria-label="Статус можливостей"><button type="button" role="tab" aria-selected={!showArchive} className={!showArchive?"active":""} onClick={()=>setShowArchive(false)}>Актуальні <b>{opportunities.length-archivedCount}</b></button><button type="button" role="tab" aria-selected={showArchive} className={showArchive?"active":""} onClick={()=>setShowArchive(true)}>Архів <b>{archivedCount}</b></button></div>{visibleOpportunities.length===0&&<p className="groupEmpty">{showArchive?"Виконаних можливостей ще немає.":"Актуальних можливостей ще немає. Додайте першу з меню."}</p>}{opportunityGroups.filter(g=>visibleOpportunities.some(i=>i.group===g.value)).map(g=>{const items=visibleOpportunities.filter(i=>i.group===g.value);return <details className="opportunityGroup" key={g.value} open><summary><span>{g.label}</span><b>{items.length}</b></summary><div className="opportunityList">{items.map(i=><article className={"opportunityCard "+(i.is_active?"":"paused")} key={i.id}>{i.photo_url&&<img className="opportunityCardPhoto" src={i.photo_url} alt={i.photo_label||i.text}/>}<div className="opportunityCopy"><p>{i.catalogItemName||i.text}</p>{i.catalogItemName&&i.text&&i.text!==i.catalogItemName&&<small>{i.text}</small>}{i.photo_label&&<small>{i.photo_label}</small>}<div className="opportunityMeta">{opportunityMeta(i).map(v=><span key={v}>{v}</span>)}{i.fulfillmentCount>0&&<span>Виконано {i.fulfillmentCount} разів{i.lastFulfilledAt?` · останнє ${new Date(i.lastFulfilledAt).toLocaleDateString("uk-UA")}`:""}</span>}<span>{i.visibility_scope==="groups"?"Лише групи":i.visibility_scope==="both"?"Atlas + групи":"Увесь Atlas"}</span></div></div><div className="recordActions">{i.completedAt?<button type="button" disabled={busyId===i.id} onClick={()=>completeOpportunity(i,false)}><Play size={16}/>Повернути</button>:<><Link className="secondary" to={`/matches?mode=opportunity&opportunity=${i.id}`}><Search size={16}/>Знайти потреби</Link>{repeatableOpportunity(i)&&<button type="button" disabled={busyId===i.id} onClick={()=>recordFulfillment(i)}><Check size={16}/>Виконання +1</button>}<button type="button" disabled={busyId===i.id} onClick={()=>completeOpportunity(i,true)}><Check size={16}/>Завершити · архів</button><button type="button" disabled={busyId===i.id} onClick={()=>toggleOpportunity(i)}>{i.is_active?<><Pause size={16}/>Призупинити</>:<><Play size={16}/>Активувати</>}</button></>}<button className="deleteAction" type="button" onClick={()=>removeOpportunity(i.id)}><Trash2 size={16}/>Видалити</button></div></article>)}</div></details>})}</section>
        
      </>}
      {error&&<div className="error">{error}</div>}{notice&&<div className="success">{notice}</div>}
    </section>
  </main>;
}
