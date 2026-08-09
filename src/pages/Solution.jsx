import {useEffect,useMemo,useState} from "react";
import {useLocation,useNavigate} from "react-router-dom";
import {ArrowLeft,Clock3,ExternalLink,MapPin,Navigation,Phone,RefreshCw,Search,UserRound} from "lucide-react";
import {analyzeAtlasQuery,createFallbackPlan} from "../services/atlasBrain";
import {searchPassportProfiles} from "../services/passportSearch";
import {searchExternalSources} from "../services/externalSearch";
import {getDrivingRoute,openGoogleDirections,searchDestination,searchNearbyPlaces} from "../services/googleMaps";
import useGeolocation from "../hooks/useGeolocation";
import "../styles/simpleSolution.css";

function formatDistance(value){
  if(!Number.isFinite(value))return "";
  if(value<1)return `${Math.max(10,Math.round(value*1000/10)*10)} м`;
  return `${value<10?value.toFixed(1):Math.round(value)} км`;
}

function passportCard(profile,lang){
  return {
    kind:"passport",
    id:profile.slug||profile.name,
    eyebrow:lang==="uk"?"Знайдено в Паспорті можливостей":"Found in Opportunity Passports",
    title:profile.headline||profile.name||(lang==="uk"?"Можливість користувача Atlas":"Atlas opportunity"),
    subtitle:profile.can_help||profile.can_share||"",
    city:profile.city||"",
    passportUrl:profile.slug?`/p/${profile.slug}`:"",
    profile
  };
}

function placeCard(place,search,lang){
  const destination=search?.mode==="destination";
  return {
    ...place,
    kind:"place",
    id:place.id,
    mapMode:search?.mode||"nearby",
    eyebrow:destination?(lang==="uk"?"Пункт призначення":"Destination"):(search?.query||""),
    title:place.name,
    distanceKm:place.straightDistanceKm
  };
}

function externalCard(item,index,lang){
  return {
    kind:"external",
    id:`external-${index}-${item.url}`,
    eyebrow:item.source_type||(lang==="uk"?"Зовнішнє джерело":"External source"),
    title:item.title,
    subtitle:item.snippet,
    url:item.url,
    priceText:item.price_text||"",
    locationText:item.location_text||""
  };
}

function ResultCard({item,origin,lang}){
  const routeMinutes=Number.isFinite(item.route?.minutes)?Math.max(1,Math.round(item.route.minutes)):null;
  const routeDistance=Number.isFinite(item.route?.distanceKm)?item.route.distanceKm:null;
  const shownDistance=routeDistance??(Number.isFinite(item.distanceKm)?item.distanceKm:null);
  const description=[item.typeLabel,item.address].filter(Boolean).join(" · ");
  const googleContent=item.source==="Google Maps"||item.route?.source==="Google Maps";

  return <article className={`simpleResultCard ${item.kind}`}>
    <div className="simpleResultIcon">{item.kind==="passport"?<UserRound size={25}/>:item.kind==="external"?<Search size={25}/>:<MapPin size={25}/>}</div>
    <div className="simpleResultMain">
      <span className="simpleResultEyebrow">{item.eyebrow}</span>
      <h2>{item.title}</h2>
      {item.priceText&&<strong className="simplePrice">{item.priceText}</strong>}
      {description&&<p>{description}</p>}
      {!description&&item.subtitle&&<p>{item.subtitle}</p>}
      <div className="simpleFacts">
        {Number.isFinite(shownDistance)&&<span className="simpleFact"><MapPin size={14}/>{formatDistance(shownDistance)}{routeDistance!==null?(lang==="uk"?" маршрутом":" by route"):""}</span>}
        {routeMinutes&&<span className="simpleFact"><Clock3 size={14}/>≈ {routeMinutes} хв авто</span>}
        {item.openNow===true&&<span className="simpleFact">{lang==="uk"?"Відкрито зараз":"Open now"}</span>}
        {item.openNow===false&&<span className="simpleFact">{lang==="uk"?"Зараз зачинено":"Closed now"}</span>}
        {item.city&&<span className="simpleFact"><MapPin size={14}/>{item.city}</span>}
        {item.locationText&&<span className="simpleFact"><MapPin size={14}/>{item.locationText}</span>}
        {googleContent&&<a className="simpleFact" href={item.googleMapsUri||undefined} target={item.googleMapsUri?"_blank":undefined} rel={item.googleMapsUri?"noreferrer":undefined}>Google Maps</a>}
      </div>
    </div>
    <div className="simpleResultActions">
      {item.kind==="passport"&&item.passportUrl&&<a className="primary" href={item.passportUrl}><UserRound size={17}/>{lang==="uk"?"Відкрити Паспорт":"Open Passport"}</a>}
      {item.kind==="place"&&<>
        {origin&&<button className="primary" type="button" onClick={()=>openGoogleDirections(origin,item)}><Navigation size={17}/>{lang==="uk"?"Маршрут":"Route"}</button>}
        {item.phone&&<a className="secondary" href={`tel:${item.phone}`}><Phone size={17}/>{lang==="uk"?"Подзвонити":"Call"}</a>}
        {item.website&&<a className="secondary" href={item.website} target="_blank" rel="noreferrer"><ExternalLink size={17}/>{lang==="uk"?"Сайт":"Website"}</a>}
      </>}
      {item.kind==="external"&&item.url&&<a className="primary" href={item.url} target="_blank" rel="noreferrer"><ExternalLink size={17}/>{lang==="uk"?"Відкрити":"Open"}</a>}
    </div>
  </article>;
}

export default function Solution({lang}){
  const {state}=useLocation();
  const navigate=useNavigate();
  const initialTask=String(state?.task||"").trim();
  const initialWhere=String(state?.where||"").trim();
  const [task,setTask]=useState(initialTask);
  const [activeTask,setActiveTask]=useState(initialTask);
  const [showMore,setShowMore]=useState(false);
  const [plan,setPlan]=useState(()=>createFallbackPlan(initialTask,{lang}));
  const [brainLoading,setBrainLoading]=useState(Boolean(initialTask));
  const [brainError,setBrainError]=useState("");
  const [passportMatches,setPassportMatches]=useState([]);
  const [passportLoading,setPassportLoading]=useState(Boolean(initialTask));
  const [passportCheckedGoal,setPassportCheckedGoal]=useState("");
  const [mapResults,setMapResults]=useState([]);
  const [mapLoading,setMapLoading]=useState(false);
  const [mapError,setMapError]=useState("");
  const [externalResults,setExternalResults]=useState([]);
  const [externalLoading,setExternalLoading]=useState(false);
  const [externalError,setExternalError]=useState("");
  const geo=useGeolocation(state?.geoLocation||null);

  useEffect(()=>{
    if(!activeTask){
      setPlan(createFallbackPlan("",{lang}));
      setBrainLoading(false);
      setMapResults([]);
      setExternalResults([]);
      return;
    }
    const controller=new AbortController();
    setPlan(createFallbackPlan(activeTask,{lang}));
    setBrainLoading(true);
    setBrainError("");
    setMapResults([]);
    setExternalResults([]);
    analyzeAtlasQuery(activeTask,{lang,location:geo.location,signal:controller.signal})
      .then(nextPlan=>setPlan(nextPlan))
      .catch(error=>{
        if(error?.name==="AbortError")return;
        setBrainError(error?.message||"atlas-brain-unavailable");
        setPlan(createFallbackPlan(activeTask,{lang}));
      })
      .finally(()=>{if(!controller.signal.aborted)setBrainLoading(false)});
    return()=>controller.abort();
  },[activeTask,lang,geo.location?.latitude,geo.location?.longitude]);

  // Fast first stage: search Passports immediately from the raw user request.
  // This does not wait for Atlas Brain or any external service.
  useEffect(()=>{
    let alive=true;
    if(!activeTask){
      setPassportMatches([]);
      setPassportCheckedGoal("");
      setPassportLoading(false);
      return()=>{alive=false};
    }
    const quickPlan=createFallbackPlan(activeTask,{lang});
    setPassportCheckedGoal("");
    setPassportLoading(true);
    setPassportMatches([]);
    searchPassportProfiles(quickPlan,{limit:6})
      .then(({matches})=>{if(alive)setPassportMatches(matches||[])})
      .catch(()=>{if(alive)setPassportMatches([])})
      .finally(()=>{
        if(alive){
          setPassportLoading(false);
          setPassportCheckedGoal(activeTask);
        }
      });
    return()=>{alive=false};
  },[activeTask,lang]);

  const mapSearches=useMemo(()=>Array.isArray(plan?.external_searches)?plan.external_searches.filter(item=>item?.source==="maps"&&item.query).slice(0,3):[],[plan]);
  const webSearches=useMemo(()=>Array.isArray(plan?.external_searches)?plan.external_searches.filter(item=>["web","marketplace","official"].includes(item?.source)&&item.query).slice(0,4):[],[plan]);
  const needsLocation=Boolean(plan?.needs_location||mapSearches.length);
  const passportsChecked=Boolean(activeTask&&!passportLoading&&passportCheckedGoal===activeTask);
  const externalReady=passportsChecked&&!brainLoading;

  useEffect(()=>{
    const controller=new AbortController();
    if(!externalReady){
      setMapResults([]);setMapLoading(false);setMapError("");
      return()=>controller.abort();
    }
    if(!geo.location||!mapSearches.length){
      setMapResults([]);setMapLoading(false);setMapError("");
      return()=>controller.abort();
    }
    setMapLoading(true);setMapError("");
    Promise.all(mapSearches.map(async search=>{
      const places=search.mode==="destination"
        ?await searchDestination(geo.location,search.query,{lang,limit:3,signal:controller.signal})
        :await searchNearbyPlaces(geo.location,search.query,{lang,limit:3,signal:controller.signal});
      return places.map(place=>placeCard(place,search,lang));
    }))
      .then(async groups=>{
        if(controller.signal.aborted)return;
        const seen=new Set();
        const flat=groups.flat().filter(item=>{if(seen.has(item.id))return false;seen.add(item.id);return true}).slice(0,6);
        const routed=await Promise.all(flat.map(async(item,index)=>{
          if(index>2)return item;
          const route=await getDrivingRoute(geo.location,item,{lang,signal:controller.signal}).catch(()=>null);
          return {...item,route};
        }));
        if(!controller.signal.aborted)setMapResults(routed);
      })
      .catch(error=>{if(error?.name!=="AbortError"&&!controller.signal.aborted){setMapResults([]);setMapError(error?.message||"map-search-unavailable")}})
      .finally(()=>{if(!controller.signal.aborted)setMapLoading(false)});
    return()=>controller.abort();
  },[externalReady,geo.location?.latitude,geo.location?.longitude,mapSearches,lang]);

  useEffect(()=>{
    const controller=new AbortController();
    if(!externalReady){
      setExternalResults([]);setExternalLoading(false);setExternalError("");
      return()=>controller.abort();
    }
    if(!webSearches.length){setExternalResults([]);setExternalLoading(false);setExternalError("");return()=>controller.abort()}
    setExternalLoading(true);setExternalError("");
    searchExternalSources({...plan,external_searches:webSearches},{lang,signal:controller.signal})
      .then(results=>{if(!controller.signal.aborted)setExternalResults(results||[])})
      .catch(error=>{if(error?.name!=="AbortError"&&!controller.signal.aborted){setExternalResults([]);setExternalError(error?.message||"external-search-unavailable")}})
      .finally(()=>{if(!controller.signal.aborted)setExternalLoading(false)});
    return()=>controller.abort();
  },[externalReady,plan,webSearches,lang]);

  function submit(e){
    e.preventDefault();
    const value=task.trim();
    if(!value)return;
    setShowMore(false);
    setActiveTask(value);
  }

  function refine(option){
    const base=activeTask.trim().replace(/[,.]+$/g,"");
    const value=`${base}, ${option}`;
    setTask(value);
    setActiveTask(value);
    setShowMore(false);
  }

  async function locate(){await geo.requestLocation()}

  const passportCards=passportMatches.map(profile=>passportCard(profile,lang));
  const webCards=externalResults.map((item,index)=>externalCard(item,index,lang));
  const orderedCards=[...passportCards,...mapResults,...webCards];
  const seenCards=new Set();
  const cards=orderedCards.filter(item=>{const key=item.url||`${item.kind}-${item.id}`;if(seenCards.has(key))return false;seenCards.add(key);return true});
  const visibleCards=showMore?cards:cards.slice(0,3);
  const busy=cards.length===0&&(passportLoading||brainLoading||mapLoading||externalLoading);
  const nothingFound=!busy&&!plan?.clarification?.required&&cards.length===0;
  const locationText=geo.location?(initialWhere||(lang==="uk"?"поточна локація":"current location")):(initialWhere||(lang==="uk"?"не визначена":"not set"));
  const searchStage=passportLoading
    ?(lang==="uk"?"Перевіряю Паспорти можливостей…":"Checking Opportunity Passports…")
    :brainLoading
      ?(lang==="uk"?"Шукаю найкращий шлях до рішення…":"Finding the best path to a solution…")
      :(mapLoading||externalLoading)
        ?(lang==="uk"?"Шукаю додаткові реальні варіанти…":"Searching additional real options…")
        :"";

  return <main className="simpleSolutionPage">
    <section className="simpleSolutionShell">
      <a className="simpleBack" href="#" onClick={event=>{event.preventDefault();navigate(-1)}}><ArrowLeft size={17}/>{lang==="uk"?"Назад":"Back"}</a>

      <form className="simpleQueryForm" onSubmit={submit}>
        <input value={task} onChange={e=>setTask(e.target.value)} placeholder={lang==="uk"?"Що вам потрібно?":"What do you need?"}/>
        <button type="submit" aria-label={lang==="uk"?"Знайти":"Search"}><Search size={25}/></button>
      </form>

      <div className="simpleLocationRow">
        <MapPin size={17}/><span>{lang==="uk"?"Ваша локація:":"Your location:"}</span><strong>{locationText}</strong>
        <button className="simpleLocationAction" type="button" onClick={locate} disabled={geo.loading}>{geo.loading?(lang==="uk"?"Визначаю…":"Locating…"):(geo.location?(lang==="uk"?"Оновити":"Refresh"):(lang==="uk"?"Визначити":"Detect"))}</button>
      </div>

      <div className="simpleResultsHeader">
        <div>
          <h1>{plan?.clarification?.required?(lang==="uk"?"Потрібне одне уточнення":"One quick question"):(lang==="uk"?"Ось найкращі варіанти":"Here are the best options")}</h1>
          {plan?.goal&&<p>{plan.goal}</p>}
        </div>
        {plan?.safety?.level&&plan.safety.level!=="none"&&plan.safety.message&&<div className={`simpleSafety ${plan.safety.level}`}>{plan.safety.message}</div>}
      </div>

      {plan?.clarification?.required&&<div className="simpleClarifier">
        <strong>{plan.clarification.question}</strong>
        {Array.isArray(plan.clarification.options)&&plan.clarification.options.length>0&&<div className="simpleClarifierChips">{plan.clarification.options.map(option=><button key={option} type="button" onClick={()=>refine(option)}>{option}</button>)}</div>}
      </div>}

      {needsLocation&&!geo.location&&<div className="simpleGeoPrompt">
        <div><strong>{lang==="uk"?"Потрібна ваша локація":"Your location is needed"}</strong><span>{lang==="uk"?"Atlas використає її лише для пошуку найближчих реальних варіантів і маршруту.":"Atlas will use it only to find nearby real options and routes."}</span></div>
        <button className="primary" type="button" onClick={locate} disabled={geo.loading}><MapPin size={18}/>{lang==="uk"?"Використати мою локацію":"Use my location"}</button>
      </div>}

      {busy&&searchStage&&<div className="simpleStateLine"><RefreshCw className="spin" size={16}/>{searchStage}</div>}

      <div className="simpleResultList">{visibleCards.map((item,index)=><ResultCard key={item.url||`${item.kind}-${item.id||index}`} item={item} origin={geo.location} lang={lang}/>)}</div>

      {nothingFound&&<div className="simpleEmpty">{lang==="uk"?"Atlas поки не знайшов достатньо надійного готового варіанта. Він не буде вигадувати результат.":"Atlas has not found a reliable ready option yet. It will not invent one."}</div>}

      {!showMore&&cards.length>3&&<button className="simpleShowMore" type="button" onClick={()=>setShowMore(true)}>{lang==="uk"?"Показати ще варіанти ↓":"Show more options ↓"}</button>}
      {showMore&&cards.length>3&&<button className="simpleShowMore" type="button" onClick={()=>setShowMore(false)}>{lang==="uk"?"Згорнути ↑":"Show less ↑"}</button>}

      {brainError&&<p className="simpleHint">{lang==="uk"?"Atlas Brain зараз у резервному режимі; показано лише те, що вдалося знайти без AI-планувальника.":"Atlas Brain is in fallback mode; only results available without the AI planner are shown."}</p>}
      {(mapError||externalError)&&<p className="simpleHint">{lang==="uk"?"Частина зовнішніх джерел зараз не відповіла. Atlas не підміняє їх вигаданими даними.":"Some external sources did not respond. Atlas does not replace them with invented data."}</p>}
    </section>
  </main>;
}
