import {useEffect,useMemo,useRef,useState} from "react";
import {Link,useLocation,useSearchParams} from "react-router-dom";
import {
  ArrowLeft,Check,Clock3,ExternalLink,Globe2,HeartHandshake,MapPin,Navigation,
  MessageCircle,Phone,RefreshCw,Search,UserRound
} from "lucide-react";
import {analyzeAtlasQuery,createFallbackPlan,createPassportSeedPlan} from "../services/atlasBrain";
import {searchPassportProfiles} from "../services/passportSearch";
import {searchExternalSources} from "../services/externalSearch";
import {searchAtlasNeeds} from "../services/needSearchStore";
import {getDrivingRoute,openGoogleDirections,searchDestination,searchNearbyPlaces} from "../services/googleMaps";
import {trackAtlas,trackAtlasActivity} from "../services/analytics";
import useGeolocation from "../hooks/useGeolocation";
import SearchHistoryList from "../components/SearchHistoryList";
import VoiceTaskInput from "../components/VoiceTaskInput";
import {saveSearchHistory} from "../services/searchHistory";
import {createAvailabilityCheck,loadMyPassport} from "../services/passportStore";
import "../styles/simpleSolution.css";
import "../styles/solutionChains.css";

function clean(value){return String(value||"").replace(/\s+/g," ").trim()}
function searchCore(value){
  let text=clean(value);
  const patterns=[
    /^(?:будь ласка\s+)?(?:мені\s+)?(?:потрібен|потрібна|потрібні|потрібно|треба|хочу|шукаю)\s+/iu,
    /^(?:будь ласка\s+)?(?:знайди|покажи)\s+(?:мені\s+)?/iu,
    /^(?:i\s+)?(?:need|want|am looking for|looking for|find me|show me)\s+/iu
  ];
  for(let i=0;i<3;i++){
    const before=text;
    for(const pattern of patterns)text=text.replace(pattern,"");
    text=clean(text);
    if(text===before)break;
  }
  return text||clean(value);
}
function savedAtlasCity(){try{return clean(localStorage.getItem("atlas-city")||"")}catch{return ""}}
function genericMoneyClarification(value,lang="uk"){
  const text=clean(value).toLowerCase();
  if(!/^(?:мені\s+)?(?:потрібні|потрібно|треба|хочу)?\s*(?:кошти|гроші|фінансування|money|funding)\s*$/iu.test(text))return null;
  return lang==="uk"
    ?{required:true,question:"Яким способом ви хочете отримати кошти?",helper_text:"Оберіть напрямок — тоді Atlas зможе шукати конкретне рішення.",options:["Знайти інвестора","Знайти кредит або позику","Знайти грант","Знайти роботу або заробіток","Продати товар чи майно"]}
    :{required:true,question:"How do you want to obtain the money?",helper_text:"Choose a direction so Atlas can search for a concrete solution.",options:["Find an investor","Find a loan","Find a grant","Find work or income","Sell goods or assets"]};
}


function sourceForInternetStep(step,plannedSources,index){
  const planned=plannedSources[index]?.source||plannedSources[0]?.source;
  if(planned)return planned;
  const text=`${step?.title||""} ${step?.purpose||""} ${step?.internet_query||""}`;
  const commerce=/куп|прод|придба|замов|опт|гурт|товар|постач|маркетплейс|оголош|buy|sell|order|wholesale|supplier|marketplace|listing/i.test(text)
    ||/\d+(?:[\s.]\d{3})*(?:[.,]\d+)?\s*(?:кг(?!\p{L})|kg\b|кілограм(?:ів|и|а)?|т(?!\p{L})|тонн(?:а|и|у)?|пар(?:а|и)?|шт(?:\.|ук(?:а|и|ів)?)?|упаков\p{L}*|пач\p{L}*|короб\p{L}*|ящик\p{L}*|комплект\p{L}*|pairs?|pcs?|packs?|boxes?|sets?)(?!\p{L})/iu.test(text);
  return commerce?"marketplace":"web";
}

function formatDistance(value){
  if(!Number.isFinite(value))return "";
  if(value<1)return `${Math.max(10,Math.round(value*1000/10)*10)} м`;
  return `${value<10?value.toFixed(1):Math.round(value)} км`;
}

const currencySymbols={UAH:"грн",USD:"$",EUR:"€"};

function structuredPrice(candidate){
  const value=Number(String(candidate?.priceValue||"").replace(",","."));
  if(!Number.isFinite(value)||value<0||!candidate?.priceUnit)return null;
  return {value,unit:candidate.priceUnit,currency:candidate.currency||"UAH"};
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

function passportCandidate(profile,lang,task=""){
  const priceValue=profile.price_value==null?"":String(profile.price_value);
  const priceUnit=profile.price_unit||"";
  const currency=profile.currency||"UAH";
  const paymentType=profile.payment_type||"free";
  const priceText=paymentType==="paid"&&priceValue&&priceUnit
    ?`${priceValue} ${currencySymbols[currency]||currency} / ${priceUnit}`
    :paymentType==="exchange"
      ?(lang==="uk"?"Обмін":"Exchange")
      :paymentType==="negotiable"
        ?(lang==="uk"?"За домовленістю":"Negotiable")
        :(lang==="uk"?"Безкоштовно":"Free");
  const passportUrl=profile.slug?`/p/${profile.slug}`:"";
  const contactParams=new URLSearchParams();
  if(profile.opportunity_id)contactParams.set("opportunity",profile.opportunity_id);
  else contactParams.set("contact","1");
  if(task)contactParams.set("need",task);
  return {
    kind:"passport",
    id:profile.slug||profile.name,
    source:lang==="uk"?"Паспорт можливостей":"Opportunity Passport",
    title:profile.headline||profile.name||(lang==="uk"?"Можливість користувача Atlas":"Atlas opportunity"),
    description:profile.can_help||profile.can_share||"",
    city:profile.city||"",
    passportUrl,
    contactUrl:passportUrl?`${passportUrl}?${contactParams.toString()}`:"",
    passportId:profile.passport_id||"",
    opportunityId:profile.opportunity_id||"",
    matchScore:Number(profile.score)||0,
    matchedTerms:Array.isArray(profile.matched)?profile.matched:[],
    paymentType,
    priceValue,
    priceUnit,
    currency,
    priceText,
    minimumQuantity:profile.minimum_quantity||"",
    deliveryIncluded:Boolean(profile.delivery_included),
    resolved:true
  };
}

function needResultTitle(item,lang){
  const text=clean(item?.description);
  if(text)return text;
  const label=clean(item?.item_key)||(lang==="uk"?"Потреба":"Need");
  const quantity=Number(item?.quantity);
  const amount=Number.isFinite(quantity)&&quantity>0?` · ${quantity.toLocaleString(lang==="uk"?"uk-UA":"en-GB")} ${item?.unit||""}`:"";
  return `${label}${amount}`;
}

function historicalPassportCandidate(profile,lang){
  return {
    kind:"passport_history",
    id:`history-${profile.opportunity_id||profile.slug||profile.name}`,
    source:lang==="uk"?"Паспорт можливостей":"Opportunity Passport",
    title:profile.name
      ?(lang==="uk"?`${profile.name} — потрібно підтвердити`:`${profile.name} — needs confirmation`)
      :(lang==="uk"?"Раніше була схожа можливість":"A similar opportunity existed before"),
    description:lang==="uk"
      ?"У цьому Паспорті нещодавно була схожа можливість, але її термін дії вже закінчився."
      :"This Passport recently had a similar opportunity, but it has expired.",
    city:profile.city||"",
    passportUrl:profile.slug?`/p/${profile.slug}`:"",
    passportId:profile.passport_id||"",
    opportunityId:profile.opportunity_id||"",
    matchedTerms:Array.isArray(profile.matched)?profile.matched:[],
    matchScore:Number(profile.score)||0,
    resolved:false
  };
}

function placeCandidate(place,route,lang,{resolved=true,verificationText=""}={}){
  return {
    ...place,
    kind:"place",
    source:place.source|| (lang==="uk"?"Поруч":"Nearby"),
    title:place.name,
    description:[place.typeLabel,place.address].filter(Boolean).join(" · "),
    distanceKm:route?.distanceKm??place.straightDistanceKm,
    route,
    verificationText,
    resolved
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
    priceValue:item.price_value==null?"":String(item.price_value),
    priceUnit:item.price_unit||"",
    currency:item.currency||"UAH",
    locationText:item.location_text||"",
    quantityTonnes:Number.isFinite(Number(item.quantity_tonnes))?Number(item.quantity_tonnes):null,
    quantityText:item.quantity_text||"",
    verificationText:item.verification_text||"",
    resultKind:item.result_kind||"source_page",
    googleMapsUrl:item.google_maps_url||"",
    resolved:["listing","store_option","search_page","web_answer","web_result","official_result"].includes(item.result_kind)
  };
}

function aiAnswerCandidate(plan,lang){
  const answer=clean(plan?.answer);
  if(!answer||plan?.solution_scope!=="information")return null;
  return {
    kind:"answer",
    id:"atlas-direct-answer",
    source:"Atlas",
    title:lang==="uk"?"Відповідь":"Answer",
    description:answer,
    resolved:true
  };
}

function directCandidate(action,locationText,lang){
  if(!action)return null;
  const mapsQuery=[clean(action.maps_query),clean(locationText)].filter(Boolean).join(" ");
  return {
    kind:"direct",
    id:action.id||"direct-action",
    source:action.source||(lang==="uk"?"Наступна дія":"Next action"),
    title:action.title,
    description:action.description||"",
    recommendation:action.recommendation||"",
    actionType:action.type||"direct",
    url:action.primary_href||"",
    actionLabel:action.primary_label||"",
    secondaryUrl:action.secondary_href||"",
    secondaryLabel:action.secondary_label||"",
    googleMapsUrl:mapsQuery?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`:"",
    resolved:true
  };
}

function automaticSearchScope(plan,steps){
  if(plan?.direct_action?.type==="emergency")return "direct";
  const searches=Array.isArray(plan?.external_searches)?plan.external_searches:[];
  const hasNearby=searches.some(item=>item?.source==="maps")||steps.some(step=>step.nearby_relevant&&step.nearby_query);
  const hasInternet=searches.some(item=>["web","marketplace","official"].includes(item?.source))||steps.some(step=>step.internet_relevant&&step.internet_query);
  if(hasNearby&&hasInternet)return "both";
  if(hasNearby)return "nearby";
  if(hasInternet)return "internet";
  return "direct";
}

function googlePlaceUrl(candidate){
  if(candidate.googleMapsUri)return candidate.googleMapsUri;
  if(candidate.latitude==null||candidate.longitude==null)return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${candidate.latitude},${candidate.longitude}`)}`;
}

function CandidateAction({candidate,origin,lang}){
  const [confirmBusy,setConfirmBusy]=useState(false);
  const [confirmDone,setConfirmDone]=useState(false);
  if(candidate.kind==="passport"&&candidate.passportUrl){
    return <div className="chainActions">
      <Link className="chainAction" to={candidate.contactUrl||candidate.passportUrl}><MessageCircle size={16}/>{lang==="uk"?"Написати":"Message"}</Link>
      <Link className="chainAction secondaryAction" to={candidate.passportUrl}><UserRound size={16}/>{lang==="uk"?"Паспорт":"Passport"}</Link>
    </div>;
  }
  if(candidate.kind==="passport_history"){
    async function confirmAvailability(){
      if(confirmBusy||confirmDone||!candidate.passportId||!candidate.opportunityId)return;
      setConfirmBusy(true);
      try{
        await createAvailabilityCheck({
          passportId:candidate.passportId,
          opportunityId:candidate.opportunityId,
          message:lang==="uk"?"Чи актуальна ще ця можливість?":"Is this opportunity still available?"
        });
        setConfirmDone(true);
      }catch{}finally{setConfirmBusy(false)}
    }
    return <div className="chainActions">
      <button className="chainAction" type="button" onClick={confirmAvailability} disabled={confirmBusy||confirmDone}>
        <RefreshCw size={16}/>{confirmDone?(lang==="uk"?"Запит надіслано":"Request sent"):(confirmBusy?(lang==="uk"?"Надсилаю…":"Sending…"):(lang==="uk"?"Запитати, чи актуально":"Ask if still available"))}
      </button>
      {candidate.passportUrl&&<a className="chainAction secondaryAction" href={candidate.passportUrl}><UserRound size={16}/>{lang==="uk"?"Паспорт":"Passport"}</a>}
    </div>;
  }
  if(candidate.kind==="direct"){
    if(candidate.actionType==="emergency")return <div className="chainActions">
      {candidate.url&&<a className="chainAction emergencyAction" href={candidate.url}><Phone size={16}/>{candidate.actionLabel}</a>}
      {candidate.secondaryUrl&&<a className="chainAction secondaryAction" href={candidate.secondaryUrl}><Phone size={16}/>{candidate.secondaryLabel}</a>}
    </div>;
    if(candidate.googleMapsUrl)return <div className="chainActions">
      <a className="chainAction" href={candidate.googleMapsUrl} target="_blank" rel="noreferrer"><Navigation size={16}/>{candidate.actionLabel||(lang==="uk"?"Знайти допомогу поруч":"Find nearby help")}</a>
    </div>;
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
  if(candidate.kind==="external"&&["official_result","web_answer","web_result"].includes(candidate.resultKind)&&candidate.url){
    return <div className="chainActions">
      <a className="chainAction" href={candidate.url} target="_blank" rel="noreferrer"><ExternalLink size={16}/>{lang==="uk"?"Відкрити":"Open"}</a>
      {candidate.googleMapsUrl&&<a className="chainAction secondaryAction" href={candidate.googleMapsUrl} target="_blank" rel="noreferrer"><MapPin size={16}/>Google Maps</a>}
    </div>;
  }
  if(candidate.kind==="external"&&candidate.url){
    if(candidate.resultKind==="store_option")return <div className="chainActions">
      {candidate.googleMapsUrl&&<a className="chainAction" href={candidate.googleMapsUrl} target="_blank" rel="noreferrer"><Navigation size={16}/>{lang==="uk"?`Маршрут до ${candidate.source}`:`Route to ${candidate.source}`}</a>}
      <a className="chainAction secondaryAction" href={candidate.url} target="_blank" rel="noreferrer"><ExternalLink size={16}/>{lang==="uk"?`Товар в ${candidate.source}`:`Product at ${candidate.source}`}</a>
    </div>;
    if(candidate.resultKind==="store_option_pending")return <div className="chainActions">
      <a className="chainAction secondaryAction" href={candidate.url} target="_blank" rel="noreferrer"><ExternalLink size={16}/>{lang==="uk"?`Уточнити в ${candidate.source}`:`Confirm with ${candidate.source}`}</a>
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
  "допомога","допомоги","допомогу","допомогти","поміч","покупка","покупки","покупці","покупкою","придбання","придбанні",
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
  const taskText=String(task||"").toLowerCase();
  const candidateText=[
    candidate?.title,candidate?.description,candidate?.matchedTerms?.join(" ")
  ].filter(Boolean).join(" ").toLowerCase();

  const taskTokens=subjectTokens(task);
  const candidateTokens=new Set(subjectTokens(candidateText));
  const subjectMatch=taskTokens.some(token=>candidateTokens.has(token));
  if(subjectMatch)return true;

  const assistanceTask=/допомог|поміч|привез|підвез|достав|help|assist|deliver|pickup/iu.test(taskText);
  if(!assistanceTask)return false;

  // Assistance is relevant only when it can actually execute the task:
  // shopping / delivery / pickup / transport. A generic "I can help" attached
  // to an unrelated skill (for example computer repair) is not a match.
  const taskExecutionCapability=/покуп|придба|закуп|достав|привез|підвез|забрат|кур'єр|курєр|перевез|shopping|purchase|buying|deliver|delivery|courier|pickup|transport/iu.test(candidateText);
  return taskExecutionCapability;
}

function candidateIdentity(candidate){
  if(candidate?.kind==="external"&&["search_page","maps_search"].includes(candidate.resultKind)){
    return `${candidate.resultKind}:${candidate.source}`;
  }
  return candidate?.id||candidate?.url||candidate?.title||"";
}

function candidatePriority(candidate,task){
  if(candidate?.kind==="answer")return 900;
  if(candidate?.kind==="direct"&&candidate.actionType==="emergency")return 1000;
  if(candidate?.kind==="passport")return passportMatchesTask(candidate,task)
    ?500+Math.min(80,candidate.matchScore)
    :140+Math.min(40,candidate.matchScore);
  if(candidate?.kind==="passport_history")return 40+Math.min(20,candidate.matchScore);
  if(candidate?.kind==="external"&&candidate.resultKind==="store_option")return 480;
  if(candidate?.kind==="external"&&candidate.resultKind==="listing")return 450;
  if(candidate?.kind==="external"&&["official_result","web_answer","web_result"].includes(candidate.resultKind))return 420;
  if(candidate?.kind==="place")return candidate.resolved?400:190;
  if(candidate?.kind==="direct")return 360;
  if(candidate?.kind==="external"&&candidate.resultKind==="store_option_pending")return 180;
  if(candidate?.kind==="external"&&candidate.resultKind==="search_page"){
    const sourceBonus={OLX:30,Rozetka:25,"Prom.ua":20}[candidate.source]||0;
    return 300+sourceBonus;
  }
  if(candidate?.kind==="external"&&candidate.resultKind==="maps_search")return 250;
  return candidate?100:0;
}

function recommendationReason(candidate,lang){
  if(candidate?.kind==="answer")return lang==="uk"?"Відповідь Atlas.":"Atlas answer.";
  if(candidate?.kind==="direct")return candidate.recommendation||"";
  if(candidate?.kind==="passport")return lang==="uk"
    ?"Збіг знайдено серед можливостей людей і компаній Atlas."
    :"A match was found among Atlas people and companies' capabilities.";
  if(candidate?.kind==="external"&&["web_answer","official_result","web_result"].includes(candidate.resultKind))return lang==="uk"
    ?"Актуальна відповідь із зовнішнього джерела, яку Atlas знайшов для цього запиту."
    :"A current answer from an external source found by Atlas for this request.";
  if(candidate?.kind==="external"&&candidate.resultKind==="listing")return lang==="uk"
    ?"Конкретна пропозиція, яку можна відкрити й перевірити у продавця."
    :"A concrete offer you can open and confirm with the seller.";
  if(candidate?.kind==="place")return lang==="uk"
    ?"Конкретне місце поруч із маршрутом і контактами."
    :"A specific nearby place with route and contact details.";
  if(candidate?.resultKind==="store_option")return lang==="uk"
    ?"Конкретний товар і достатній поточний залишок підтверджені джерелом."
    :"The concrete product and sufficient current stock are confirmed by the source.";
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
      <span>{lang==="uk"?"РІШЕННЯ ATLAS":"ATLAS SOLUTION"}</span>
      {stillSearching&&<small><RefreshCw className="spin" size={13}/>{lang==="uk"?"Atlas ще перевіряє альтернативи":"Atlas is still checking alternatives"}</small>}
    </div>
    <div className="immediateSolutionBody">
      <div>
        <strong>{candidate.source}</strong>
        <h2>{candidate.title}</h2>
        {candidate.description&&<p>{candidate.description}</p>}
        <p className="recommendationReason">{recommendationReason(candidate,lang)}</p>
        {candidate.verificationText&&<small className="chainVerification">{candidate.verificationText}</small>}
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
              {alternative.verificationText&&<small className="chainVerification">{alternative.verificationText}</small>}
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
  const [searchParams,setSearchParams]=useSearchParams();
  const initialTask=clean(searchParams.get("q")||state?.task);
  const routeWhere=clean(searchParams.get("where")||state?.where);
  const [passportCity,setPassportCity]=useState(()=>savedAtlasCity());
  const initialWhere=routeWhere||passportCity;
  const [locationDraft,setLocationDraft]=useState(initialWhere);
  const routeSignature=`${initialTask}
${initialWhere}`;
  const previousRouteRef=useRef(routeSignature);
  const [task,setTask]=useState(initialTask);
  const [activeTask,setActiveTask]=useState(initialTask);
  const [searchRunId,setSearchRunId]=useState(0);
  const [plan,setPlan]=useState(()=>createPassportSeedPlan(initialTask,{lang}));
  const [brainLoading,setBrainLoading]=useState(false);
  const [brainReady,setBrainReady]=useState(false);
  const brainRunRef=useRef("");
  const [brainError,setBrainError]=useState("");
  const [passportGroups,setPassportGroups]=useState([]);
  const [passportLoading,setPassportLoading]=useState(false);
  const [passportCheckedGoal,setPassportCheckedGoal]=useState("");
  const [needMatches,setNeedMatches]=useState([]);
  const [needsLoading,setNeedsLoading]=useState(false);
  const [needsCheckedGoal,setNeedsCheckedGoal]=useState("");
  const [externalRequested,setExternalRequested]=useState(false);
  const [searchScope,setSearchScope]=useState("");
  const [nearbyGroups,setNearbyGroups]=useState([]);
  const [nearbyLoading,setNearbyLoading]=useState(false);
  const [nearbyError,setNearbyError]=useState("");
  const [internetGroups,setInternetGroups]=useState([]);
  const [internetLoading,setInternetLoading]=useState(false);
  const [recoveryCandidates,setRecoveryCandidates]=useState([]);
  const [recoveryLoading,setRecoveryLoading]=useState(false);
  const recoveryRunRef=useRef("");
  const [internetError,setInternetError]=useState("");
  const [typedOrigin,setTypedOrigin]=useState(null);
  const [originLoading,setOriginLoading]=useState(false);
  const [originError,setOriginError]=useState("");
  const [sortMode,setSortMode]=useState("recommended");
  const effectiveClarification=plan?.clarification?.required
    ?plan.clarification
    :(externalRequested&&brainReady?genericMoneyClarification(activeTask,lang):null);
  const geo=useGeolocation(state?.geoLocation||null);
  const origin=geo.location||typedOrigin;

  useEffect(()=>{
    let alive=true;
    if(routeWhere||passportCity)return()=>{alive=false};
    loadMyPassport().then(data=>{
      const city=clean(data?.passport?.city);
      if(!alive||!city)return;
      try{localStorage.setItem("atlas-city",city)}catch{}
      setPassportCity(city);
      setLocationDraft(city);
    }).catch(()=>{});
    return()=>{alive=false};
  },[routeWhere,passportCity]);

  useEffect(()=>{
    setLocationDraft(initialWhere);
  },[initialWhere]);

  useEffect(()=>{
    if(previousRouteRef.current===routeSignature)return;
    previousRouteRef.current=routeSignature;
    setTask(initialTask);
    setActiveTask(initialTask);
    setTypedOrigin(null);
    setSortMode("recommended");
    setNeedMatches([]);
    setNeedsCheckedGoal("");
    setExternalRequested(false);
    setPlan(createPassportSeedPlan(initialTask,{lang}));
    setBrainReady(false);
    brainRunRef.current="";
    setBrainLoading(false);
    setSearchScope("");
    setNearbyGroups([]);
    setInternetGroups([]);
    setRecoveryCandidates([]);
    setRecoveryLoading(false);
    recoveryRunRef.current="";
    setSearchRunId(value=>value+1);
  },[routeSignature,initialTask]);

  const passportPlan=useMemo(()=>createPassportSeedPlan(activeTask,{lang}),[activeTask,lang]);
  const passportSteps=useMemo(()=>normalizeSteps(passportPlan,activeTask,lang),[passportPlan,activeTask,lang]);
  const passportStepsKey=useMemo(()=>JSON.stringify(passportSteps),[passportSteps]);

  const steps=useMemo(()=>normalizeSteps(plan,activeTask,lang),[plan,activeTask,lang]);
  const stepsKey=useMemo(()=>JSON.stringify(steps),[steps]);
  const plannedDirectCandidate=useMemo(()=>directCandidate(plan?.direct_action,initialWhere,lang),[plan?.direct_action,initialWhere,lang]);
  const plannedAnswerCandidate=useMemo(()=>aiAnswerCandidate(plan,lang),[plan,lang]);
  const passportRunKey=`${searchRunId}:${activeTask}`;

  useEffect(()=>{
    let alive=true;
    if(!activeTask||!passportSteps.length){
      setPassportGroups([]);
      setPassportCheckedGoal("");
      setPassportLoading(false);
      return()=>{alive=false};
    }
    setPassportLoading(true);
    setPassportCheckedGoal("");
    setPassportGroups([]);
    Promise.all(passportSteps.map(async step=>{
      const stepPlan={
        goal:step.purpose||activeTask,
        passport_search:{
          terms:step.passport_terms.length?step.passport_terms:passportPlan?.passport_search?.terms||[],
          capability_description:step.purpose
        }
      };
      const {matches,historicalMatches}=await searchPassportProfiles(stepPlan,{limit:2});
      return {stepId:step.id,matches:matches||[],historicalMatches:historicalMatches||[]};
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
      .catch(()=>{if(alive)setPassportGroups(passportSteps.map(step=>({stepId:step.id,matches:[]})))})
      .finally(()=>{
        if(alive){
          setPassportLoading(false);
          setPassportCheckedGoal(passportRunKey);
        }
      });
    return()=>{alive=false};
  },[activeTask,passportStepsKey,passportRunKey]);

  const passportsChecked=Boolean(activeTask&&!passportLoading&&passportCheckedGoal===passportRunKey);

  useEffect(()=>{
    let alive=true;
    if(!activeTask){
      setNeedMatches([]);
      setNeedsCheckedGoal("");
      setNeedsLoading(false);
      return()=>{alive=false};
    }
    setNeedsLoading(true);
    setNeedsCheckedGoal("");
    setNeedMatches([]);
    searchAtlasNeeds(searchCore(activeTask),{limit:12})
      .then(result=>{
        if(!alive)return;
        setNeedMatches(result.matches||[]);
        trackAtlas("Atlas Needs Search Completed",{matches:(result.matches||[]).length,language:lang});
      })
      .catch(()=>{if(alive)setNeedMatches([])})
      .finally(()=>{if(alive){setNeedsLoading(false);setNeedsCheckedGoal(passportRunKey)}});
    return()=>{alive=false};
  },[activeTask,passportRunKey,lang]);

  const needsChecked=Boolean(activeTask&&!needsLoading&&needsCheckedGoal===passportRunKey);
  const internalChecked=passportsChecked&&needsChecked;
  const exactPassportFound=useMemo(()=>passportGroups.some(group=>(group.matches||[]).some(match=>{
    return passportMatchesTask(passportCandidate(match,lang,activeTask),activeTask);
  })),[passportGroups,lang,activeTask]);
  const internalPassportCandidates=useMemo(()=>{
    const all=passportGroups.flatMap(group=>(group.matches||[]).map(match=>passportCandidate(match,lang,activeTask)));
    return all
      .filter(candidate=>passportMatchesTask(candidate,activeTask))
      .filter((candidate,index,array)=>array.findIndex(item=>candidateIdentity(item)===candidateIdentity(candidate))===index)
      .slice(0,8);
  },[passportGroups,lang,activeTask]);

  useEffect(()=>{
    const controller=new AbortController();
    if(!activeTask||!internalChecked||!externalRequested)return()=>controller.abort();
    const runKey=`${searchRunId}:${activeTask}:${initialWhere}`;
    if(brainRunRef.current===runKey)return()=>controller.abort();
    brainRunRef.current=runKey;

    setBrainLoading(true);
    setBrainReady(false);
    setBrainError("");
    setSearchScope("");
    setNearbyGroups([]);
    setInternetGroups([]);

    analyzeAtlasQuery(searchCore(activeTask),{
      lang,
      location:origin||null,
      locationText:initialWhere,
      signal:controller.signal
    })
      .then(nextPlan=>{
        if(controller.signal.aborted)return;
        setPlan({...nextPlan,location_text:initialWhere,original_query:activeTask});
        setBrainReady(true);
        trackAtlas("Atlas Brain Search Planned After Passport Miss",{
          domain:nextPlan?.domain||"",
          solution_scope:nextPlan?.solution_scope||"",
          language:lang
        });
      })
      .catch(error=>{
        if(controller.signal.aborted)return;
        const fallback=createFallbackPlan(searchCore(activeTask),{lang});
        setPlan({...fallback,location_text:initialWhere,original_query:activeTask});
        setBrainReady(true);
        setBrainError(error?.message||"atlas-brain-unavailable");
      })
      .finally(()=>{if(!controller.signal.aborted)setBrainLoading(false)});

    return()=>controller.abort();
  },[activeTask,internalChecked,externalRequested,searchRunId,lang,initialWhere,origin?.latitude,origin?.longitude]);

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
    if(!internalChecked||!externalRequested||searchScope)return;
    if(!brainReady||brainLoading||Boolean(effectiveClarification))return;
    if(plan?.solution_scope==="information"&&plannedAnswerCandidate){
      setSearchScope("direct");
      return;
    }
    const nextScope=automaticSearchScope(plan,steps);
    setSearchScope(nextScope);
    setNearbyError("");
    setInternetError("");
    trackAtlas("Atlas External Channel Selected After Passport Miss",{
      scope:nextScope,
      domain:plan?.domain||"",
      sources:(plan?.external_searches||[]).map(item=>item?.source).filter(Boolean).join(","),
      language:lang,
      location_provided:Boolean(initialWhere||origin)
    });
    if((nextScope==="nearby"||nextScope==="both")&&initialWhere&&!origin&&!originLoading)ensureOrigin();
  },[internalChecked,externalRequested,brainReady,brainLoading,plan,plannedAnswerCandidate,stepsKey,searchScope,initialWhere,origin?.latitude,origin?.longitude]);

  useEffect(()=>{
    const controller=new AbortController();
    if(!externalRequested||!internalChecked||!brainReady||!(searchScope==="nearby"||searchScope==="both")){
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
        const places=await searchNearbyPlaces(origin,step.nearby_query,{lang,limit:12,signal:controller.signal});
        const commerceStep=sourceForInternetStep(step,[],0)==="marketplace";
        const candidates=await Promise.all(places.slice(0,12).map(async(place,index)=>{
          const route=index<3?await getDrivingRoute(origin,place,{lang,signal:controller.signal}).catch(()=>null):null;
          return placeCandidate(place,route,lang,{
            resolved:true,
            verificationText:commerceStep
              ?(lang==="uk"?"Магазин поруч знайдено. Наявність потрібної кількості товару варто підтвердити перед поїздкою.":"Nearby store found. Confirm the required quantity is in stock before travelling.")
              :""
          });
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
  },[externalRequested,internalChecked,brainReady,searchScope,origin?.latitude,origin?.longitude,stepsKey,lang,searchRunId]);

  useEffect(()=>{
    const controller=new AbortController();
    if(!externalRequested||!internalChecked||!brainReady||!(searchScope==="internet"||searchScope==="both")){
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
        const plannedSource=sourceForInternetStep(step,plannedSources,index);
        const source=plan?.solution_scope==="information"&&plannedSource==="marketplace"?"web":plannedSource;
        const internetQuery=["services","lodging"].includes(plan?.domain)&&initialWhere
          ?clean(`${step.internet_query} ${initialWhere}`)
          :step.internet_query;
        const results=await searchExternalSources({
          original_query:activeTask,
          goal:activeTask,
          domain:plan?.domain||"",
          solution_scope:plan?.solution_scope||"",
          location_text:initialWhere,
          external_searches:[{source,mode:"standard",query:internetQuery,reason:step.purpose}]
        },{lang,signal:controller.signal});
        return {stepId:step.id,candidates:results.slice(0,10).map((item,resultIndex)=>internetCandidate(item,resultIndex,lang)),error:false};
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
  },[externalRequested,internalChecked,brainReady,searchScope,stepsKey,activeTask,lang,plan,searchRunId]);

  useEffect(()=>{
    if(!activeTask||!externalRequested||!internalChecked||!brainReady)return;
    if(!searchScope)return;

    const primaryCandidates=[
      plannedAnswerCandidate,
      plannedDirectCandidate,
      ...nearbyGroups.flatMap(group=>group.candidates||[]),
      ...internetGroups.flatMap(group=>group.candidates||[])
    ].filter(Boolean);
    if(primaryCandidates.some(candidate=>candidate.resolved))return;

    const runKey=`${searchRunId}:${activeTask}:${initialWhere}`;
    if(recoveryRunRef.current===runKey)return;
    recoveryRunRef.current=runKey;

    const coreQuery=searchCore(activeTask);
    const placeQuery=clean([coreQuery,initialWhere].filter(Boolean).join(" "));
    const prepared=[
      {
        kind:"external",
        id:"fallback-google-maps",
        source:"Google Maps",
        title:lang==="uk"?"Показати на карті":"Show on map",
        description:placeQuery,
        url:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeQuery)}`,
        resultKind:"maps_search",
        resolved:false
      },
      {
        kind:"external",
        id:"fallback-google-web",
        source:"Google",
        title:lang==="uk"?"Пошук в інтернеті":"Search the web",
        description:placeQuery,
        url:`https://www.google.com/search?q=${encodeURIComponent(placeQuery)}`,
        resultKind:"search_page",
        resolved:false
      }
    ];
    setRecoveryCandidates(prepared);
    setRecoveryLoading(true);

    const controller=new AbortController();

    const withTimeout=async(promiseFactory,ms)=>{
      let timer;
      try{
        return await Promise.race([
          promiseFactory(),
          new Promise(resolve=>{timer=setTimeout(()=>resolve([]),ms)})
        ]);
      }finally{clearTimeout(timer)}
    };

    const localPromise=withTimeout(async()=>{
      try{
        const response=await fetch("/api/local-search",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            query:coreQuery,
            location_text:initialWhere,
            origin:origin?{latitude:origin.latitude,longitude:origin.longitude}:null,
            language:lang,
            radius_km:30,
            limit:12
          }),
          signal:controller.signal
        });
        const data=await response.json().catch(()=>({}));
        if(!response.ok||!Array.isArray(data?.results))return [];
        return data.results.slice(0,12).map(place=>placeCandidate(place,null,lang,{resolved:true}));
      }catch(error){
        if(error?.name==="AbortError")return [];
        return [];
      }
    },6500);

    const webPromise=withTimeout(async()=>{
      try{
        const results=await searchExternalSources({
          original_query:activeTask,
          goal:coreQuery,
          domain:"general",
          solution_scope:"information",
          location_text:initialWhere,
          external_searches:[{source:"web",mode:"standard",query:placeQuery||coreQuery,reason:"fallback"}]
        },{lang,signal:controller.signal});
        return results.slice(0,10).map((item,index)=>internetCandidate(item,index,lang));
      }catch(error){
        if(error?.name==="AbortError")return [];
        return [];
      }
    },6500);

    Promise.all([localPromise,webPromise])
      .then(([localResults,webResults])=>{
        if(controller.signal.aborted)return;
        const concrete=[...localResults,...webResults].filter(Boolean);
        setRecoveryCandidates(concrete.length?[...concrete,...prepared]:prepared);
        if(localResults.length)trackAtlas("Atlas Recovery Local Search Completed",{results:localResults.length,language:lang});
        if(webResults.length)trackAtlas("Atlas Recovery Web Search Completed",{results:webResults.length,language:lang});
      })
      .finally(()=>{if(!controller.signal.aborted)setRecoveryLoading(false)});

    return()=>controller.abort();
  },[
    activeTask,externalRequested,internalChecked,brainReady,searchScope,
    plannedAnswerCandidate,plannedDirectCandidate,nearbyGroups,internetGroups,
    searchRunId,initialWhere,origin?.latitude,origin?.longitude,lang
  ]);

  const passportByStep=useMemo(()=>new Map(passportGroups.map(group=>[
    group.stepId,
    exactPassportFound&&group.matches[0]?passportCandidate(group.matches[0],lang,activeTask):null
  ])),[passportGroups,lang,activeTask,exactPassportFound]);
  const nearbyByStep=useMemo(()=>new Map(nearbyGroups.map(group=>[group.stepId,group.candidates||[]])),[nearbyGroups]);
  const internetByStep=useMemo(()=>new Map(internetGroups.map(group=>[group.stepId,group.candidates||[]])),[internetGroups]);
  const rankedCandidates=useMemo(()=>{
    const candidates=[
      plannedAnswerCandidate,
      plannedDirectCandidate,
      ...(exactPassportFound?passportGroups.flatMap(group=>group.matches.slice(0,2).map(match=>passportCandidate(match,lang,activeTask))):[]),
      ...(!exactPassportFound?passportGroups.flatMap(group=>(group.historicalMatches||[]).slice(0,2).map(match=>historicalPassportCandidate(match,lang))):[]),
      ...nearbyGroups.flatMap(group=>group.candidates||[]),
      ...internetGroups.flatMap(group=>group.candidates||[]),
      ...recoveryCandidates
    ];
    return candidates
      .filter(Boolean)
      .filter((candidate,index,array)=>array.findIndex(item=>candidateIdentity(item)===candidateIdentity(candidate))===index)
      .sort((a,b)=>candidatePriority(b,activeTask)-candidatePriority(a,activeTask));
  },[plannedAnswerCandidate,plannedDirectCandidate,passportGroups,nearbyGroups,internetGroups,recoveryCandidates,lang,activeTask,exactPassportFound]);
  const sortedCandidates=useMemo(()=>{
    if(sortMode==="recommended")return rankedCandidates;
    const direction=sortMode==="price-desc"?-1:1;
    return [...rankedCandidates].sort((a,b)=>{
      const priceA=structuredPrice(a);
      const priceB=structuredPrice(b);
      if(priceA&&priceB&&priceA.unit===priceB.unit&&priceA.currency===priceB.currency)return (priceA.value-priceB.value)*direction;
      if(priceA&&!priceB)return -1;
      if(!priceA&&priceB)return 1;
      return candidatePriority(b,activeTask)-candidatePriority(a,activeTask);
    });
  },[rankedCandidates,sortMode,activeTask]);
  const resolvedCandidates=sortedCandidates.filter(candidate=>candidate.resolved);
  const actionableCandidates=resolvedCandidates.filter(candidate=>{
    if(candidate?.kind==="passport_history")return false;
    if(candidate?.kind==="external"&&["maps_search","store_option_pending"].includes(candidate.resultKind))return false;
    return true;
  });
  const externalActionableCandidates=actionableCandidates.filter(candidate=>candidate?.kind!=="passport"&&candidate?.kind!=="passport_history");
  const informationMode=plan?.solution_scope==="information";
  const informationCandidates=externalActionableCandidates.filter(candidate=>candidate?.kind==="answer"||(candidate?.kind==="external"&&["official_result","web_answer","web_result"].includes(candidate.resultKind)));
  const resultPool=informationMode&&informationCandidates.length?informationCandidates:externalActionableCandidates;
  const recommendedCandidate=externalRequested?(resultPool[0]||null):null;
  const recommendedAlternatives=externalRequested?resultPool.slice(1,10):[];
  const structuredPriceCount=rankedCandidates.filter(candidate=>structuredPrice(candidate)).length;

  const chains=useMemo(()=>{
    if(!["nearby","internet","both"].includes(searchScope))return [];
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
      title:lang==="uk"?"Місцеві варіанти":"Local options",
      description:lang==="uk"?"Паспорт можливостей перевірено. Тепер Atlas показує конкретні місцеві варіанти.":"Opportunity Passports were checked. Atlas now shows concrete local options."
    }];
    if(searchScope==="internet")return [{
      ...build("internet"),
      title:lang==="uk"?"Результати з інтернету":"Internet results",
      description:lang==="uk"?"Паспорт можливостей перевірено. Королева вибрала зовнішній пошук, відповідний типу задачі.":"Opportunity Passports were checked. Queen selected the external search channel appropriate to the task."
    }];
    return [{
      ...build("nearby"),
      title:lang==="uk"?"Поруч":"Nearby",
      description:lang==="uk"?"Конкретні місцеві варіанти після перевірки Паспортів.":"Concrete local options after Passport search."
    },{
      ...build("internet",{preferExternal:true}),
      title:lang==="uk"?"Інтернет":"Internet",
      description:lang==="uk"?"Конкретні пропозиції показуються окремо від варіантів, що ще потребують підтвердження.":"Concrete offers are separated from options that still require confirmation."
    }];
  },[searchScope,steps,passportByStep,nearbyByStep,internetByStep,lang]);

  function launchSearch(value,where=initialWhere,source="solution"){
    const cleanTask=clean(value);
    const cleanWhere=clean(where);
    if(!cleanTask)return;
    trackAtlas("Atlas Search Submitted",{
      language:lang,
      location_provided:Boolean(cleanWhere||origin),
      source
    });
    trackAtlasActivity("search",{
      label:cleanTask,
      path:"/solution",
      meta:{has_location:Boolean(cleanWhere||origin),source}
    });
    saveSearchHistory({task:cleanTask,where:cleanWhere});
    setTask(cleanTask);
    setPassportCheckedGoal("");
    setPassportGroups([]);
    setNeedMatches([]);
    setNeedsCheckedGoal("");
    setExternalRequested(false);
    setPlan(createPassportSeedPlan(cleanTask,{lang}));
    setBrainLoading(false);
    setBrainReady(false);
    brainRunRef.current="";
    setSearchScope("");
    setNearbyGroups([]);
    setInternetGroups([]);
    setRecoveryCandidates([]);
    setRecoveryLoading(false);
    recoveryRunRef.current="";
    setSortMode("recommended");
    const next=new URLSearchParams();
    next.set("q",cleanTask);
    if(cleanWhere)next.set("where",cleanWhere);
    if(cleanTask===initialTask&&cleanWhere===initialWhere){
      setActiveTask(cleanTask);
      setSearchRunId(run=>run+1);
    }else{
      setSearchParams(next);
    }
  }

  function submit(event){
    event.preventDefault();
    launchSearch(task);
  }

  function applyLocationText(){
    const value=clean(locationDraft);
    if(!value)return;
    try{localStorage.setItem("atlas-city",value)}catch{}
    setPassportCity(value);
    const next=new URLSearchParams(searchParams);
    next.set("q",activeTask||task);
    next.set("where",value);
    setSearchParams(next);
  }

  function refine(option){
    const base=plan?.domain==="health"?clean(plan?.goal):activeTask.replace(/[,.]+$/g,"");
    const value=`${base}, ${option}`;
    trackAtlas("Atlas Search Refined",{language:lang});
    launchSearch(value,initialWhere,"clarification");
  }

  function startExternalSearch(){
    if(!internalChecked||externalRequested)return;
    setExternalRequested(true);
    setBrainReady(false);
    setBrainError("");
    brainRunRef.current="";
    setSearchScope("");
    setNearbyGroups([]);
    setInternetGroups([]);
    setRecoveryCandidates([]);
    recoveryRunRef.current="";
    trackAtlas("Atlas Open Sources Search Requested",{language:lang,query:activeTask});
  }

  function chooseSearchScope(scope){
    setSearchScope(scope);
    setNearbyError("");
    setInternetError("");
    trackAtlas("Atlas Search Scope Selected",{scope,language:lang});
    if((scope==="nearby"||scope==="both")&&initialWhere&&!origin&&!originLoading)ensureOrigin();
  }

  const externalBusy=nearbyLoading||internetLoading||originLoading||recoveryLoading;
  const internalBusy=passportLoading||needsLoading||Boolean(activeTask&&!internalChecked);
  const solutionBusy=internalBusy||Boolean(externalRequested&&internalChecked&&!brainReady);
  const locationText=origin?(initialWhere||(lang==="uk"?"поточна локація":"current location")):(initialWhere||(lang==="uk"?"не визначена":"not set"));
  const scopeChoiceAvailable=false;
  const informationSearchAvailable=false;
  const healthTask=plan?.domain==="health";

  return <main className="simpleSolutionPage">
    <section className="simpleSolutionShell">
      <Link className="simpleBack" to="/"><ArrowLeft size={17}/>{lang==="uk"?"Новий пошук":"New search"}</Link>

      <form className="simpleQueryForm" onSubmit={submit}>
        <VoiceTaskInput multiline={false} value={task} onChange={setTask} lang={lang} placeholder={lang==="uk"?"Що вам потрібно?":"What do you need?"}/>
        <button type="submit" aria-label={lang==="uk"?"Знайти":"Search"}><Search size={25}/></button>
      </form>

      <details className="solutionHistory">
        <summary>{lang==="uk"?"Попередні запити":"Previous searches"}</summary>
        <SearchHistoryList lang={lang} compact limit={5} onSelect={item=>launchSearch(item.task,item.where,"history")}/>
      </details>

      <div className="simpleLocationRow">
        <MapPin size={17}/><span>{lang==="uk"?"Локація:":"Location:"}</span><strong>{locationText}</strong>
        {!initialWhere&&<div className="simpleLocationEntry"><input value={locationDraft} onChange={event=>setLocationDraft(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();applyLocationText()}}} placeholder={lang==="uk"?"Місто або район":"City or area"}/><button type="button" onClick={applyLocationText} disabled={!locationDraft.trim()}>{lang==="uk"?"Шукати тут":"Search here"}</button></div>}
        {!origin&&<button className="simpleLocationAction" type="button" onClick={()=>geo.requestLocation()} disabled={geo.loading}>{geo.loading?(lang==="uk"?"Визначаю…":"Locating…"):(lang==="uk"?"Моя геолокація":"My location")}</button>}
      </div>

      <div className="simpleResultsHeader">
        <div>
          <span className="solutionKicker">ATLAS</span>
          <h1>{!internalChecked
            ?(lang==="uk"?"Шукаю в Atlas…":"Searching Atlas…")
            :Boolean(effectiveClarification)
              ?(lang==="uk"?"Потрібне уточнення":"One quick question")
              :externalRequested&&brainLoading
                ?(lang==="uk"?"Luna аналізує запит…":"Luna is analysing the request…")
                :externalRequested
                  ?(recommendedCandidate?(lang==="uk"?"Відкриті джерела":"Open sources"):(lang==="uk"?"Шукаю у відкритих джерелах…":"Searching open sources…"))
                  :(lang==="uk"?"Знайдено в Atlas":"Found in Atlas")}
          </h1>
        </div>
        {plan?.safety?.level&&plan.safety.level!=="none"&&plan.safety.message&&<div className={`simpleSafety ${plan.safety.level}`}>{plan.safety.message}</div>}
      </div>

      {!Boolean(effectiveClarification)&&plan?.solution_scope==="transaction"&&rankedCandidates.length>1&&<div className="solutionSortBar">
        <label>{lang==="uk"?"Сортування":"Sort"}<select value={sortMode} onChange={event=>setSortMode(event.target.value)}>
          <option value="recommended">{lang==="uk"?"Найкраще рішення Atlas":"Best Atlas solution"}</option>
          <option value="price-asc">{lang==="uk"?"Від найдешевшого":"Lowest price first"}</option>
          <option value="price-desc">{lang==="uk"?"Від найдорожчого":"Highest price first"}</option>
        </select></label>
        {structuredPriceCount<2&&<small>{lang==="uk"?"Цінове сортування з’явиться повністю, коли можливості матимуть ціну за однакову одиницю.":"Price sorting becomes useful when opportunities include comparable unit prices."}</small>}
      </div>}

      {Boolean(effectiveClarification)&&<div className="simpleClarifier">
        <strong>{effectiveClarification.question}</strong>
        {effectiveClarification.helper_text&&<span>{effectiveClarification.helper_text}</span>}
        {Array.isArray(effectiveClarification.options)&&effectiveClarification.options.length>0&&<div className="simpleClarifierChips">{effectiveClarification.options.map(option=><button key={option} type="button" onClick={()=>refine(option)}>{option}</button>)}</div>}
      </div>}

      {!Boolean(effectiveClarification)&&activeTask&&internalChecked&&<section className="atlasInternalResults">
        <div className="atlasInternalHead">
          <span>{lang==="uk"?"СПОЧАТКУ ATLAS":"ATLAS FIRST"}</span>
          <h2>{lang==="uk"?"Результати всередині Atlas":"Results inside Atlas"}</h2>
          <p>{lang==="uk"?"Окремо перевірено Паспорти можливостей і Паспорти потреб.":"Opportunity Passports and Needs Passports were checked separately."}</p>
        </div>
        <div className="atlasInternalGrid">
          <div className="atlasInternalColumn">
            <div className="atlasInternalColumnTitle"><UserRound size={18}/><strong>{lang==="uk"?"Паспорти можливостей":"Opportunity Passports"}</strong><b>{internalPassportCandidates.length}</b></div>
            {internalPassportCandidates.length===0?<div className="atlasInternalEmpty">{lang==="uk"?"Точного збігу серед можливостей немає.":"No exact opportunity match found."}</div>:internalPassportCandidates.map(candidate=><article className="atlasInternalCard" key={candidateIdentity(candidate)}>
              <div><span>{candidate.source}</span><h3>{candidate.title}</h3>{candidate.description&&<p>{candidate.description}</p>}{candidate.city&&<small><MapPin size={13}/>{candidate.city}</small>}</div>
              <CandidateAction candidate={candidate} origin={origin} lang={lang}/>
            </article>)}
          </div>
          <div className="atlasInternalColumn">
            <div className="atlasInternalColumnTitle"><HeartHandshake size={18}/><strong>{lang==="uk"?"Паспорти потреб":"Needs Passports"}</strong><b>{needMatches.length}</b></div>
            {needMatches.length===0?<div className="atlasInternalEmpty">{lang==="uk"?"Схожих актуальних потреб немає.":"No similar active needs found."}</div>:needMatches.slice(0,8).map(item=><article className="atlasInternalCard needCard" key={item.need_id}>
              <div><span>{lang==="uk"?"ПОТРЕБА":"NEED"}</span><h3>{needResultTitle(item,lang)}</h3><p>{[item.display_name,item.city].filter(Boolean).join(" · ")}</p>{item.needed_until&&<small><Clock3 size={13}/>{lang==="uk"?"Актуально до":"Valid until"} {item.needed_until}</small>}</div>
              {item.passport_slug&&<Link className="chainAction secondaryAction" to={`/p/${item.passport_slug}`}><UserRound size={16}/>{lang==="uk"?"Паспорт":"Passport"}</Link>}
            </article>)}
          </div>
        </div>
      </section>}

      {!Boolean(effectiveClarification)&&activeTask&&internalChecked&&<section className="openSourcesGate">
        <div><span>{lang==="uk"?"ДРУГИЙ КРОК":"SECOND STEP"}</span><h2>{lang==="uk"?"Пошук у відкритих джерелах":"Search open sources"}</h2><p>{lang==="uk"?"Atlas уже перевірив свою базу. Магазини, карти, маркетплейси та відкритий інтернет запускаються окремо — тільки за вашою командою.":"Atlas has already checked its own database. Stores, maps, marketplaces and the open web run separately, only when you ask."}</p></div>
        <button type="button" onClick={startExternalSearch} disabled={externalRequested||solutionBusy}>
          <Globe2 size={19}/>{externalRequested?(brainLoading?(lang==="uk"?"Luna аналізує…":"Luna analysing…"):(externalBusy||!brainReady?(lang==="uk"?"Шукаю…":"Searching…"):(lang==="uk"?"Пошук запущено":"Search started"))):(lang==="uk"?"Шукати у відкритих джерелах":"Search open sources")}
        </button>
      </section>}

      {!Boolean(effectiveClarification)&&activeTask&&scopeChoiceAvailable&&<section className="searchScopePicker">
        <div className="scopeHeading">
          <span>{lang==="uk"?"ВАШ ВИБІР":"YOUR CHOICE"}</span>
          <h2>{lang==="uk"?"Де шукати?":"Where should Atlas search?"}</h2>
          <p>{lang==="uk"?"Оберіть джерела — результат перебудується одразу.":"Choose the sources — the result updates immediately."}</p>
        </div>
        <div className="scopeButtons" role="group" aria-label={lang==="uk"?"Де шукати":"Where to search"}>
          <button className={searchScope==="nearby"?"active":""} type="button" onClick={()=>chooseSearchScope("nearby")} disabled={!passportsChecked} aria-pressed={searchScope==="nearby"}>
            <MapPin size={21}/><span><strong>{lang==="uk"?"Поруч":"Nearby"}</strong><small>{lang==="uk"?"Місця та маршрут":"Places and route"}</small></span>
          </button>
          <button className={searchScope==="internet"?"active":""} type="button" onClick={()=>chooseSearchScope("internet")} disabled={!passportsChecked} aria-pressed={searchScope==="internet"}>
            <Globe2 size={21}/><span><strong>{lang==="uk"?"В інтернеті":"Online"}</strong><small>{lang==="uk"?"OVI + конкретні пропозиції":"OVI + concrete offers"}</small></span>
          </button>
          <button className={searchScope==="both"?"active":""} type="button" onClick={()=>chooseSearchScope("both")} disabled={!passportsChecked} aria-pressed={searchScope==="both"}>
            <Search size={21}/><span><strong>{lang==="uk"?"Поруч + інтернет":"Nearby + online"}</strong><small>{lang==="uk"?"Порівняти всі варіанти":"Compare all options"}</small></span>
          </button>
        </div>
      </section>}

      {!Boolean(effectiveClarification)&&externalRequested&&recommendedCandidate&&<ImmediateSolution
        candidate={recommendedCandidate}
        alternatives={recommendedAlternatives}
        origin={origin}
        lang={lang}
        stillSearching={solutionBusy}
      />}

      {!Boolean(effectiveClarification)&&informationSearchAvailable&&recommendedCandidate&&<div className="searchScopePicker"><div className="scopeHeading"><span>{lang==="uk"?"ДОДАТКОВО":"OPTIONAL"}</span><h2>{lang==="uk"?"Потрібно пошукати ще?":"Search for more?"}</h2><p>{lang==="uk"?"Основну відповідь Atlas уже дав. Додатковий пошук запускається лише за вашим бажанням.":"Atlas already gave the main answer. Additional search runs only if you choose it."}</p></div><div className="scopeButtons" role="group"><button type="button" onClick={()=>chooseSearchScope("nearby")}><MapPin size={21}/><span><strong>{lang==="uk"?"Пошукати поруч":"Search nearby"}</strong><small>{lang==="uk"?"Місця та маршрут":"Places and route"}</small></span></button><button type="button" onClick={()=>chooseSearchScope("internet")}><Globe2 size={21}/><span><strong>{lang==="uk"?"Пошукати ще в інтернеті":"Search more online"}</strong><small>{lang==="uk"?"Додаткові джерела за бажанням":"Optional additional sources"}</small></span></button></div></div>}

      {!Boolean(effectiveClarification)&&solutionBusy&&<div className="solutionSearchState">
        <RefreshCw className="spin" size={20}/>
        <div><strong>{lang==="uk"?"Шукаю найкращі варіанти…":"Finding the best options…"}</strong></div>
      </div>}

      {(searchScope==="nearby"||searchScope==="both")&&!origin&&!originLoading&&<div className="simpleGeoPrompt">
        <div><strong>{healthTask?(lang==="uk"?"Знайти конкретну медичну допомогу й маршрут":"Find concrete medical care and a route"):(lang==="uk"?"Додати варіанти поруч і маршрут":"Add nearby options and a route")}</strong><span>{lang==="uk"?"Координати потрібні лише для пошуку поруч і не зберігаються.":"Coordinates are used only for nearby search and are not stored."}</span></div>
        <button className="primary" type="button" onClick={ensureOrigin}><MapPin size={18}/>{healthTask?(lang==="uk"?"Знайти допомогу поруч":"Find nearby care"):(lang==="uk"?"Додати мою локацію":"Add my location")}</button>
      </div>}

      {originError&&<div className="simpleEmpty">{lang==="uk"?"Не вдалося визначити цю локацію. Вкажіть місто на головній сторінці або дозвольте геолокацію.":"Could not resolve this location. Enter a city on the home page or allow geolocation."}</div>}

      {!Boolean(effectiveClarification)&&externalRequested&&!brainLoading&&!recommendedCandidate&&!solutionBusy&&recoveryRunRef.current&&<div className="simpleEmpty">
        {lang==="uk"?"Нічого конкретного не знайдено. Спробуйте уточнити запит або місто.":"No concrete result was found. Try refining the request or location."}
      </div>}


    </section>
  </main>;
}
