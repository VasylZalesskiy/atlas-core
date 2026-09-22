import {extractRequestedKilograms,marketplaceSearchTerm} from "../../api/_search-utils.js";

function clean(value){return String(value||"").replace(/\s+/g," ").trim()}

function cleanTerms(query){return [...new Set(clean(query).toLowerCase().replace(/[.,!?;:()]/g," ").split(/\s+/).filter(word=>word.length>2))].slice(0,12)}

function isServiceNeed(value){
  return /шиномонтаж|ремонт|майстер|перукар|стомат|сервіс|послуг|монтаж|установ|налашту|мийк|евакуатор|нотаріус|адвокат|бухгалтер|service|repair|installer|mechanic|barber|dentist|lawyer|accountant/iu.test(String(value||""));
}

function isExplicitMarketplaceNeed(value){
  return /куп|прод|придба|замов|товар|продукт|оренд(?:а|увати)|обмін|опт|гурт|постачаль|маркетплейс|оголош|buy|sell|order|product|rent|exchange|wholesale|supplier|marketplace|listing/iu.test(String(value||""));
}

export function createPassportSeedPlan(query,{lang="uk"}={}){
  const goal=clean(query),terms=cleanTerms(goal),uk=lang==="uk";
  return {
    understood:Boolean(goal),
    goal,
    intent:"passport_search",
    domain:"passport",
    solution_scope:"local_action",
    urgency:"planned",
    needs_location:false,
    clarification:{required:false,question:"",options:[]},
    passport_search:{
      terms,
      capability_description:uk
        ?"Можливість людини або компанії, яка прямо відповідає запиту"
        :"A person or company capability that directly matches the request"
    },
    solution_steps:goal?[{
      id:"passport-first",
      title:uk?"Пошук у Паспорті можливостей":"Search Opportunity Passports",
      purpose:goal,
      passport_terms:terms,
      nearby_query:"",
      internet_query:"",
      nearby_relevant:false,
      internet_relevant:false
    }]:[],
    external_searches:[],
    safety:{level:"none",message:""},
    result_strategy:uk
      ?"Спочатку тільки точний збіг у Паспорті можливостей."
      :"First, only an exact Opportunity Passport match.",
    fallback:true
  };
}


function isProductNeed(value){
  const text=String(value||"");
  return extractRequestedKilograms(text)!==null||/куп|придба|замов|товар|продукт|постач|опт|гурт|buy|order|supplier|wholesale|bulk/i.test(text);
}
function isLodgingNeed(value){return /готел|отел|хостел|мотел|апартамент|житло на ніч|переноч|ночівл|hotel|hostel|motel|lodging|accommodation|place to stay/i.test(String(value||""))}
function isAgricultureNeed(value){return /агро|сільськ|ферм|врожай|картоп|горох|бобов|круп|овоч|фрукт|зерн|пшени|кукурудз|соняш|буряк|морк|цибул|капуст|яблук|ягод|насін|food|produce|peas?/i.test(String(value||""))}
function isHealthNeed(value){return /болить|біль|живіт|голов|груд|спин|температур|нудот|блюван|запамороч|не можу дих|важко дих|непритом|кров у|каш(ель|ля)|травм|поріз|опік|тиск|серц|stomach ache|stomach pain|headache|chest pain|fever|nausea|vomit|dizz|faint|bleed|cannot breathe|can't breathe/i.test(String(value||""))}
function healthDecision(value){
  const text=String(value||"");
  if(/так\s*[,—-]?\s*є хоча б одна/i.test(text))return "emergency";
  if(/ні\s*[,—-]?\s*біль легкий і не посилюється/i.test(text))return "mild";
  if(/ні\s*[,—-]?\s*але біль сильний або посилюється/i.test(text))return "urgent";
  return "triage";
}
function healthGoal(value){return String(value||"").replace(/,\s*(?:так\s*[,—-]?\s*є хоча б одна|ні\s*[,—-]?\s*але біль сильний або посилюється|ні\s*[,—-]?\s*біль легкий і не посилюється).*$/i,"").trim()}

function createHealthPlan(query,lang){
  const decision=healthDecision(query),goal=healthGoal(query),uk=lang==="uk";
  const passportTerms=uk?["лікар","сімейний лікар","медик","фельдшер"]:["doctor","family doctor","medic","paramedic"];
  const base={understood:Boolean(goal),goal,intent:"get_help",domain:"health",solution_scope:"local_action",passport_search:{terms:passportTerms,capability_description:uk?"Перевірена медична допомога або консультація":"Verified medical help or consultation"},result_strategy:uk?"Спочатку терміновість, потім одна найбезпечніша наступна дія":"Urgency first, then one safest next action",fallback:true};
  if(decision==="triage")return {...base,urgency:"unknown",needs_location:false,clarification:{required:true,question:uk?"Чи є хоча б одна небезпечна ознака?":"Is at least one warning sign present?",helper_text:uk?"Раптовий або дуже сильний біль; живіт різко болить при дотику; кров у блюванні чи калі; непритомність; утруднене дихання або біль у грудях.":"Sudden or severe pain; marked tenderness; blood in vomit or stool; collapse; trouble breathing or chest pain.",options:uk?["Так, є хоча б одна","Ні, але біль сильний або посилюється","Ні, біль легкий і не посилюється"]:["Yes, at least one","No, but pain is severe or worsening","No, pain is mild and not worsening"]},solution_steps:[{id:"medical-triage",title:uk?"Визначити терміновість":"Determine urgency",purpose:goal,passport_terms:passportTerms,nearby_query:"",internet_query:"",nearby_relevant:false,internet_relevant:false}],external_searches:[],safety:{level:"caution",message:uk?"Atlas не ставить діагноз — спочатку потрібно визначити терміновість.":"Atlas does not diagnose — urgency must be determined first."}};
  if(decision==="emergency")return {...base,urgency:"emergency",needs_location:false,clarification:{required:false,question:"",options:[]},direct_action:{id:"call-emergency",type:"emergency",source:uk?"Екстрена медична допомога":"Emergency medical help",title:uk?"Телефонуйте 103 або 112 зараз":"Call emergency services now",description:uk?"Повідомте диспетчеру симптоми та точне місце перебування.":"Tell the dispatcher the symptoms and your exact location.",primary_href:"tel:103",primary_label:uk?"Подзвонити 103":"Call 103",secondary_href:"tel:112",secondary_label:uk?"Подзвонити 112":"Call 112",recommendation:uk?"За небезпечних ознак наступна дія — виклик екстреної допомоги, а не пошук інформації.":"With warning signs, the next action is emergency help, not an information search."},solution_steps:[{id:"call-emergency",title:uk?"Викликати екстрену допомогу":"Call emergency services",purpose:goal,passport_terms:[],nearby_query:"",internet_query:"",nearby_relevant:false,internet_relevant:false}],external_searches:[],safety:{level:"urgent",message:uk?"Не керуйте авто самі, якщо стан тяжкий.":"Do not drive yourself if the condition is severe."}};
  const urgent=decision==="urgent";
  const mapsQuery=urgent?(uk?"невідкладна медична допомога лікарня клініка":"urgent medical care hospital clinic"):(uk?"сімейний лікар амбулаторія":"family doctor medical clinic");
  return {...base,urgency:urgent?"urgent":"soon",needs_location:true,clarification:{required:false,question:"",options:[]},direct_action:{id:urgent?"medical-care-today":"contact-family-doctor",type:"find_care",source:uk?"Медична допомога":"Medical help",title:urgent?(uk?"Зверніться до лікаря сьогодні":"See a doctor today"):(uk?"Зв’яжіться із сімейним лікарем":"Contact a family doctor"),description:urgent?(uk?"Сильний або наростаючий біль потребує медичної оцінки сьогодні.":"Severe or worsening pain needs medical assessment today."):(uk?"Якщо біль не минає, повторюється або посилюється — не відкладайте консультацію.":"If the pain persists, recurs or worsens, do not delay a consultation."),maps_query:mapsQuery,primary_label:urgent?(uk?"Знайти допомогу поруч":"Find nearby care"):(uk?"Знайти сімейного лікаря":"Find a family doctor"),recommendation:urgent?(uk?"Наступна дія — медична оцінка сьогодні.":"The next action is medical assessment today."):(uk?"Наступна дія — зв’язок із сімейним лікарем.":"The next action is contacting a family doctor.")},solution_steps:[{id:urgent?"urgent-care":"family-doctor",title:urgent?(uk?"Медична оцінка сьогодні":"Medical assessment today"):(uk?"Консультація сімейного лікаря":"Family doctor consultation"),purpose:goal,passport_terms:passportTerms,nearby_query:mapsQuery,internet_query:"",nearby_relevant:true,internet_relevant:false}],external_searches:[{source:"maps",mode:"nearby",query:mapsQuery,reason:uk?"Знайти конкретну медичну допомогу та маршрут":"Find concrete medical care and a route"}],safety:{level:urgent?"urgent":"caution",message:urgent?(uk?"Якщо з’явиться небезпечна ознака — телефонуйте 103 або 112.":"If a warning sign appears, call emergency services."):(uk?"Якщо стан погіршується — перейдіть до невідкладної допомоги.":"If the condition worsens, seek urgent care.")}};
}

export function createFallbackPlan(query,{lang="uk"}={}){
  const goal=clean(query),terms=cleanTerms(goal);
  if(isHealthNeed(goal))return createHealthPlan(goal,lang);
  const uk=lang==="uk",lodging=isLodgingNeed(goal),service=!lodging&&isServiceNeed(goal),product=!lodging&&!service&&(isProductNeed(goal)||isExplicitMarketplaceNeed(goal)),agriculture=isAgricultureNeed(goal);
  const productTerm=marketplaceSearchTerm(goal)||goal;
  const nearbyQuery=lodging?(uk?"готель":"hotel"):service?goal:product?(uk?`${productTerm} магазин`:`${productTerm} store`):"";
  const internetQuery=lodging?(uk?`готель ${goal}`:`hotel ${goal}`):product?(uk?`купити ${goal}`:`buy ${goal}`):goal;
  const searches=[];
  if(lodging||service)searches.push({source:"maps",mode:"nearby",query:nearbyQuery,reason:uk?"Знайти конкретні місцеві послуги або місця":"Find concrete local services or places"});
  if(product)searches.push({source:"marketplace",mode:"standard",query:internetQuery,reason:uk?"Знайти конкретні товари або оголошення":"Find concrete products or listings"});
  if(!lodging&&!service&&!product&&goal)searches.push({source:"web",mode:"standard",query:internetQuery,reason:uk?"Знайти актуальну відповідь у відкритому інтернеті":"Find a current answer on the open web"});
  return {understood:Boolean(goal),goal,intent:lodging?"find_lodging":service?"find_service":product?"buy":"solve",domain:lodging?"lodging":service?"services":agriculture?"agriculture":product?"products":"general",solution_scope:lodging||service?"local_action":product?"transaction":"information",urgency:"planned",needs_location:lodging||service,clarification:{required:false,question:"",options:[]},passport_search:{terms,capability_description:uk?"Можливості людей або компаній, релевантні запиту":"People or company capabilities relevant to the request"},solution_steps:goal?[{id:"main-result",title:uk?"Знайти рішення":"Find a solution",purpose:goal,passport_terms:terms,nearby_query:nearbyQuery,internet_query:internetQuery,nearby_relevant:Boolean(nearbyQuery),internet_relevant:Boolean(!lodging&&!service)}]:[],external_searches:searches,safety:{level:"none",message:""},result_strategy:uk?"Після відсутності точного збігу в Паспорті вибрати один правильний зовнішній канал: послуги — локальний пошук/карти, товари — маркетплейси, інформація — веб або офіційні джерела.":"After no exact Passport match, choose one appropriate external channel: services — local/maps, products — marketplaces, information — web or official sources.",fallback:true};
}

async function requestBrainPlan(query,{lang="uk",location=null,locationText="",signal}={}){
  const response=await fetch("/api/brain",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query,language:lang,location,location_text:locationText}),signal});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(data?.error||"atlas-brain-unavailable");error.details=data?.details||"";error.status=response.status;throw error}
  if(!data?.plan)throw new Error("atlas-brain-empty-plan");
  return data.plan;
}

function hasExternal(plan){return Array.isArray(plan?.external_searches)&&plan.external_searches.some(item=>item&&item.source&&item.source!=="none"&&clean(item.query))}
function hasWeb(plan){return Array.isArray(plan?.external_searches)&&plan.external_searches.some(item=>["web","marketplace","official"].includes(item?.source)&&clean(item?.query))}
function hasMap(plan,mode){return Array.isArray(plan?.external_searches)&&plan.external_searches.some(item=>item?.source==="maps"&&(!mode||item.mode===mode)&&clean(item?.query))}
function needsLiveWeb(plan){return plan?.domain!=="health"&&(plan?.solution_scope==="information"||!hasExternal(plan))}

function enforceTaskChannel(plan,query){
  if(!plan||typeof plan!=="object"||plan?.domain==="health")return plan;
  const next={...plan};
  const text=String(query||"");
  const service=isServiceNeed(text);
  const transaction=(isExplicitMarketplaceNeed(text)||isProductNeed(text))&&!service;
  const information=isInformationalQuery(text)||next.solution_scope==="information";

  if(service){
    next.domain="services";
    next.solution_scope="local_action";
    next.needs_location=true;
    next.external_searches=(next.external_searches||[]).filter(item=>item?.source==="maps");
    if(!next.external_searches.length){
      next.external_searches=[{source:"maps",mode:"nearby",query:clean(next.goal)||clean(query),reason:"Find concrete local service providers"}];
    }
    next.solution_steps=(next.solution_steps||[]).map(step=>({...step,
      nearby_relevant:true,
      nearby_query:clean(step?.nearby_query)||clean(next.goal)||clean(query),
      internet_relevant:false,
      internet_query:""
    }));
    return next;
  }

  if(transaction&&!information){
    next.solution_scope="transaction";
    next.external_searches=(next.external_searches||[]).filter(item=>item?.source==="marketplace");
    if(!next.external_searches.length){
      next.external_searches=[{source:"marketplace",mode:"standard",query:clean(next.goal)||clean(query),reason:"Find concrete products or listings"}];
    }
    next.solution_steps=(next.solution_steps||[]).map(step=>({...step,
      nearby_relevant:false,
      nearby_query:"",
      internet_relevant:true,
      internet_query:clean(step?.internet_query)||clean(next.goal)||clean(query)
    }));
    return next;
  }

  if(information){
    next.solution_scope="information";
    next.answer="";
    next.external_searches=(next.external_searches||[])
      .map(item=>item?.source==="marketplace"?{...item,source:"web"}:item)
      .filter(item=>item?.source!=="maps");
    if(!next.external_searches.length){
      next.external_searches=[{source:"web",mode:"standard",query:clean(next.goal)||clean(query),reason:"Find current external information"}];
    }
    next.solution_steps=(next.solution_steps||[]).map(step=>({...step,
      nearby_relevant:false,
      nearby_query:"",
      internet_relevant:true,
      internet_query:clean(step?.internet_query)||clean(next.goal)||clean(query)
    }));
    if(!next.solution_steps.length){
      next.solution_steps=[{id:"web-result",title:"Web search",purpose:clean(next.goal)||clean(query),passport_terms:[],nearby_query:"",internet_query:clean(next.goal)||clean(query),nearby_relevant:false,internet_relevant:true}];
    }
  }
  return next;
}

function universalizePlan(plan,query,{lang="uk",locationAvailable=false}={}){
  if(!plan||plan?.domain==="health")return plan;
  const fallback=createFallbackPlan(query,{lang});
  const next={...plan};
  if(next?.clarification?.required&&hasExternal(next))next.clarification={required:false,question:"",options:[]};

  const searches=[...(Array.isArray(next.external_searches)?next.external_searches:[])];
  if(needsLiveWeb(next)&&!hasWeb(next))searches.push({source:"web",mode:"standard",query:clean(next.goal)||clean(query),reason:lang==="uk"?"Отримати актуальну відповідь із живих зовнішніх джерел":"Get a current answer from live external sources"});
  if(next.solution_scope==="destination_route"&&!hasMap(next,"destination")){
    const destination=fallback.external_searches.find(item=>item.source==="maps")||{source:"maps",mode:"destination",query:clean(next.goal)||clean(query),reason:"Resolve destination"};
    searches.push({...destination,mode:"destination"});
  }
  if(next.solution_scope==="mixed"&&locationAvailable&&hasWeb(next)&&!hasMap(next,"nearby")){
    const local=fallback.external_searches.find(item=>item.source==="maps"&&item.mode==="nearby");
    if(local)searches.push(local);
  }
  next.external_searches=searches.filter((item,index,array)=>item&&clean(item.query)&&array.findIndex(other=>other?.source===item.source&&other?.mode===item.mode&&clean(other?.query)===clean(item.query))===index);

  let steps=Array.isArray(next.solution_steps)?next.solution_steps.filter(Boolean):[];
  if(!steps.length)steps=fallback.solution_steps;
  if(needsLiveWeb(next)&&!steps.some(step=>step.internet_relevant&&clean(step.internet_query))){
    steps=[...steps,{id:"live-web-answer",title:lang==="uk"?"Знайти актуальну відповідь":"Find a current answer",purpose:clean(next.goal)||clean(query),passport_terms:[],nearby_query:"",internet_query:clean(next.goal)||clean(query),nearby_relevant:false,internet_relevant:true}].slice(0,4);
  }
  next.solution_steps=steps;
  if(!next.passport_search)next.passport_search=fallback.passport_search;
  return next;
}

export async function analyzeAtlasQuery(query,{lang="uk",location=null,locationText="",signal}={}){
  const original=clean(query);
  const context={lang,locationAvailable:Boolean(location||clean(locationText))};
  let candidate;
  try{candidate=await requestBrainPlan(original,{lang,location,locationText,signal})}
  catch(error){if(error?.name==="AbortError")throw error;return createFallbackPlan(original,{lang})}

  candidate=enforceTaskChannel(universalizePlan(candidate,original,context),original);
  if(candidate?.clarification?.required)return candidate;

  const brokenRoute=candidate?.solution_scope==="destination_route"&&!hasMap(candidate,"destination");
  const emptyPlan=!hasExternal(candidate)&&candidate?.domain!=="health";
  if(!brokenRoute&&!emptyPlan)return candidate;

  try{
    const retry=await requestBrainPlan(`${original}\n\nAtlas quality rule: produce at least one executable retrieval path. Current information must use live web/official sources; destination routes must use maps destination mode. Do not stop after Passport search.`,{lang,location,locationText,signal});
    return enforceTaskChannel(universalizePlan(retry,original,context),original);
  }catch(error){if(error?.name==="AbortError")throw error;return enforceTaskChannel(universalizePlan(createFallbackPlan(original,{lang}),original,context),original)}
}
