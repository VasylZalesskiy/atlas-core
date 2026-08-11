import {useEffect,useMemo,useState} from "react";
import {useLocation,useNavigate} from "react-router-dom";
import {
  ArrowLeft,Check,Clock3,ExternalLink,Globe2,MapPin,Navigation,
  Phone,RefreshCw,Search,UserRound
} from "lucide-react";
import {analyzeAtlasQuery,createFallbackPlan} from "../services/atlasBrain";
import {searchPassportProfiles} from "../services/passportSearch";
import {searchExternalSources} from "../services/externalSearch";
import {getDrivingRoute,openGoogleDirections,searchDestination,searchNearbyPlaces} from "../services/googleMaps";
import {trackAtlas} from "../services/analytics";
import useGeolocation from "../hooks/useGeolocation";
import "../styles/simpleSolution.css";
import "../styles/solutionChains.css";

function clean(value){return String(value||"").replace(/\s+/g," ").trim()}

function sourceForInternetStep(step,plannedSources,index){
  const text=`${step?.title||""} ${step?.purpose||""} ${step?.internet_query||""}`;
  const commerce=/куп|прод|придба|замов|опт|гурт|товар|постач|маркетплейс|оголош|ціна|buy|sell|order|wholesale|supplier|marketplace|listing/i.test(text)
    ||/\d+(?:[\s.]\d{3})*(?:[.,]\d+)?\s*(?:кг(?!\p{L})|kg\b|кілограм(?:ів|и|а)?|т(?!\p{L})|тонн(?:а|и|у)?|tonnes?\b)/iu.test(text);
  if(commerce)return "marketplace";
  return plannedSources[index]?.source||plannedSources[0]?.source||"web";
}

function formatDistance(value){
  if(!Number.isFinite(value))return "";
  if(value<1)return `${Math.max(10,Math.round(value*1000/10)*10)} м`;
  return `${value<10?value.toFixed(1):Math.round(value)} км`;
}

function normalizeSteps(plan,task,lang){
  const source=Array.isArray(plan?.solution_steps)?plan.solution_steps:[];
  const fallback=createFallbackPlan(task,{lang}).solution_steps;
  return (source.length?source:fallback).slice(0,4).map((step,index)=>({
    id:`${clean(step?.id)||"step"}-${index+1}`,
    title:clean(step?.title)||(lang==="uk"?`Крок ${index+1}`:`Step ${index+1}`),
    purpose:clean(step?.purpose)||clean(task),
    passport_terms:Array.isArray(step?.passport_terms)?step.passport_terms.map(clean).filter(Boolean).slice(0,8):[],
    nearby_query:clean(step?.nearby_query),
    internet_query:clean(step?.internet_query),
    nearby_relevant:step?.nearby_relevant!==false,
    internet_relevant:step?.internet_relevant!==false
  }));
}

function passportCandidate(profile,lang){
  return {
    kind:"passport",
    id:profile.slug||profile.name,
    source:lang==="uk"?"Паспорт можливостей":"Opportunity Passport",
    title:profile.headline||profile.name||(lang==="uk"?"Можливість користувача Atlas":"Atlas opportunity"),
    description:profile.can_help||profile.can_share||"",
    city:profile.city||"",
    passportUrl:profile.slug?`/p/${profile.slug}`:"",
    matchScore:Number(profile.score)||0,
    matchedTerms:Array.isArray(profile.matched)?profile.matched:[],
    resolved:true
  };
}

function placeCandidate(place,route,lang){
  return {
    ...place,
    kind:"place",
    source:lang==="uk"?"Поруч":"Nearby",
    title:place.name,
    description:[place.typeLabel,place.address].filter(Boolean).join(" · "),
    distanceKm:route?.distanceKm??place.straightDistanceKm,
    route,
    resolved:true
  };
}

function internetCandidate(item,index,lang){
  return {
    kind:"external",
    id:`external-${index}-${item.url}`,
    source:item.source_name||item.source_type||(lang==="uk"?"Інтернет":"Internet"),
    title:item.title,
    description:item.snippet||"",
    url:item.url,
    priceText:item.price_text||"",
    locationText:item.location_text||"",
    quantityTonnes:Number.isFinite(Number(item.quantity_tonnes))?Number(item.quantity_tonnes):null,
    quantityText:item.quantity_text||"",
    verificationText:item.verification_text||"",
    resultKind:item.result_kind||"source_page",
    googleMapsUrl:item.google_maps_url||"",
    resolved:["listing","store_option"].includes(item.result_kind)
  };
}

function googlePlaceUrl(candidate){
  if(candidate.googleMapsUri)return candidate.googleMapsUri;
  if(candidate.latitude==null||candidate.longitude==null)return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${candidate.latitude},${candidate.longitude}`)}`;
}

function CandidateAction({candidate,origin,lang}){
  if(candidate.kind==="passport"&&candidate.passportUrl){
    return <a className="chainAction" href={candidate.passportUrl}><UserRound size={16}/>{lang==="uk"?"Відкрити Паспорт":"Open Passport"}</a>;
  }
  if(candidate.kind==="place"){
    const mapsUrl=googlePlaceUrl(candidate);
    return <div className="chainActions">
      {origin&&<button className="chainAction" type="button" onClick={()=>openGoogleDirections(origin,candidate)}><Navigation size={16}/>{lang==="uk"?"Маршрут":"Route"}</button>}
      {mapsUrl&&<a className="chainAction secondaryAction" href={mapsUrl} target="_blank" rel="noreferrer"><MapPin size={16}/>Google Maps</a>}
      {candidate.phone&&<a className="chainAction secondaryAction" href={`tel:${candidate.phone}`}><Phone size={16}/>{lang==="uk"?"Подзвонити":"Call"}</a>}
      {!candidate.phone&&candidate.website&&<a className="chainAction secondaryAction" href={candidate.website} target="_blank" rel="noreferrer"><ExternalLink size={16}/>{lang==="uk"?"Сайт":"Website"}</a>}
    </div>;
  }
  if(candidate.kind==="external"&&candidate.url){
    if(candidate.resultKind==="store_option")return <div className="chainActions">
      {candidate.googleMapsUrl&&<a className="chainAction" href={candidate.googleMapsUrl} target="_blank" rel="noreferrer"><Navigation size={16}/>{lang==="uk"?`Маршрут до ${candidate.source}`:`Route to ${candidate.source}`}</a>}
      <a className="chainAction secondaryAction" href={candidate.url} target="_blank" rel="noreferrer"><ExternalLink size={16}/>{lang==="uk"?`Товар в ${candidate.source}`:`Product at ${candidate.source}`}</a>
    </div>;
    const actionLabel=candidate.resultKind==="maps_search"
      ?"Google Maps"
      :candidate.resultKind==="search_page"
        ?(lang==="uk"?`Шукати на ${candidate.source}`:`Search on ${candidate.source}`)
        :(lang==="uk"?"Відкрити товар / оголошення":"Open product / listing");
    return <div className="chainActions">
      <a className="chainAction" href={candidate.url} target="_blank" rel="noreferrer"><ExternalLink size={16}/>{actionLabel}</a>
      {candidate.googleMapsUrl&&candidate.googleMapsUrl!==candidate.url&&<a className="chainAction secondaryAction" href={candidate.googleMapsUrl} target="_blank" rel="noreferrer"><MapPin size={16}/>Google Maps</a>}
    </div>;
  }
  return null;
}

const TASK_STOP_WORDS=new Set([
  "потрібно","потрібен","потрібна","потрібні","треба","хочу","шукаю","знайти","купити","продати","орендувати",
  "мені","для","або","та","що","коли","який","яка","яке","у","в","на","по","до","від","кг","кілограмів",
  "need","needed","want","find","buy","sell","rent","for","with","the","and","or","kg"
]);

function subjectTokens(value){
  return String(value||"").toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu," ")
    .split(/\s+/)
    .filter(word=>word.length>2&&!TASK_STOP_WORDS.has(word)&&!/^[0-9]+$/.test(word))
    .map(word=>word.length>5?word.slice(0,5):word);
}

function passportMatchesTask(candidate,task){
  const taskTokens=subjectTokens(task);
  if(!taskTokens.length)return false;
  const candidateTokens=new Set(subjectTokens([
    candidate?.title,candidate?.description,candidate?.matchedTerms?.join(" ")
  ].filter(Boolean).join(" ")));
  return taskTokens.some(token=>candidateTokens.has(token));
}

function candidateIdentity(candidate){
  if(candidate?.kind==="external"&&["search_page","maps_search"].includes(candidate.resultKind)){
    return `${candidate.resultKind}:${candidate.source}`;
  }
  return candidate?.id||candidate?.url||candidate?.title||"";
}

function candidatePriority(candidate,task){
  if(candidate?.kind==="passport")return passportMatchesTask(candidate,task)
    ?500+Math.min(80,candidate.matchScore)
    :140+Math.min(40,candidate.matchScore);
  if(candidate?.kind==="external"&&candidate.resultKind==="store_option")return 480;
  if(candidate?.kind==="external"&&candidate.resultKind==="listing")return 450;
  if(candidate?.kind==="place")return 400;
  if(candidate?.kind==="external"&&candidate.resultKind==="search_page"){
    const sourceBonus={OLX:30,Rozetka:25,"Prom.ua":20}[candidate.source]||0;
    return 300+sourceBonus;
  }
  if(candidate?.kind==="external"&&candidate.resultKind==="maps_search")return 250;
  return candidate?100:0;
}

function recommendationReason(candidate,lang){
  if(candidate?.kind==="passport")return lang==="uk"
    ?"Збіг знайдено серед можливостей людей Atlas."
    :"A match was found among Atlas people's capabilities.";
  if(candidate?.kind==="external"&&candidate.resultKind==="listing")return lang==="uk"
    ?"Конкретна пропозиція, яку можна відкрити й перевірити у продавця."
    :"A concrete offer you can open and confirm with the seller.";
  if(candidate?.kind==="place")return lang==="uk"
    ?"Конкретне місце поруч із маршрутом і контактами."
    :"A specific nearby place with route and contact details.";
  if(candidate?.resultKind==="store_option")return lang==="uk"
    ?"Конкретний товар уже є в каталозі магазину; далі — перевірити потрібний залишок і їхати."
    :"A concrete product is already in the store catalogue; next confirm the required stock and go.";
  if(candidate?.resultKind==="search_page")return lang==="uk"
    ?"Прямий перехід до актуальних пропозицій без повторного введення запиту."
    :"A direct jump to current offers without retyping the request.";
  if(candidate?.resultKind==="maps_search")return lang==="uk"
    ?"Магазини поблизу вже відкриті за вашим запитом."
    :"Nearby stores are already opened for your request.";
  return "";
}

function ImmediateSolution({candidate,alternatives,origin,lang,stillSearching}){
  return <section className="immediateSolution">
    <div className="immediateSolutionTop">
      <span>{lang==="uk"?"НАЙКРАЩА ДОСТУПНА ДІЯ":"BEST AVAILABLE ACTION"}</span>
      {stillSearching&&<small><RefreshCw className="spin" size={13}/>{lang==="uk"?"Atlas ще перевіряє альтернативи":"Atlas is still checking alternatives"}</small>}
    </div>
    <div className="immediateSolutionBody">
      <div>
        <strong>{candidate.source}</strong>
        <h2>{candidate.title}</h2>
        {candidate.description&&<p>{candidate.description}</p>}
        <p className="recommendationReason">{recommendationReason(candidate,lang)}</p>
        <div className="chainMeta">
          {candidate.locationText&&<span><MapPin size={13}/>{candidate.locationText}</span>}
          {candidate.city&&<span><MapPin size={13}/>{candidate.city}</span>}
          {Number.isFinite(candidate.distanceKm)&&<span><MapPin size={13}/>{formatDistance(candidate.distanceKm)}</span>}
          {candidate.quantityText&&<span>{lang==="uk"?"Заявлено":"Declared"}: {candidate.quantityText}</span>}
          {candidate.priceText&&<span>{candidate.priceText}</span>}
        </div>
      </div>
      <CandidateAction candidate={candidate} origin={origin} lang={lang}/>
    </div>
    {alternatives.length>0&&<div className="immediateAlternatives">
      <strong>{lang==="uk"?"Ще конкретні варіанти":"More concrete options"}</strong>
      <div>
        {alternatives.map(alternative=><article key={alternative.id||alternative.url||alternative.title}>
          <div><span>{alternative.source}</span><h3>{alternative.title}</h3></div>
          <CandidateAction candidate={alternative} origin={origin} lang={lang}/>
        </article>)}
      </div>
    </div>}
  </section>;
}

function SolutionChain({chain,index,origin,lang}){
  const complete=chain.found===chain.steps.length;
  return <section className={`solutionChainCard ${index===0?"primaryChain":""}`}>
    <div className="solutionChainHead">
      <div>
        <span>{lang==="uk"?`Рішення ${index+1}`:`Solution ${index+1}`}</span>
        <h2>{chain.title}</h2>
        <p>{chain.description}</p>
      </div>
      <div className={`chainCompleteness ${complete?"complete":""}`}>
        <strong>{chain.found}/{chain.steps.length}</strong>
        <span>{lang==="uk"?"готових ланок":"ready links"}</span>
      </div>
    </div>

    <div className="chainSteps">
      {chain.steps.map((item,stepIndex)=><article className={`chainStep ${item.resolved?"found":item.candidate?"assisted":"missing"}`} key={item.step.id}>
        <div className="chainStepNumber">{item.resolved?<Check size={17}/>:item.candidate?<Search size={16}/>:stepIndex+1}</div>
        <div className="chainStepBody">
          <span className="chainStepLabel">{item.step.title}</span>
          {item.candidate?<>
            <h3>{item.candidate.title}</h3>
            {item.candidate.description&&<p>{item.candidate.description}</p>}
            <div className="chainMeta">
              <span>{item.candidate.source}</span>
              {item.candidate.city&&<span><MapPin size={13}/>{item.candidate.city}</span>}
              {item.candidate.locationText&&<span><MapPin size={13}/>{item.candidate.locationText}</span>}
              {Number.isFinite(item.candidate.distanceKm)&&<span><MapPin size={13}/>{formatDistance(item.candidate.distanceKm)}</span>}
              {Number.isFinite(item.candidate.route?.minutes)&&<span><Clock3 size={13}/>≈ {Math.max(1,Math.round(item.candidate.route.minutes))} хв</span>}
              {item.candidate.quantityText&&<span>{lang==="uk"?"Заявлено":"Declared"}: {item.candidate.quantityText}</span>}
              {item.candidate.priceText&&<span>{item.candidate.priceText}</span>}
            </div>
            {item.candidate.verificationText&&<small className="chainVerification">{lang==="uk"?item.candidate.verificationText:"Listing data — confirm availability, quantity and price with the seller"}</small>}
          </>:<>
            <h3>{lang==="uk"?"Надійного варіанта ще не знайдено":"No reliable option found yet"}</h3>
            <p>{item.step.purpose}</p>
          </>}
        </div>
        {item.candidate&&<CandidateAction candidate={item.candidate} origin={origin} lang={lang}/>}
        {item.alternatives?.length>0&&<div className="chainAlternatives">
          <strong>{lang==="uk"?"Ще варіанти":"More options"}</strong>
          {item.alternatives.map(alternative=><div className="chainAlternative" key={alternative.id||alternative.url||alternative.title}>
            <div>
              <span>{alternative.source}</span>
              <h4>{alternative.title}</h4>
              <div className="chainMeta">
                {alternative.quantityText&&<span>{lang==="uk"?"Заявлено":"Declared"}: {alternative.quantityText}</span>}
                {alternative.priceText&&<span>{alternative.priceText}</span>}
                {alternative.city&&<span><MapPin size={13}/>{alternative.city}</span>}
              </div>
            </div>
            <CandidateAction candidate={alternative} origin={origin} lang={lang}/>
          </div>)}
        </div>}
      </article>)}
    </div>
  </section>;
}

export default function Solution({lang}){
  const {state}=useLocation();
  const navigate=useNavigate();
  const initialTask=clean(state?.task);
  const initialWhere=clean(state?.where);
  const [task,setTask]=useState(initialTask);
  const [activeTask,setActiveTask]=useState(initialTask);
  const [plan,setPlan]=useState(()=>createFallbackPlan(initialTask,{lang}));
  const [brainLoading,setBrainLoading]=useState(Boolean(initialTask));
  const [brainError,setBrainError]=useState("");
  const [passportGroups,setPassportGroups]=useState([]);
  const [passportLoading,setPassportLoading]=useState(false);
  const [passportCheckedGoal,setPassportCheckedGoal]=useState("");
  const [searchScope,setSearchScope]=useState("");
  const [nearbyGroups,setNearbyGroups]=useState([]);
  const [nearbyLoading,setNearbyLoading]=useState(false);
  const [nearbyError,setNearbyError]=useState("");
  const [internetGroups,setInternetGroups]=useState([]);
  const [internetLoading,setInternetLoading]=useState(false);
  const [internetError,setInternetError]=useState("");
  const [typedOrigin,setTypedOrigin]=useState(null);
  const [originLoading,setOriginLoading]=useState(false);
  const [originError,setOriginError]=useState("");
  const geo=useGeolocation(state?.geoLocation||null);
  const origin=geo.location||typedOrigin;

  useEffect(()=>{
    if(!activeTask){
      setPlan(createFallbackPlan("",{lang}));
      setBrainLoading(false);
      return;
    }
    const controller=new AbortController();
    setPlan(createFallbackPlan(activeTask,{lang}));
    setBrainLoading(true);
    setBrainError("");
    setSearchScope("");
    setNearbyGroups([]);
    setInternetGroups([]);
    analyzeAtlasQuery(activeTask,{lang,location:state?.geoLocation||null,locationText:initialWhere,signal:controller.signal})
      .then(nextPlan=>setPlan(nextPlan))
      .catch(error=>{
        if(error?.name==="AbortError")return;
        setBrainError(error?.message||"atlas-brain-unavailable");
        setPlan(createFallbackPlan(activeTask,{lang}));
      })
      .finally(()=>{if(!controller.signal.aborted)setBrainLoading(false)});
    return()=>controller.abort();
  },[activeTask,lang,initialWhere,state?.geoLocation?.latitude,state?.geoLocation?.longitude]);

  const steps=useMemo(()=>normalizeSteps(plan,activeTask,lang),[plan,activeTask,lang]);
  const stepsKey=useMemo(()=>JSON.stringify(steps),[steps]);

  useEffect(()=>{
    let alive=true;
    if(!activeTask||brainLoading||!steps.length){
      setPassportGroups([]);
      setPassportCheckedGoal("");
      setPassportLoading(Boolean(activeTask&&brainLoading));
      return()=>{alive=false};
    }
    setPassportLoading(true);
    setPassportCheckedGoal("");
    setPassportGroups([]);
    Promise.all(steps.map(async step=>{
      const stepPlan={
        goal:step.purpose||activeTask,
        passport_search:{
          terms:step.passport_terms.length?step.passport_terms:plan?.passport_search?.terms||[],
          capability_description:step.purpose
        }
      };
      const {matches}=await searchPassportProfiles(stepPlan,{limit:2});
      return {stepId:step.id,matches:matches||[]};
    }))
      .then(groups=>{
        if(!alive)return;
        setPassportGroups(groups);
        trackAtlas("Atlas Passport Search Completed",{
          matches:new Set(groups.flatMap(group=>group.matches.map(match=>match.slug||match.name).filter(Boolean))).size,
          steps:groups.length,
          language:lang
        });
      })
      .catch(()=>{if(alive)setPassportGroups(steps.map(step=>({stepId:step.id,matches:[]})))})
      .finally(()=>{
        if(alive){
          setPassportLoading(false);
          setPassportCheckedGoal(activeTask);
        }
      });
    return()=>{alive=false};
  },[activeTask,brainLoading,stepsKey]);

  const passportsChecked=Boolean(activeTask&&!passportLoading&&!brainLoading&&passportCheckedGoal===activeTask);

  async function ensureOrigin(){
    if(origin)return origin;
    setOriginError("");
    if(initialWhere){
      setOriginLoading(true);
      try{
        const places=await searchDestination(null,initialWhere,{lang,limit:1});
        const place=places[0];
        if(!place)throw new Error("location-not-found");
        const next={latitude:place.latitude,longitude:place.longitude,label:initialWhere};
        setTypedOrigin(next);
        return next;
      }catch(error){
        setOriginError(error?.message||"location-not-found");
        return null;
      }finally{setOriginLoading(false)}
    }
    const next=await geo.requestLocation();
    return next||null;
  }

  useEffect(()=>{
    if(!passportsChecked||plan?.clarification?.required||searchScope)return;
    setSearchScope("both");
    setNearbyError("");
    setInternetError("");
    trackAtlas("Atlas Automatic Search Started",{
      language:lang,
      location_provided:Boolean(initialWhere||origin)
    });
    if(initialWhere&&!origin&&!originLoading)ensureOrigin();
  },[passportsChecked,plan?.clarification?.required,searchScope,initialWhere]);

  useEffect(()=>{
    const controller=new AbortController();
    if(!passportsChecked||!(searchScope==="nearby"||searchScope==="both")){
      setNearbyGroups([]);
      setNearbyLoading(false);
      return()=>controller.abort();
    }
    if(!origin){
      setNearbyLoading(false);
      return()=>controller.abort();
    }
    const searchable=steps.filter(step=>step.nearby_relevant&&step.nearby_query);
    if(!searchable.length){
      setNearbyGroups([]);
      setNearbyLoading(false);
      return()=>controller.abort();
    }
    setNearbyLoading(true);
    setNearbyError("");
    Promise.all(searchable.map(async step=>{
      try{
        const places=await searchNearbyPlaces(origin,step.nearby_query,{lang,limit:2,signal:controller.signal});
        const candidates=await Promise.all(places.slice(0,2).map(async(place,index)=>{
          const route=index===0?await getDrivingRoute(origin,place,{lang,signal:controller.signal}).catch(()=>null):null;
          return placeCandidate(place,route,lang);
        }));
        return {stepId:step.id,candidates,error:false};
      }catch(error){
        if(error?.name==="AbortError")throw error;
        return {stepId:step.id,candidates:[],error:true};
      }
    }))
      .then(groups=>{
        if(controller.signal.aborted)return;
        setNearbyGroups(groups);
        trackAtlas("Atlas Nearby Search Completed",{
          results:groups.reduce((total,group)=>total+group.candidates.length,0),
          partial_error:groups.some(group=>group.error),
          language:lang
        });
        if(groups.some(group=>group.error))setNearbyError("partial-nearby-search");
      })
      .catch(error=>{
        if(error?.name!=="AbortError"&&!controller.signal.aborted){
          setNearbyGroups([]);
          setNearbyError(error?.message||"nearby-search-unavailable");
        }
      })
      .finally(()=>{if(!controller.signal.aborted)setNearbyLoading(false)});
    return()=>controller.abort();
  },[passportsChecked,searchScope,origin?.latitude,origin?.longitude,stepsKey,lang]);

  useEffect(()=>{
    const controller=new AbortController();
    if(!passportsChecked||!(searchScope==="internet"||searchScope==="both")){
      setInternetGroups([]);
      setInternetLoading(false);
      return()=>controller.abort();
    }
    const searchable=steps.filter(step=>step.internet_relevant&&step.internet_query);
    if(!searchable.length){
      setInternetGroups([]);
      setInternetLoading(false);
      return()=>controller.abort();
    }
    setInternetLoading(true);
    setInternetError("");
    const plannedSources=(plan?.external_searches||[]).filter(item=>["web","marketplace","official"].includes(item?.source));
    Promise.all(searchable.map(async(step,index)=>{
      try{
        const source=sourceForInternetStep(step,plannedSources,index);
        const results=await searchExternalSources({
          goal:activeTask,
          domain:plan?.domain||"",
          solution_scope:plan?.solution_scope||"",
          location_text:initialWhere,
          external_searches:[{source,mode:"standard",query:step.internet_query,reason:step.purpose}]
        },{lang,signal:controller.signal});
        return {stepId:step.id,candidates:results.slice(0,5).map((item,resultIndex)=>internetCandidate(item,resultIndex,lang)),error:false};
      }catch(error){
        if(error?.name==="AbortError")throw error;
        return {stepId:step.id,candidates:[],error:true};
      }
    }))
      .then(groups=>{
        if(controller.signal.aborted)return;
        setInternetGroups(groups);
        trackAtlas("Atlas Internet Search Completed",{
          results:groups.reduce((total,group)=>total+group.candidates.length,0),
          partial_error:groups.some(group=>group.error),
          language:lang
        });
        if(groups.some(group=>group.error))setInternetError("partial-internet-search");
      })
      .catch(error=>{
        if(error?.name!=="AbortError"&&!controller.signal.aborted){
          setInternetGroups([]);
          setInternetError(error?.message||"internet-search-unavailable");
        }
      })
      .finally(()=>{if(!controller.signal.aborted)setInternetLoading(false)});
    return()=>controller.abort();
  },[passportsChecked,searchScope,stepsKey,activeTask,lang,plan]);

  const passportByStep=useMemo(()=>new Map(passportGroups.map(group=>[
    group.stepId,
    group.matches[0]?passportCandidate(group.matches[0],lang):null
  ])),[passportGroups,lang]);
  const nearbyByStep=useMemo(()=>new Map(nearbyGroups.map(group=>[group.stepId,group.candidates||[]])),[nearbyGroups]);
  const internetByStep=useMemo(()=>new Map(internetGroups.map(group=>[group.stepId,group.candidates||[]])),[internetGroups]);

  const rankedCandidates=useMemo(()=>{
    const candidates=[
      ...passportGroups.flatMap(group=>group.matches.slice(0,2).map(match=>passportCandidate(match,lang))),
      ...nearbyGroups.flatMap(group=>group.candidates||[]),
      ...internetGroups.flatMap(group=>group.candidates||[])
    ];
    return candidates
      .filter(Boolean)
      .filter((candidate,index,array)=>array.findIndex(item=>candidateIdentity(item)===candidateIdentity(candidate))===index)
      .sort((a,b)=>candidatePriority(b,activeTask)-candidatePriority(a,activeTask));
  },[passportGroups,nearbyGroups,internetGroups,lang,activeTask]);
  const recommendedCandidate=rankedCandidates[0]||null;
  const recommendedAlternatives=rankedCandidates.slice(1,5);

  const chains=useMemo(()=>{
    if(!searchScope)return [];
    const build=(mode,{preferExternal=false}={})=>{
      const items=steps.map(step=>{
        const passport=passportByStep.get(step.id);
        const externalCandidates=(mode==="nearby"?nearbyByStep.get(step.id):internetByStep.get(step.id))||[];
        const external=externalCandidates[0]||null;
        const candidate=preferExternal?(external||passport):(passport||external);
        const alternatives=[passport,...externalCandidates]
          .filter(Boolean)
          .filter(option=>option!==candidate)
          .filter((option,optionIndex,array)=>array.findIndex(item=>(item.id||item.url||item.title)===(option.id||option.url||option.title))===optionIndex)
          .slice(0,2);
        return {step,candidate,alternatives,resolved:Boolean(candidate?.resolved)};
      });
      return {...{steps:items,found:items.filter(item=>item.resolved).length},mode};
    };
    if(searchScope==="nearby")return [{
      ...build("nearby"),
      title:lang==="uk"?"Паспорти + варіанти поруч":"Passports + nearby options",
      description:lang==="uk"?"Люди Atlas мають пріоритет; відсутні ланки доповнено місцевими сервісами.":"Atlas people have priority; missing links are completed with local services."
    }];
    if(searchScope==="internet")return [{
      ...build("internet"),
      title:lang==="uk"?"Паспорти + весь інтернет":"Passports + the wider internet",
      description:lang==="uk"?"Паспорти мають пріоритет; відсутні ланки доповнено маркетплейсами та перевіреними джерелами.":"Passports have priority; missing links are completed with marketplaces and verified sources."
    }];
    return [{
      ...build("nearby"),
      title:lang==="uk"?"Паспорти + поруч":"Passports + nearby",
      description:lang==="uk"?"Практичний місцевий ланцюжок із пріоритетом можливостей людей Atlas.":"A practical local chain prioritizing Atlas people's capabilities."
    },{
      ...build("internet",{preferExternal:true}),
      title:lang==="uk"?"Інтернет-альтернатива":"Internet alternative",
      description:lang==="uk"?"Окремий ланцюжок для порівняння з пропозиціями маркетплейсів і мережі.":"A separate chain for comparison with marketplace and web results."
    }];
  },[searchScope,steps,passportByStep,nearbyByStep,internetByStep,lang]);

  function submit(event){
    event.preventDefault();
    const value=clean(task);
    if(value){
      trackAtlas("Atlas Search Submitted",{
        language:lang,
        location_provided:Boolean(initialWhere||origin),
        source:"solution"
      });
      setActiveTask(value);
    }
  }

  function refine(option){
    const value=`${activeTask.replace(/[,.]+$/g,"")}, ${option}`;
    trackAtlas("Atlas Search Refined",{language:lang});
    setTask(value);
    setActiveTask(value);
  }

  function chooseSearchScope(scope){
    setSearchScope(scope);
    setNearbyError("");
    setInternetError("");
    trackAtlas("Atlas Search Scope Selected",{scope,language:lang});
    if((scope==="nearby"||scope==="both")&&initialWhere&&!origin&&!originLoading)ensureOrigin();
  }

  const externalBusy=nearbyLoading||internetLoading||originLoading;
  const solutionBusy=brainLoading||passportLoading||externalBusy||Boolean(activeTask&&!searchScope&&!plan?.clarification?.required);
  const locationText=origin?(initialWhere||(lang==="uk"?"поточна локація":"current location")):(initialWhere||(lang==="uk"?"не визначена":"not set"));

  return <main className="simpleSolutionPage">
    <section className="simpleSolutionShell">
      <a className="simpleBack" href="#" onClick={event=>{event.preventDefault();navigate(-1)}}><ArrowLeft size={17}/>{lang==="uk"?"Назад":"Back"}</a>

      <form className="simpleQueryForm" onSubmit={submit}>
        <input value={task} onChange={event=>setTask(event.target.value)} placeholder={lang==="uk"?"Що вам потрібно?":"What do you need?"}/>
        <button type="submit" aria-label={lang==="uk"?"Знайти":"Search"}><Search size={25}/></button>
      </form>

      <div className="simpleLocationRow">
        <MapPin size={17}/><span>{lang==="uk"?"Локація:":"Location:"}</span><strong>{locationText}</strong>
        {!initialWhere&&<button className="simpleLocationAction" type="button" onClick={()=>geo.requestLocation()} disabled={geo.loading}>{geo.loading?(lang==="uk"?"Визначаю…":"Locating…"):(origin?(lang==="uk"?"Оновити":"Refresh"):(lang==="uk"?"Визначити":"Detect"))}</button>}
      </div>

      <div className="simpleResultsHeader">
        <div>
          <span className="solutionKicker">ATLAS · {lang==="uk"?"РІШЕННЯ":"SOLUTION"}</span>
          <h1>{plan?.clarification?.required
            ?(lang==="uk"?"Потрібне одне уточнення":"One quick question")
            :recommendedCandidate
              ?(lang==="uk"?"Ось що можна зробити зараз":"Here is what you can do now")
              :(lang==="uk"?"Atlas шукає найкраще рішення…":"Atlas is finding the best solution…")}
          </h1>
          {plan?.goal&&<p>{plan.goal}</p>}
        </div>
        {plan?.safety?.level&&plan.safety.level!=="none"&&plan.safety.message&&<div className={`simpleSafety ${plan.safety.level}`}>{plan.safety.message}</div>}
      </div>

      {plan?.clarification?.required&&<div className="simpleClarifier">
        <strong>{plan.clarification.question}</strong>
        {Array.isArray(plan.clarification.options)&&plan.clarification.options.length>0&&<div className="simpleClarifierChips">{plan.clarification.options.map(option=><button key={option} type="button" onClick={()=>refine(option)}>{option}</button>)}</div>}
      </div>}

      {!plan?.clarification?.required&&activeTask&&<section className="searchScopePicker">
        <div className="scopeHeading">
          <span>{lang==="uk"?"ВАШ ВИБІР":"YOUR CHOICE"}</span>
          <h2>{lang==="uk"?"Де шукати?":"Where should Atlas search?"}</h2>
          <p>{lang==="uk"?"Оберіть джерела — результат перебудується одразу.":"Choose the sources — the result updates immediately."}</p>
        </div>
        <div className="scopeButtons" role="group" aria-label={lang==="uk"?"Де шукати":"Where to search"}>
          <button className={searchScope==="nearby"?"active":""} type="button" onClick={()=>chooseSearchScope("nearby")} disabled={!passportsChecked} aria-pressed={searchScope==="nearby"}>
            <MapPin size={21}/><span><strong>{lang==="uk"?"Поруч":"Nearby"}</strong><small>{lang==="uk"?"Магазини та маршрут":"Stores and route"}</small></span>
          </button>
          <button className={searchScope==="internet"?"active":""} type="button" onClick={()=>chooseSearchScope("internet")} disabled={!passportsChecked} aria-pressed={searchScope==="internet"}>
            <Globe2 size={21}/><span><strong>{lang==="uk"?"В інтернеті":"Online"}</strong><small>{lang==="uk"?"АТБ і маркетплейси":"ATB and marketplaces"}</small></span>
          </button>
          <button className={searchScope==="both"?"active":""} type="button" onClick={()=>chooseSearchScope("both")} disabled={!passportsChecked} aria-pressed={searchScope==="both"}>
            <Search size={21}/><span><strong>{lang==="uk"?"Поруч + інтернет":"Nearby + online"}</strong><small>{lang==="uk"?"Порівняти всі варіанти":"Compare all options"}</small></span>
          </button>
        </div>
      </section>}

      {!plan?.clarification?.required&&recommendedCandidate&&<ImmediateSolution
        candidate={recommendedCandidate}
        alternatives={recommendedAlternatives}
        origin={origin}
        lang={lang}
        stillSearching={solutionBusy}
      />}

      {!plan?.clarification?.required&&!recommendedCandidate&&solutionBusy&&<div className="solutionSearchState">
        <RefreshCw className="spin" size={20}/>
        <div>
          <strong>{lang==="uk"?"Шукаю конкретні варіанти":"Finding concrete options"}</strong>
          <span>{lang==="uk"?"Atlas сам перевіряє Паспорти, пропозиції поруч і маркетплейси.":"Atlas is automatically checking Passports, nearby options and marketplaces."}</span>
        </div>
      </div>}

      {(searchScope==="nearby"||searchScope==="both")&&!origin&&!originLoading&&<div className="simpleGeoPrompt">
        <div><strong>{lang==="uk"?"Додати найближчі магазини й маршрут":"Add nearby stores and a route"}</strong><span>{lang==="uk"?"Це доповнить уже автоматичний пошук. Координати не зберігаються.":"This adds to the automatic search. Coordinates are not stored."}</span></div>
        <button className="primary" type="button" onClick={ensureOrigin}><MapPin size={18}/>{lang==="uk"?"Додати мою локацію":"Add my location"}</button>
      </div>}

      {originError&&<div className="simpleEmpty">{lang==="uk"?"Не вдалося визначити цю локацію. Вкажіть місто на головній сторінці або дозвольте геолокацію.":"Could not resolve this location. Enter a city on the home page or allow geolocation."}</div>}

      {!plan?.clarification?.required&&!recommendedCandidate&&!solutionBusy&&<div className="simpleEmpty">
        {lang==="uk"?"Надійного готового варіанта поки не знайдено. Atlas не показує загальні статті як рішення.":"No reliable ready option was found. Atlas does not present generic articles as a solution."}
      </div>}

      {recommendedCandidate&&chains.length>0&&<details className="solutionDetails">
        <summary>{lang==="uk"?"Повний ланцюжок і перевірені джерела":"Full chain and checked sources"}</summary>
        <div className="solutionChains">{chains.map((chain,index)=><SolutionChain key={chain.mode} chain={chain} index={index} origin={origin} lang={lang}/>)}</div>
      </details>}

      {(passportsChecked||brainError||nearbyError||internetError)&&<div className="solutionChecks">
        {passportsChecked&&<span><Check size={14}/>{lang==="uk"?"Паспорти можливостей перевірено":"Opportunity Passports checked"}</span>}
        {(nearbyError||internetError)&&<span>{lang==="uk"?"Частина джерел не відповіла — Atlas не підмінив їх вигаданими даними.":"Some sources did not respond — Atlas did not replace them with invented data."}</span>}
        {brainError&&<span>{lang==="uk"?"Аналіз запиту виконано в резервному режимі.":"The request was analyzed in fallback mode."}</span>}
      </div>}
    </section>
  </main>;
}
