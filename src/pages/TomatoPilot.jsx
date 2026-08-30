import {useEffect,useState} from "react";
import {ArrowLeft,Check,Clock3,MapPin,PackageCheck,RefreshCw,ShieldCheck,ShoppingBasket,XCircle} from "lucide-react";
import {Link} from "react-router-dom";
import {cancelMyTomatoOrder,createTomatoOrder,loadTomatoPilot,tomatoPilotErrorMessage} from "../services/tomatoPilotStore";
import "../styles/tomatoPilot.css";

const statusCopy={
  uk:{
    requested:{label:"Заявку прийнято",note:"Ми зарезервували ваші 5 кг."},
    ready:{label:"Готово до видачі",note:"Помідори вже можна забрати у вибраний час."},
    received:{label:"Отримано",note:"Видачу завершено. Дякуємо за участь у пілоті Atlas."},
    cancelled:{label:"Заявку скасовано",note:"Резерв повернуто до загального залишку."}
  },
  en:{
    requested:{label:"Request received",note:"We reserved your 5 kg."},
    ready:{label:"Ready for pickup",note:"Your tomatoes are ready at the selected time."},
    received:{label:"Received",note:"Pickup is complete. Thank you for joining the Atlas pilot."},
    cancelled:{label:"Request cancelled",note:"The reserved amount was returned to availability."}
  }
};

function quantity(value){return new Intl.NumberFormat("uk-UA",{maximumFractionDigits:0}).format(Number(value)||0)}

export default function TomatoPilot({lang="uk"}){
  const uk=lang!=="en";
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [pilot,setPilot]=useState(null);
  const [order,setOrder]=useState(null);
  const [name,setName]=useState("");
  const [apartment,setApartment]=useState("");
  const [pickupSlot,setPickupSlot]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  async function refresh(showLoader=false){
    if(showLoader)setLoading(true);
    try{
      const state=await loadTomatoPilot();
      setPilot(state.pilot);setOrder(state.order);setError("");
      setPickupSlot(current=>current||state.pilot.pickup_slots[0]||"");
    }catch(e){setError(tomatoPilotErrorMessage(e,lang))}
    finally{if(showLoader)setLoading(false)}
  }

  useEffect(()=>{
    let alive=true;
    loadTomatoPilot().then(state=>{
      if(!alive)return;
      setPilot(state.pilot);setOrder(state.order);setPickupSlot(state.pilot.pickup_slots[0]||"");
    }).catch(e=>{if(alive)setError(tomatoPilotErrorMessage(e,lang))}).finally(()=>{if(alive)setLoading(false)});
    const onVisible=()=>{if(document.visibilityState==="visible")refresh(false)};
    document.addEventListener("visibilitychange",onVisible);
    return()=>{alive=false;document.removeEventListener("visibilitychange",onVisible)};
  },[lang]);

  const activeOrder=order&&order.status!=="cancelled"?order:null;
  const copy=order?statusCopy[uk?"uk":"en"][order.status]:null;
  const reservedPercent=pilot?.total_kg?Math.min(100,Math.round((pilot.reserved_kg/pilot.total_kg)*100)):0;
  const unavailable=!pilot?.enabled||pilot?.remaining_kg<Number(pilot?.kg_per_apartment||5);

  async function submit(event){
    event.preventDefault();if(busy)return;
    setBusy("create");setError("");setNotice("");
    try{
      const next=await createTomatoOrder({customerName:name,apartmentNumber:apartment,pickupSlot});
      setOrder(next);setNotice(uk?"Готово — 5 кг зарезервовано за вашою квартирою.":"Done — 5 kg is reserved for your apartment.");
      await refresh(false);
    }catch(e){setError(tomatoPilotErrorMessage(e,lang))}
    finally{setBusy("")}
  }

  async function cancel(){
    if(!activeOrder||busy)return;
    const confirmed=window.confirm(uk?"Скасувати заявку і повернути 5 кг до загального залишку?":"Cancel the request and return 5 kg to availability?");
    if(!confirmed)return;
    setBusy("cancel");setError("");setNotice("");
    try{
      const next=await cancelMyTomatoOrder(activeOrder.id);setOrder(next);
      setNotice(uk?"Заявку скасовано. Ви можете створити нову.":"Request cancelled. You can create a new one.");
      await refresh(false);
    }catch(e){setError(tomatoPilotErrorMessage(e,lang))}
    finally{setBusy("")}
  }

  if(loading)return <main className="tomatoPilotPage"><section className="tomatoLoading"><RefreshCw className="spin"/><h1>{uk?"Відкриваю видачу помідорів…":"Opening tomato pickup…"}</h1></section></main>;

  return <main className="tomatoPilotPage">
    <section className="tomatoPilotShell">
      <Link className="tomatoBack" to="/"><ArrowLeft size={18}/>{uk?"На головну":"Home"}</Link>

      <header className="tomatoHero">
        <div className="tomatoHeroCopy">
          <span className="tomatoEyebrow">ATLAS · {uk?"ПІЛОТ У БУДИНКУ":"BUILDING PILOT"}</span>
          <h1>{uk?"5 кг помідорів безкоштовно":"5 kg of tomatoes for free"}</h1>
          <p>{uk?"Одна заявка на квартиру. 170 квартир · 850 кг для першої перевірки Atlas.":"One request per apartment. 170 apartments · 850 kg for the first Atlas pilot."}</p>
          <div className="tomatoFree"><Check size={18}/><strong>{uk?"До сплати: 0 грн":"To pay: ₴0"}</strong><span>{uk?"без картки й передоплати":"no card or prepayment"}</span></div>
        </div>
        <div className="tomatoIllustration" aria-hidden="true"><span>🍅</span><b>5 кг</b></div>
      </header>

      {pilot&&<section className="tomatoAvailability" aria-label={uk?"Залишок":"Availability"}>
        <div className="tomatoAvailabilityHead"><div><small>{uk?"ДОСТУПНО ЗАРАЗ":"AVAILABLE NOW"}</small><strong>{quantity(pilot.remaining_kg)} кг</strong></div><div><small>{uk?"КВАРТИР ІЗ ЗАЯВКОЮ":"APARTMENTS REQUESTED"}</small><strong>{pilot.order_count} / {pilot.building_apartments}</strong></div></div>
        <div className="tomatoProgress"><span style={{width:`${reservedPercent}%`}}></span></div>
        <p>{uk?`Зарезервовано ${quantity(pilot.reserved_kg)} із ${quantity(pilot.total_kg)} кг. Залишилося наборів: ${pilot.remaining_apartments}.`:`${quantity(pilot.reserved_kg)} of ${quantity(pilot.total_kg)} kg reserved. Sets remaining: ${pilot.remaining_apartments}.`}</p>
      </section>}

      {(error||notice)&&<div className={`tomatoMessage ${error?"errorState":"successState"}`} role="status" aria-live="polite">{error||notice}</div>}

      {activeOrder?<section className={`tomatoOrderCard status-${activeOrder.status}`}>
        <div className="tomatoOrderIcon">{activeOrder.status==="received"?<PackageCheck size={32}/>:activeOrder.status==="ready"?<ShoppingBasket size={32}/>:<Clock3 size={32}/>}</div>
        <div className="tomatoOrderCopy"><span>{uk?"ВАША ЗАЯВКА":"YOUR REQUEST"}</span><h2>{copy.label}</h2><p>{copy.note}</p></div>
        <dl>
          <div><dt>{uk?"Квартира":"Apartment"}</dt><dd>№ {activeOrder.apartment_number}</dd></div>
          <div><dt>{uk?"Кількість":"Quantity"}</dt><dd>{quantity(activeOrder.quantity_kg)} кг</dd></div>
          <div><dt>{uk?"Час":"Time"}</dt><dd>{activeOrder.pickup_slot}</dd></div>
          <div><dt>{uk?"Оплата":"Payment"}</dt><dd>0 грн</dd></div>
        </dl>
        {pilot&&<div className="tomatoPickup"><MapPin size={20}/><div><strong>{uk?pilot.pickup_title_uk:pilot.pickup_title_en}</strong><span>{uk?pilot.pickup_details_uk:pilot.pickup_details_en}</span></div></div>}
        {activeOrder.status!=="received"&&<button className="tomatoCancel" type="button" onClick={cancel} disabled={busy==="cancel"}><XCircle size={17}/>{busy==="cancel"?(uk?"Скасовую…":"Cancelling…"):(uk?"Скасувати заявку":"Cancel request")}</button>}
      </section>:<section className="tomatoFormCard">
        <div className="tomatoFormHeading"><div><span aria-hidden="true" style={{fontSize:25}}>🍅</span></div><span><small>{uk?"ЗАЯВКА ЗА 1 ХВИЛИНУ":"ONE-MINUTE REQUEST"}</small><h2>{uk?"Зарезервувати 5 кг":"Reserve 5 kg"}</h2></span></div>
        {order?.status==="cancelled"&&<div className="tomatoCancelledNote"><XCircle size={18}/><span>{copy.label}. {uk?"Нижче можна створити нову заявку.":"You can create a new request below."}</span></div>}
        <form onSubmit={submit}>
          <label><span>{uk?"Ім’я мешканця":"Resident name"}</span><input required minLength={2} maxLength={80} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder={uk?"Наприклад: Василь":"For example: Vasyl"}/></label>
          <label><span>{uk?"Номер квартири":"Apartment number"}</span><input required type="number" inputMode="numeric" min="1" max={pilot?.building_apartments||170} value={apartment} onChange={e=>setApartment(e.target.value)} placeholder="1–170"/></label>
          <label className="tomatoSlotField"><span>{uk?"Зручний час видачі":"Preferred pickup time"}</span><select required value={pickupSlot} onChange={e=>setPickupSlot(e.target.value)}>{pilot?.pickup_slots.map(slot=><option key={slot} value={slot}>{slot}</option>)}</select></label>
          <button type="submit" disabled={busy==="create"||unavailable}>{busy==="create"?<RefreshCw className="spin" size={20}/>:<ShoppingBasket size={20}/>}<span>{busy==="create"?(uk?"Зберігаю заявку…":"Saving request…"):unavailable?(uk?"Прийом заявок призупинено":"Requests are paused"):(uk?"Отримати 5 кг безкоштовно":"Get 5 kg for free")}</span></button>
        </form>
        <div className="tomatoPrivacy"><ShieldCheck size={18}/><span>{uk?"Ім’я та номер квартири бачить лише організатор видачі. Atlas не просить банківську картку.":"Only the pickup organizer can see the name and apartment number. Atlas does not ask for a bank card."}</span></div>
      </section>}

      <section className="tomatoFlow">
        <h2>{uk?"Як це працює":"How it works"}</h2>
        <ol><li><b>1</b><span><strong>{uk?"Потреба":"Need"}</strong><small>{uk?"Обираєте 5 кг":"Choose 5 kg"}</small></span></li><li><b>2</b><span><strong>{uk?"Заявка":"Request"}</strong><small>{uk?"Atlas резервує набір":"Atlas reserves a set"}</small></span></li><li><b>3</b><span><strong>{uk?"Отримано":"Received"}</strong><small>{uk?"Організатор підтверджує видачу":"Organizer confirms pickup"}</small></span></li></ol>
      </section>
    </section>
  </main>;
}
