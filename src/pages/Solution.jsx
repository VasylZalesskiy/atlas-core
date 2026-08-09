import {useEffect,useMemo,useState} from "react";
import {Link,useLocation} from "react-router-dom";
import {ArrowLeft,Car,Clock3,Hospital,MapPin,MessageCircle,Navigation,Phone,Pill,RefreshCw,Search,ShoppingCart,UserRound,Utensils} from "lucide-react";
import {parseGoal} from "../brain/GoalParser";
import {searchPassportProfiles} from "../services/passportSearch";
import {findNearbyFood} from "../services/foodPlaces";
import {findNearbyMedical,getDrivingRoute,openOsmDirections} from "../services/medicalPlaces";
import {findNearbyVehicleDealers} from "../services/vehiclePlaces";
import useGeolocation from "../hooks/useGeolocation";
import "../styles/simpleSolution.css";

function formatDistance(value){
  if(!Number.isFinite(value))return "";
  if(value<1)return `${Math.max(10,Math.round(value*1000/10)*10)} м`;
  return `${value<10?value.toFixed(1):Math.round(value)} км`;
}

function approxWalkMinutes(distanceKm){
  if(!Number.isFinite(distanceKm)||distanceKm>3)return null;
  return Math.max(1,Math.round(distanceKm/4.5*60));
}

function iconFor(kind){
  if(kind==="passport")return <UserRound size={25}/>;
  if(kind==="meal")return <Utensils size={25}/>;
  if(kind==="grocery")return <ShoppingCart size={25}/>;
  if(kind==="hospital")return <Hospital size={25}/>;
  if(kind==="pharmacy")return <Pill size={25}/>;
  if(kind==="dealer")return <Car size={25}/>;
  return <MapPin size={25}/>;
}

function ResultCard({item,origin,lang}){
  const walk=approxWalkMinutes(item.distanceKm);
  const routeMinutes=Number.isFinite(item.route?.minutes)?Math.max(1,Math.round(item.route.minutes)):null;
  const description=[item.typeLabel,item.cuisine,item.address].filter(Boolean).join(" · ");

  return <article className={`simpleResultCard ${item.kind}`}>
    <div className="simpleResultIcon">{iconFor(item.kind)}</div>
    <div className="simpleResultMain">
      <span className="simpleResultEyebrow">{item.eyebrow}</span>
      <h2>{item.title}</h2>
      {description&&<p>{description}</p>}
      {!description&&item.subtitle&&<p>{item.subtitle}</p>}
      <div className="simpleFacts">
        {Number.isFinite(item.distanceKm)&&<span className="simpleFact"><MapPin size={14}/>{formatDistance(item.distanceKm)}</span>}
        {routeMinutes&&<span className="simpleFact"><Clock3 size={14}/>≈ {routeMinutes} хв авто</span>}
        {!routeMinutes&&walk&&<span className="simpleFact"><Clock3 size={14}/>≈ {walk} хв пішки</span>}
        {item.city&&<span className="simpleFact"><MapPin size={14}/>{item.city}</span>}
      </div>
    </div>
    <div className="simpleResultActions">
      {item.kind==="passport"?
        <button className="simpleRequestButton" type="button" disabled title={lang==="uk"?"Приватний запит підключимо наступним кроком":"Private request will be connected next"}>
          <MessageCircle size={17}/>{lang==="uk"?"Запросити через Atlas":"Request via Atlas"}
        </button>
        :<>
          {origin&&<button className="primary" type="button" onClick={()=>openOsmDirections(origin,item)}><Navigation size={17}/>{lang==="uk"?"Маршрут":"Route"}</button>}
          {item.phone&&<a className="secondary" href={`tel:${item.phone}`}><Phone size={17}/>{lang==="uk"?"Подзвонити":"Call"}</a>}
        </>}
    </div>
  </article>;
}

function placeCard(place,kind,eyebrow,route=null){
  if(!place)return null;
  return {...place,kind,eyebrow,title:place.name,distanceKm:place.straightDistanceKm,route};
}

function passportCard(profile,lang){
  return {
    kind:"passport",
    eyebrow:lang==="uk"?"Можливість людини в Atlas":"Person in Atlas",
    title:profile.headline||profile.name|| (lang==="uk"?"Можливість користувача Atlas":"Atlas opportunity"),
    subtitle:profile.can_help||profile.can_share||"",
    city:profile.city||"",
    profile
  };
}

export default function Solution({t,lang}){
  const {state}=useLocation();
  const initialTask=state?.task||"";
  const initialWhere=state?.where||"";
  const [task,setTask]=useState(initialTask);
  const [activeTask,setActiveTask]=useState(initialTask);
  const [showMore,setShowMore]=useState(false);
  const [passportMatches,setPassportMatches]=useState([]);
  const [passportLoading,setPassportLoading]=useState(true);
  const [nearby,setNearby]=useState({meals:[],groceries:[],hospitals:[],pharmacies:[],dealers:[]});
  const [nearbyLoading,setNearbyLoading]=useState(false);
  const [nearbyError,setNearbyError]=useState("");
  const [routes,setRoutes]=useState({meal:null,grocery:null,hospital:null,pharmacy:null,dealer:null});
  const geo=useGeolocation(state?.geoLocation||null);

  const goal=useMemo(()=>parseGoal(activeTask,lang),[activeTask,lang]);
  const medical=["health-symptom","medical-emergency","pharmacy"].includes(goal.scenario);
  const food=goal.scenario==="food";
  const vehicleBuy=goal.scenario==="vehicle-buy";
  const needsNearby=medical||food||vehicleBuy;
  const vehicleNeedsClarification=vehicleBuy&&!/(\$|дол|грн|тис|бюджет|нова|нову|вжив|б\/у|bmw|audi|toyota|volkswagen|skoda|renault|tesla|mercedes|ford|kia|hyundai|nissan|mazda|honda|lexus)/i.test(activeTask);

  useEffect(()=>{
    let alive=true;
    setPassportLoading(true);
    searchPassportProfiles(goal,{limit:5}).then(({matches})=>{
      if(!alive)return;
      setPassportMatches(matches||[]);
      setPassportLoading(false);
    }).catch(()=>{
      if(!alive)return;
      setPassportMatches([]);
      setPassportLoading(false);
    });
    return()=>{alive=false};
  },[goal.originalGoal,goal.scenario,goal.category]);

  useEffect(()=>{
    let alive=true;
    const origin=geo.location;
    if(!origin||!needsNearby){
      setNearby({meals:[],groceries:[],hospitals:[],pharmacies:[],dealers:[]});
      setRoutes({meal:null,grocery:null,hospital:null,pharmacy:null,dealer:null});
      setNearbyLoading(false);
      return()=>{alive=false};
    }

    async function load(){
      setNearbyLoading(true);
      setNearbyError("");
      try{
        if(food){
          const result=await findNearbyFood(origin,{lang});
          if(!alive)return;
          const meal=result.meals?.[0]||null;
          const grocery=result.groceries?.[0]||null;
          const [mealRoute,groceryRoute]=await Promise.all([
            meal?getDrivingRoute(origin,meal).catch(()=>null):Promise.resolve(null),
            grocery?getDrivingRoute(origin,grocery).catch(()=>null):Promise.resolve(null)
          ]);
          if(!alive)return;
          setNearby({meals:result.meals||[],groceries:result.groceries||[],hospitals:[],pharmacies:[],dealers:[]});
          setRoutes({meal:mealRoute,grocery:groceryRoute,hospital:null,pharmacy:null,dealer:null});
        }else if(medical){
          const result=await findNearbyMedical(origin,{lang});
          if(!alive)return;
          const hospital=result.hospitals?.[0]||null;
          const pharmacy=result.pharmacies?.[0]||null;
          const [hospitalRoute,pharmacyRoute]=await Promise.all([
            hospital?getDrivingRoute(origin,hospital).catch(()=>null):Promise.resolve(null),
            pharmacy?getDrivingRoute(origin,pharmacy).catch(()=>null):Promise.resolve(null)
          ]);
          if(!alive)return;
          setNearby({meals:[],groceries:[],hospitals:result.hospitals||[],pharmacies:result.pharmacies||[],dealers:[]});
          setRoutes({meal:null,grocery:null,hospital:hospitalRoute,pharmacy:pharmacyRoute,dealer:null});
        }else if(vehicleBuy){
          const dealers=await findNearbyVehicleDealers(origin,{lang});
          if(!alive)return;
          const dealer=dealers?.[0]||null;
          const dealerRoute=dealer?await getDrivingRoute(origin,dealer).catch(()=>null):null;
          if(!alive)return;
          setNearby({meals:[],groceries:[],hospitals:[],pharmacies:[],dealers:dealers||[]});
          setRoutes({meal:null,grocery:null,hospital:null,pharmacy:null,dealer:dealerRoute});
        }
      }catch(error){
        if(alive)setNearbyError(error?.message||"nearby-search-failed");
      }finally{
        if(alive)setNearbyLoading(false);
      }
    }

    load();
    return()=>{alive=false};
  },[geo.location?.latitude,geo.location?.longitude,goal.scenario,lang]);

  function submit(e){
    e.preventDefault();
    const value=task.trim();
    if(!value)return;
    setShowMore(false);
    setActiveTask(value);
  }

  function refineVehicle(label){
    const base=activeTask.trim().replace(/[,.]+$/g,"");
    const value=`${base}, ${label}`;
    setTask(value);
    setActiveTask(value);
    setShowMore(false);
  }

  async function locate(){
    await geo.requestLocation();
  }

  const passportCards=passportMatches.map(profile=>passportCard(profile,lang));
  let firstCards=[];
  let moreCards=[];

  if(food){
    firstCards=[
      placeCard(nearby.meals[0],"meal",lang==="uk"?"Найближче місце поїсти":"Nearest place to eat",routes.meal),
      passportCards[0]||null,
      placeCard(nearby.groceries[0],"grocery",lang==="uk"?"Продукти поруч":"Groceries nearby",routes.grocery)
    ].filter(Boolean);
    moreCards=[
      ...nearby.meals.slice(1,3).map(item=>placeCard(item,"meal",lang==="uk"?"Ще місце поїсти":"Another place to eat")),
      ...passportCards.slice(1,3),
      ...nearby.groceries.slice(1,3).map(item=>placeCard(item,"grocery",lang==="uk"?"Ще продукти поруч":"More groceries nearby"))
    ].filter(Boolean);
  }else if(medical){
    const hospital=placeCard(nearby.hospitals[0],"hospital",lang==="uk"?"Найближча медична допомога":"Nearest medical care",routes.hospital);
    const pharmacy=placeCard(nearby.pharmacies[0],"pharmacy",lang==="uk"?"Найближча аптека":"Nearest pharmacy",routes.pharmacy);
    if(goal.scenario==="medical-emergency")firstCards=[hospital,passportCards[0]||null,pharmacy].filter(Boolean);
    else if(goal.scenario==="pharmacy")firstCards=[pharmacy,passportCards[0]||null,hospital].filter(Boolean);
    else firstCards=[passportCards[0]||null,hospital,pharmacy].filter(Boolean);
    moreCards=[
      ...passportCards.slice(1,3),
      ...nearby.hospitals.slice(1,3).map(item=>placeCard(item,"hospital",lang==="uk"?"Ще медична допомога":"More medical care")),
      ...nearby.pharmacies.slice(1,3).map(item=>placeCard(item,"pharmacy",lang==="uk"?"Ще аптека":"Another pharmacy"))
    ].filter(Boolean);
  }else if(vehicleBuy){
    firstCards=[
      passportCards[0]||null,
      placeCard(nearby.dealers[0],"dealer",lang==="uk"?"Авто поруч":"Vehicle dealer nearby",routes.dealer),
      passportCards[1]||null
    ].filter(Boolean);
    moreCards=[
      ...passportCards.slice(2,5),
      ...nearby.dealers.slice(1,4).map(item=>placeCard(item,"dealer",lang==="uk"?"Ще авто поруч":"Another vehicle dealer nearby"))
    ].filter(Boolean);
  }else{
    firstCards=passportCards.slice(0,3);
    moreCards=passportCards.slice(3,5);
  }

  const visibleCards=showMore?[...firstCards,...moreCards]:firstCards;
  const time=new Date().toLocaleTimeString(lang==="uk"?"uk-UA":"en-US",{hour:"2-digit",minute:"2-digit"});
  const locationText=geo.location?(initialWhere|| (lang==="uk"?"поточна локація":"current location")):(initialWhere|| (lang==="uk"?"не визначена":"not set"));
  const nothingFound=!passportLoading&&!nearbyLoading&&visibleCards.length===0&&!vehicleNeedsClarification;

  return <main className="simpleSolutionPage">
    <section className="simpleSolutionShell">
      <Link className="simpleBack" to="/"><ArrowLeft size={17}/>{lang==="uk"?"Назад":"Back"}</Link>

      <form className="simpleQueryForm" onSubmit={submit}>
        <input value={task} onChange={e=>setTask(e.target.value)} placeholder={lang==="uk"?"Що вам потрібно?":"What do you need?"}/>
        <button type="submit" aria-label={lang==="uk"?"Знайти":"Search"}><Search size={25}/></button>
      </form>

      <div className="simpleLocationRow">
        <MapPin size={17}/>
        <span>{lang==="uk"?"Ваша локація:":"Your location:"}</span>
        <strong>{locationText}</strong>
        <button className="simpleLocationAction" type="button" onClick={locate} disabled={geo.loading}>{geo.loading?(lang==="uk"?"Визначаю…":"Locating…"):(geo.location?(lang==="uk"?"Оновити":"Refresh"):(lang==="uk"?"Визначити":"Detect"))}</button>
      </div>

      <div className="simpleResultsHeader">
        <div>
          <h1>{vehicleNeedsClarification?(lang==="uk"?"Уточнимо — і Atlas знайде":"One detail — then Atlas can search"):(lang==="uk"?"Ось найкращі варіанти":"Here are the best options")}{needsNearby&&geo.location&&!vehicleNeedsClarification?(lang==="uk"?" поруч":" nearby"):""}</h1>
          <p>{lang==="uk"?`Пошук зараз о ${time}`:`Search at ${time}`}</p>
        </div>
        {medical&&<div className="simpleSafety">
          {goal.scenario==="medical-emergency"?
            <>{lang==="uk"?"Якщо ситуація небезпечна або стан різко погіршується — телефонуйте ":"If the situation is dangerous or rapidly worsening, call "}<a href="tel:103">103</a>.</>
            :<>{lang==="uk"?"Якщо біль раптовий, дуже сильний або є слабкість, порушення мовлення чи втрата свідомості — ":"If pain is sudden/severe or there is weakness, speech difficulty or loss of consciousness — "}<a href="tel:103">103</a>.</>}
        </div>}
      </div>

      {vehicleNeedsClarification&&<div className="simpleClarifier">
        <strong>{lang==="uk"?"Який варіант вам ближчий?":"Which option is closer to what you want?"}</strong>
        <span>{lang==="uk"?"Одного уточнення достатньо, щоб звузити пошук. Паралельно Atlas уже перевіряє Паспорти можливостей.":"One detail is enough to narrow the search. Atlas is already checking Opportunity Passports."}</span>
        <div className="simpleClarifierChips">
          {(lang==="uk"?["бюджет до $5 000","бюджет до $10 000","бюджет до $20 000","вживана","нова"]:["budget up to $5,000","budget up to $10,000","budget up to $20,000","used","new"]).map(option=><button key={option} type="button" onClick={()=>refineVehicle(option)}>{option}</button>)}
        </div>
      </div>}

      {needsNearby&&!geo.location&&<div className="simpleGeoPrompt">
        <div>
          <strong>{lang==="uk"?"Можна врахувати вашу локацію":"Atlas can use your location"}</strong>
          <span>{vehicleBuy?(lang==="uk"?"Тоді Atlas додасть реальні автосалони та майданчики поруч.":"Atlas will also add real nearby vehicle dealers."):(lang==="uk"?"Atlas сам знайде найближчі реальні місця та побудує маршрут.":"Atlas will find real nearby places and build the route.")}</span>
        </div>
        <button className="primary" type="button" onClick={locate} disabled={geo.loading}><MapPin size={18}/>{lang==="uk"?"Використати мою локацію":"Use my location"}</button>
      </div>}

      {(passportLoading||nearbyLoading)&&<div className="simpleStateLine"><RefreshCw className="spin" size={16}/>{lang==="uk"?"Atlas шукає найкращі варіанти…":"Atlas is finding the best options…"}</div>}

      <div className="simpleResultList">
        {visibleCards.map((item,index)=><ResultCard key={`${item.kind}-${item.id||item.profile?.slug||index}`} item={item} origin={geo.location} lang={lang}/>) }
      </div>

      {nothingFound&&<div className="simpleEmpty">{lang==="uk"?"У Паспортах поки немає готового збігу. Atlas має продовжити пошук у зовнішніх джерелах, а не зупинятися тут.":"No Passport match yet. Atlas should continue to external sources instead of stopping here."}</div>}

      {!showMore&&moreCards.length>0&&<button className="simpleShowMore" type="button" onClick={()=>setShowMore(true)}>{lang==="uk"?"Показати ще варіанти ↓":"Show more options ↓"}</button>}
      {showMore&&moreCards.length>0&&<button className="simpleShowMore" type="button" onClick={()=>setShowMore(false)}>{lang==="uk"?"Згорнути ↑":"Show less ↑"}</button>}

      {nearbyError&&firstCards.length>0&&<p className="simpleHint">{lang==="uk"?"Частина зовнішніх даних зараз недоступна; показано те, що Atlas уже зміг знайти.":"Some external data is unavailable; Atlas is showing the results it could retrieve."}</p>}
      <p className="simpleHint">{lang==="uk"?"Контакти людей із Паспортів не розкриваються. Дані про заклади беруться з відкритих картографічних джерел і можуть бути неповними.":"Passport contacts stay private. Place data comes from open map sources and may be incomplete."}</p>
    </section>
  </main>;
}
