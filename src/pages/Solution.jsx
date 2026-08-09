import {useEffect,useMemo,useState} from "react";
import {Link,useLocation} from "react-router-dom";
import {ArrowLeft,Car,Clock3,ExternalLink,Hospital,MapPin,MessageCircle,Navigation,Phone,Pill,RefreshCw,Search,ShoppingCart,UserRound,Utensils} from "lucide-react";
import {parseGoal} from "../brain/GoalParser";
import {searchPassportProfiles} from "../services/passportSearch";
import {findNearbyFood} from "../services/foodPlaces";
import {findNearbyMedical,getDrivingRoute,openOsmDirections} from "../services/medicalPlaces";
import {findNearbyVehicleDealers} from "../services/vehiclePlaces";
import {searchRiaCars} from "../services/riaCars";
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
  if(kind==="dealer"||kind==="car-listing")return <Car size={25}/>;
  return <MapPin size={25}/>;
}

function ResultCard({item,origin,lang}){
  const walk=approxWalkMinutes(item.distanceKm);
  const routeMinutes=Number.isFinite(item.route?.minutes)?Math.max(1,Math.round(item.route.minutes)):null;
  const description=[item.typeLabel,item.cuisine,item.address].filter(Boolean).join(" · ");
  const isListing=item.kind==="car-listing";

  return <article className={`simpleResultCard ${item.kind}`}>
    <div className="simpleResultIcon">{item.photo?<img src={item.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"inherit"}}/>:iconFor(item.kind)}</div>
    <div className="simpleResultMain">
      <span className="simpleResultEyebrow">{item.eyebrow}</span>
      <h2>{item.title}</h2>
      {isListing&&<p>{[
        item.year?`${item.year} р.`:"",
        item.mileage||"",
        item.fuel||"",
        item.gearbox||"",
        item.city||""
      ].filter(Boolean).join(" · ")}</p>}
      {!isListing&&description&&<p>{description}</p>}
      {!isListing&&!description&&item.subtitle&&<p>{item.subtitle}</p>}
      <div className="simpleFacts">
        {isListing&&Number.isFinite(item.priceUsd)&&<span className="simpleFact"><strong>${item.priceUsd.toLocaleString("en-US")}</strong></span>}
        {Number.isFinite(item.distanceKm)&&<span className="simpleFact"><MapPin size={14}/>{formatDistance(item.distanceKm)}</span>}
        {routeMinutes&&<span className="simpleFact"><Clock3 size={14}/>≈ {routeMinutes} хв авто</span>}
        {!routeMinutes&&walk&&<span className="simpleFact"><Clock3 size={14}/>≈ {walk} хв пішки</span>}
        {!isListing&&item.city&&<span className="simpleFact"><MapPin size={14}/>{item.city}</span>}
      </div>
    </div>
    <div className="simpleResultActions">
      {item.kind==="passport"?<button className="simpleRequestButton" type="button" disabled title={lang==="uk"?"Приватний запит підключимо наступним кроком":"Private request will be connected next"}>
        <MessageCircle size={17}/>{lang==="uk"?"Запросити через Atlas":"Request via Atlas"}
      </button>:isListing?<a className="primary" href={item.url} target="_blank" rel="noreferrer"><ExternalLink size={17}/>{lang==="uk"?"Переглянути авто":"View car"}</a>:<>
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
  return {kind:"passport",eyebrow:lang==="uk"?"Можливість людини в Atlas":"Person in Atlas",title:profile.headline||profile.name||(lang==="uk"?"Можливість користувача Atlas":"Atlas opportunity"),subtitle:profile.can_help||profile.can_share||"",city:profile.city||"",profile};
}
function carCard(car,lang){
  return {...car,kind:"car-listing",eyebrow:lang==="uk"?"Реальне оголошення AUTO.RIA":"Live AUTO.RIA listing"};
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
  const [cars,setCars]=useState([]);
  const [carsLoading,setCarsLoading]=useState(false);
  const [carsError,setCarsError]=useState("");
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
    searchPassportProfiles(goal,{limit:5}).then(({matches})=>{if(alive){setPassportMatches(matches||[]);setPassportLoading(false)}}).catch(()=>{if(alive){setPassportMatches([]);setPassportLoading(false)}});
    return()=>{alive=false};
  },[goal.originalGoal,goal.scenario,goal.category]);

  useEffect(()=>{
    let alive=true;
    if(!vehicleBuy){setCars([]);setCarsError("");setCarsLoading(false);return()=>{alive=false}}
    setCarsLoading(true);setCarsError("");
    searchRiaCars(activeTask).then(result=>{if(alive){setCars(result.cars||[]);setCarsLoading(false)}}).catch(error=>{if(alive){setCars([]);setCarsError(error?.code||error?.message||"ria-error");setCarsLoading(false)}});
    return()=>{alive=false};
  },[vehicleBuy,activeTask]);

  useEffect(()=>{
    let alive=true;const origin=geo.location;
    if(!origin||!needsNearby){setNearby({meals:[],groceries:[],hospitals:[],pharmacies:[],dealers:[]});setRoutes({meal:null,grocery:null,hospital:null,pharmacy:null,dealer:null});setNearbyLoading(false);return()=>{alive=false}}
    async function load(){
      setNearbyLoading(true);setNearbyError("");
      try{
        if(food){
          const result=await findNearbyFood(origin,{lang});if(!alive)return;
          const meal=result.meals?.[0]||null;const grocery=result.groceries?.[0]||null;
          const [mealRoute,groceryRoute]=await Promise.all([meal?getDrivingRoute(origin,meal).catch(()=>null):null,grocery?getDrivingRoute(origin,grocery).catch(()=>null):null]);if(!alive)return;
          setNearby({meals:result.meals||[],groceries:result.groceries||[],hospitals:[],pharmacies:[],dealers:[]});setRoutes({meal:mealRoute,grocery:groceryRoute,hospital:null,pharmacy:null,dealer:null});
        }else if(medical){
          const result=await findNearbyMedical(origin,{lang});if(!alive)return;
          const hospital=result.hospitals?.[0]||null;const pharmacy=result.pharmacies?.[0]||null;
          const [hospitalRoute,pharmacyRoute]=await Promise.all([hospital?getDrivingRoute(origin,hospital).catch(()=>null):null,pharmacy?getDrivingRoute(origin,pharmacy).catch(()=>null):null]);if(!alive)return;
          setNearby({meals:[],groceries:[],hospitals:result.hospitals||[],pharmacies:result.pharmacies||[],dealers:[]});setRoutes({meal:null,grocery:null,hospital:hospitalRoute,pharmacy:pharmacyRoute,dealer:null});
        }else if(vehicleBuy){
          const dealers=await findNearbyVehicleDealers(origin,{lang});if(!alive)return;
          const dealer=dealers?.[0]||null;const dealerRoute=dealer?await getDrivingRoute(origin,dealer).catch(()=>null):null;if(!alive)return;
          setNearby({meals:[],groceries:[],hospitals:[],pharmacies:[],dealers:dealers||[]});setRoutes({meal:null,grocery:null,hospital:null,pharmacy:null,dealer:dealerRoute});
        }
      }catch(error){if(alive)setNearbyError(error?.message||"nearby-search-failed")}finally{if(alive)setNearbyLoading(false)}
    }
    load();return()=>{alive=false};
  },[geo.location?.latitude,geo.location?.longitude,goal.scenario,lang]);

  function submit(e){e.preventDefault();const value=task.trim();if(!value)return;setShowMore(false);setActiveTask(value)}
  function refineVehicle(label){const base=activeTask.trim().replace(/[,.]+$/g,"");const value=`${base}, ${label}`;setTask(value);setActiveTask(value);setShowMore(false)}
  async function locate(){await geo.requestLocation()}

  const passportCards=passportMatches.map(profile=>passportCard(profile,lang));
  const carCards=cars.map(car=>carCard(car,lang));
  let firstCards=[];let moreCards=[];
  if(food){
    firstCards=[placeCard(nearby.meals[0],"meal",lang==="uk"?"Найближче місце поїсти":"Nearest place to eat",routes.meal),passportCards[0]||null,placeCard(nearby.groceries[0],"grocery",lang==="uk"?"Продукти поруч":"Groceries nearby",routes.grocery)].filter(Boolean);
    moreCards=[...nearby.meals.slice(1,3).map(item=>placeCard(item,"meal",lang==="uk"?"Ще місце поїсти":"Another place to eat")),...passportCards.slice(1,3),...nearby.groceries.slice(1,3).map(item=>placeCard(item,"grocery",lang==="uk"?"Ще продукти поруч":"More groceries nearby"))].filter(Boolean);
  }else if(medical){
    const hospital=placeCard(nearby.hospitals[0],"hospital",lang==="uk"?"Найближча медична допомога":"Nearest medical care",routes.hospital);const pharmacy=placeCard(nearby.pharmacies[0],"pharmacy",lang==="uk"?"Найближча аптека":"Nearest pharmacy",routes.pharmacy);
    firstCards=goal.scenario==="medical-emergency"?[hospital,passportCards[0]||null,pharmacy].filter(Boolean):goal.scenario==="pharmacy"?[pharmacy,passportCards[0]||null,hospital].filter(Boolean):[passportCards[0]||null,hospital,pharmacy].filter(Boolean);
    moreCards=[...passportCards.slice(1,3),...nearby.hospitals.slice(1,3).map(item=>placeCard(item,"hospital",lang==="uk"?"Ще медична допомога":"More medical care")),...nearby.pharmacies.slice(1,3).map(item=>placeCard(item,"pharmacy",lang==="uk"?"Ще аптека":"Another pharmacy"))].filter(Boolean);
  }else if(vehicleBuy){
    const dealer=placeCard(nearby.dealers[0],"dealer",lang==="uk"?"Автосалон поруч":"Vehicle dealer nearby",routes.dealer);
    firstCards=[carCards[0]||null,carCards[1]||null,passportCards[0]||dealer||null].filter(Boolean);
    moreCards=[...carCards.slice(2,6),...passportCards.slice(1,4),...nearby.dealers.slice(dealer?1:0,3).map(item=>placeCard(item,"dealer",lang==="uk"?"Автосалон поруч":"Vehicle dealer nearby"))].filter(Boolean);
  }else{firstCards=passportCards.slice(0,3);moreCards=passportCards.slice(3,5)}

  const visibleCards=showMore?[...firstCards,...moreCards]:firstCards;
  const time=new Date().toLocaleTimeString(lang==="uk"?"uk-UA":"en-US",{hour:"2-digit",minute:"2-digit"});
  const locationText=geo.location?(initialWhere||(lang==="uk"?"поточна локація":"current location")):(initialWhere||(lang==="uk"?"не визначена":"not set"));
  const allLoading=passportLoading||nearbyLoading||carsLoading;
  const nothingFound=!allLoading&&visibleCards.length===0&&!vehicleNeedsClarification;

  return <main className="simpleSolutionPage"><section className="simpleSolutionShell">
    <Link className="simpleBack" to="/"><ArrowLeft size={17}/>{lang==="uk"?"Назад":"Back"}</Link>
    <form className="simpleQueryForm" onSubmit={submit}><input value={task} onChange={e=>setTask(e.target.value)} placeholder={lang==="uk"?"Що вам потрібно?":"What do you need?"}/><button type="submit" aria-label={lang==="uk"?"Знайти":"Search"}><Search size={25}/></button></form>
    <div className="simpleLocationRow"><MapPin size={17}/><span>{lang==="uk"?"Ваша локація:":"Your location:"}</span><strong>{locationText}</strong><button className="simpleLocationAction" type="button" onClick={locate} disabled={geo.loading}>{geo.loading?(lang==="uk"?"Визначаю…":"Locating…"):(geo.location?(lang==="uk"?"Оновити":"Refresh"):(lang==="uk"?"Визначити":"Detect"))}</button></div>

    <div className="simpleResultsHeader"><div><h1>{vehicleNeedsClarification?(lang==="uk"?"Уточнимо — і Atlas знайде":"One detail — then Atlas can search"):(lang==="uk"?"Ось найкращі варіанти":"Here are the best options")}{needsNearby&&geo.location&&!vehicleNeedsClarification?(lang==="uk"?" поруч":" nearby"):""}</h1><p>{lang==="uk"?`Пошук зараз о ${time}`:`Search at ${time}`}</p></div>{medical&&<div className="simpleSafety">{goal.scenario==="medical-emergency"?<>{lang==="uk"?"Якщо ситуація небезпечна або стан різко погіршується — телефонуйте ":"If the situation is dangerous or rapidly worsening, call "}<a href="tel:103">103</a>.</>:<>{lang==="uk"?"Якщо біль раптовий, дуже сильний або є слабкість, порушення мовлення чи втрата свідомості — ":"If pain is sudden/severe or there is weakness, speech difficulty or loss of consciousness — "}<a href="tel:103">103</a>.</>}</div>}</div>

    {vehicleNeedsClarification&&<div className="simpleClarifier"><strong>{lang==="uk"?"Який варіант вам ближчий?":"Which option is closer to what you want?"}</strong><span>{lang==="uk"?"Одного уточнення достатньо. Atlas паралельно перевіряє Паспорти й зовнішні джерела.":"One detail is enough. Atlas is checking Passports and external sources in parallel."}</span><div className="simpleClarifierChips">{(lang==="uk"?["бюджет до $5 000","бюджет до $10 000","бюджет до $20 000","вживана","нова"]:["budget up to $5,000","budget up to $10,000","budget up to $20,000","used","new"]).map(option=><button key={option} type="button" onClick={()=>refineVehicle(option)}>{option}</button>)}</div></div>}

    {needsNearby&&!geo.location&&<div className="simpleGeoPrompt"><div><strong>{lang==="uk"?"Можна врахувати вашу локацію":"Atlas can use your location"}</strong><span>{vehicleBuy?(lang==="uk"?"Atlas додасть автосалони й майданчики поруч.":"Atlas will add nearby vehicle dealers."):(lang==="uk"?"Atlas сам знайде найближчі реальні місця та побудує маршрут.":"Atlas will find real nearby places and build the route.")}</span></div><button className="primary" type="button" onClick={locate} disabled={geo.loading}><MapPin size={18}/>{lang==="uk"?"Використати мою локацію":"Use my location"}</button></div>}

    {allLoading&&<div className="simpleStateLine"><RefreshCw className="spin" size={16}/>{lang==="uk"?"Atlas шукає найкращі варіанти…":"Atlas is finding the best options…"}</div>}
    <div className="simpleResultList">{visibleCards.map((item,index)=><ResultCard key={`${item.kind}-${item.id||item.profile?.slug||index}`} item={item} origin={geo.location} lang={lang}/>)}</div>

    {nothingFound&&<div className="simpleEmpty">{vehicleBuy&&carsError==="ria-key-missing"?(lang==="uk"?"Пошук реальних авто готовий до підключення, але для AUTO.RIA ще потрібен API-ключ. Atlas продовжує шукати Паспорти та автосалони поруч.":"Live vehicle search is ready but still needs an AUTO.RIA API key. Atlas continues with Passports and nearby dealers."):(lang==="uk"?"Atlas поки не знайшов готового варіанта в доступних джерелах.":"Atlas has not found a ready option in the available sources yet.")}</div>}
    {!showMore&&moreCards.length>0&&<button className="simpleShowMore" type="button" onClick={()=>setShowMore(true)}>{lang==="uk"?"Показати ще варіанти ↓":"Show more options ↓"}</button>}
    {showMore&&moreCards.length>0&&<button className="simpleShowMore" type="button" onClick={()=>setShowMore(false)}>{lang==="uk"?"Згорнути ↑":"Show less ↑"}</button>}
    {nearbyError&&firstCards.length>0&&<p className="simpleHint">{lang==="uk"?"Частина зовнішніх даних зараз недоступна; показано те, що Atlas уже зміг знайти.":"Some external data is unavailable; Atlas is showing the results it could retrieve."}</p>}
    {vehicleBuy&&carCards.length>0&&<p className="simpleHint">{lang==="uk"?"Оголошення отримані через API ":"Listings provided via "}<a href="https://auto.ria.com" target="_blank" rel="noreferrer">AUTO.RIA</a>.</p>}
    <p className="simpleHint">{lang==="uk"?"Контакти людей із Паспортів не розкриваються. Дані про місця можуть бути неповними.":"Passport contacts stay private. Place data may be incomplete."}</p>
  </section></main>;
}
