function cleanTerms(query){
  return [...new Set(String(query||"").toLowerCase().replace(/[.,!?;:()]/g," ").split(/\s+/).filter(word=>word.length>2))].slice(0,12);
}

function isProductNeed(value){
  const text=String(value||"");
  const quantity=/\d+(?:[\s.]\d{3})*(?:[.,]\d+)?\s*(?:кг(?!\p{L})|kg\b|кілограм(?:ів|и|а)?|т(?!\p{L})|тонн(?:а|и|у)?|tonnes?\b)/iu.test(text);
  const transaction=/куп|придба|замов|потрібн|товар|продукт|постач|опт|гурт|buy|order|supplier|wholesale|bulk/i.test(text);
  return quantity||transaction;
}

function isAgricultureNeed(value){
  return /агро|сільськ|ферм|врожай|картоп|горох|бобов|круп|овоч|фрукт|зерн|пшени|кукурудз|соняш|буряк|морк|цибул|капуст|яблук|ягод|насін|food|produce|peas?/i.test(String(value||""));
}

function isHealthNeed(value){
  return /болить|біль|живіт|голов|груд|спин|температур|нудот|блюван|запамороч|не можу дих|важко дих|непритом|кров у|каш(ель|ля)|травм|поріз|опік|тиск|серц|stomach ache|stomach pain|headache|chest pain|fever|nausea|vomit|dizz|faint|bleed|cannot breathe|can't breathe/i.test(String(value||""));
}

function healthDecision(value){
  const text=String(value||"");
  if(/так\s*[,—-]?\s*є хоча б одна/i.test(text))return "emergency";
  if(/ні\s*[,—-]?\s*біль легкий і не посилюється/i.test(text))return "mild";
  if(/ні\s*[,—-]?\s*але біль сильний або посилюється/i.test(text))return "urgent";
  return "triage";
}

function healthGoal(value){
  return String(value||"").replace(/,\s*(?:так\s*[,—-]?\s*є хоча б одна|ні\s*[,—-]?\s*але біль сильний або посилюється|ні\s*[,—-]?\s*біль легкий і не посилюється).*$/i,"").trim();
}

function createHealthPlan(query,lang){
  const decision=healthDecision(query);
  const goal=healthGoal(query);
  const uk=lang==="uk";
  const passportTerms=uk?["лікар","сімейний лікар","медик","фельдшер"]:["doctor","family doctor","medic","paramedic"];
  const base={
    understood:Boolean(goal),goal,intent:"get_help",domain:"health",solution_scope:"local_action",
    passport_search:{terms:passportTerms,capability_description:uk?"Перевірена медична допомога або консультація":"Verified medical help or consultation"},
    result_strategy:uk?"Спочатку терміновість, потім одна найбезпечніша наступна дія":"Urgency first, then one safest next action",
    fallback:true
  };

  if(decision==="triage")return {
    ...base,urgency:"unknown",needs_location:false,
    clarification:{
      required:true,
      question:uk?"Чи є хоча б одна небезпечна ознака?":"Is at least one warning sign present?",
      helper_text:uk
        ?"Раптовий або дуже сильний біль; живіт різко болить при дотику; кров у блюванні чи калі; непритомність; утруднене дихання або біль у грудях."
        :"Sudden or severe pain; marked tenderness; blood in vomit or stool; collapse; trouble breathing or chest pain.",
      options:uk
        ?["Так, є хоча б одна","Ні, але біль сильний або посилюється","Ні, біль легкий і не посилюється"]
        :["Yes, at least one","No, but pain is severe or worsening","No, pain is mild and not worsening"]
    },
    solution_steps:[{
      id:"medical-triage",title:uk?"Визначити терміновість":"Determine urgency",purpose:goal,
      passport_terms:passportTerms,nearby_query:"",internet_query:"",nearby_relevant:false,internet_relevant:false
    }],
    external_searches:[],
    safety:{level:"caution",message:uk?"Atlas не ставить діагноз — спочатку потрібно визначити терміновість.":"Atlas does not diagnose — urgency must be determined first."}
  };

  if(decision==="emergency")return {
    ...base,urgency:"emergency",needs_location:false,clarification:{required:false,question:"",options:[]},
    direct_action:{
      id:"call-emergency",type:"emergency",source:uk?"Екстрена медична допомога":"Emergency medical help",
      title:uk?"Телефонуйте 103 або 112 зараз":"Call emergency services now",
      description:uk?"Повідомте диспетчеру симптоми та точне місце перебування.":"Tell the dispatcher the symptoms and your exact location.",
      primary_href:"tel:103",primary_label:uk?"Подзвонити 103":"Call 103",
      secondary_href:"tel:112",secondary_label:uk?"Подзвонити 112":"Call 112",
      recommendation:uk?"За небезпечних ознак наступна дія — виклик екстреної допомоги, а не пошук інформації.":"With warning signs, the next action is emergency help, not an information search."
    },
    solution_steps:[{
      id:"call-emergency",title:uk?"Викликати екстрену допомогу":"Call emergency services",purpose:goal,
      passport_terms:[],nearby_query:"",internet_query:"",nearby_relevant:false,internet_relevant:false
    }],
    external_searches:[],
    safety:{level:"urgent",message:uk?"Не керуйте авто самі, якщо стан тяжкий.":"Do not drive yourself if the condition is severe."}
  };

  const urgent=decision==="urgent";
  const mapsQuery=urgent
    ?(uk?"невідкладна медична допомога лікарня клініка":"urgent medical care hospital clinic")
    :(uk?"сімейний лікар амбулаторія":"family doctor medical clinic");
  return {
    ...base,urgency:urgent?"urgent":"soon",needs_location:true,clarification:{required:false,question:"",options:[]},
    direct_action:{
      id:urgent?"medical-care-today":"contact-family-doctor",type:"find_care",source:uk?"Медична допомога":"Medical help",
      title:urgent?(uk?"Зверніться до лікаря сьогодні":"See a doctor today"):(uk?"Зв’яжіться із сімейним лікарем":"Contact a family doctor"),
      description:urgent
        ?(uk?"Сильний або наростаючий біль потребує медичної оцінки сьогодні.":"Severe or worsening pain needs medical assessment today.")
        :(uk?"Якщо біль не минає, повторюється або посилюється — не відкладайте консультацію.":"If the pain persists, recurs or worsens, do not delay a consultation."),
      maps_query:mapsQuery,primary_label:urgent?(uk?"Знайти допомогу поруч":"Find nearby care"):(uk?"Знайти сімейного лікаря":"Find a family doctor"),
      recommendation:urgent?(uk?"Наступна дія — медична оцінка сьогодні.":"The next action is medical assessment today."):(uk?"Наступна дія — зв’язок із сімейним лікарем, а не веб-пошук.":"The next action is contacting a family doctor, not a web search.")
    },
    solution_steps:[{
      id:urgent?"urgent-care":"family-doctor",title:urgent?(uk?"Медична оцінка сьогодні":"Medical assessment today"):(uk?"Консультація сімейного лікаря":"Family doctor consultation"),purpose:goal,
      passport_terms:passportTerms,nearby_query:mapsQuery,internet_query:"",nearby_relevant:true,internet_relevant:false
    }],
    external_searches:[{source:"maps",mode:"nearby",query:mapsQuery,reason:uk?"Знайти конкретну медичну допомогу та маршрут":"Find concrete medical care and a route"}],
    safety:{level:urgent?"urgent":"caution",message:urgent?(uk?"Якщо з’явиться небезпечна ознака — телефонуйте 103 або 112.":"If a warning sign appears, call emergency services."):(uk?"Якщо стан погіршується — перейдіть до невідкладної допомоги.":"If the condition worsens, seek urgent care.")}
  };
}

function productSearchTerm(value){
  const ignored=new Set([
    "потрібно","потрібен","потрібна","потрібні","треба","хочу","шукаю","знайти","купити","придбати","замовити",
    "мені","для","та","і","у","в","на","по","кг","kg","кілограм","кілограмів","тонна","тонни","тонн","т"
  ]);
  const aliases={гороху:"горох",гороха:"горох",картоплі:"картопля"};
  return String(value||"").toLowerCase()
    .replace(/\d+(?:[\s.]\d{3})*(?:[.,]\d+)?/g," ")
    .replace(/[^\p{L}\p{N}\s-]/gu," ")
    .split(/\s+/)
    .filter(word=>word&&!ignored.has(word))
    .map(word=>aliases[word]||word)
    .slice(0,5)
    .join(" ")
    .trim();
}

export function createFallbackPlan(query,{lang="uk"}={}){
  const terms=cleanTerms(query);
  const goal=String(query||"").trim();
  if(isHealthNeed(goal))return createHealthPlan(goal,lang);
  const productNeed=isProductNeed(goal);
  const agricultureNeed=isAgricultureNeed(goal);
  const product=productSearchTerm(goal)||goal;
  const nearbyQuery=productNeed
    ?(lang==="uk"?`${product} магазин`:`${product} store`)
    :goal;
  const internetQuery=productNeed
    ?(lang==="uk"?`купити ${goal}`:`buy ${goal}`)
    :goal;
  return {
    understood:Boolean(goal),
    goal,
    intent:productNeed?"buy":"solve",
    domain:agricultureNeed?"agriculture":productNeed?"products":"general",
    solution_scope:productNeed?"transaction":"mixed",
    urgency:"planned",
    needs_location:productNeed,
    clarification:{required:false,question:"",options:[]},
    passport_search:{
      terms,
      capability_description:lang==="uk"?"Можливості людей, речі, навички або допомога, релевантні запиту":"People, items, skills or help relevant to the request"
    },
    solution_steps:goal?[{
      id:"main-result",
      title:productNeed
        ?(lang==="uk"?`Знайти, де придбати ${product}`:`Find where to buy ${product}`)
        :(lang==="uk"?"Знайти основне рішення":"Find the main solution"),
      purpose:goal,
      passport_terms:terms,
      nearby_query:nearbyQuery,
      internet_query:internetQuery,
      nearby_relevant:true,
      internet_relevant:true
    }]:[],
    external_searches:productNeed?[
      {source:"maps",mode:"nearby",query:nearbyQuery,reason:lang==="uk"?"Знайти реальні магазини або постачальників поруч":"Find real nearby stores or suppliers"},
      {source:"marketplace",mode:"standard",query:internetQuery,reason:lang==="uk"?"Знайти конкретні товари й оголошення":"Find concrete products and listings"}
    ]:[],
    safety:{level:"none",message:""},
    result_strategy:lang==="uk"?"Спочатку Паспорти можливостей, потім найкращі додаткові варіанти":"Opportunity Passports first, then the best additional options",
    fallback:true
  };
}

async function requestBrainPlan(query,{lang="uk",location=null,locationText="",signal}={}){
  const response=await fetch("/api/brain",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({query,language:lang,location,location_text:locationText}),
    signal
  });

  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const error=new Error(data?.error||"atlas-brain-unavailable");
    error.details=data?.details||"";
    error.status=response.status;
    throw error;
  }

  if(!data?.plan)throw new Error("atlas-brain-empty-plan");
  return data.plan;
}

function hasSearch(plan,source){
  return Array.isArray(plan?.external_searches)
    ?plan.external_searches.some(item=>item&&item.source===source&&String(item.query||"").trim())
    :false;
}

function hasMapMode(plan,mode){
  return Array.isArray(plan?.external_searches)
    ?plan.external_searches.some(item=>item&&item.source==="maps"&&item.mode===mode&&String(item.query||"").trim())
    :false;
}

function hasWebRetrieval(plan){
  return Array.isArray(plan?.external_searches)
    ?plan.external_searches.some(item=>item&&["web","marketplace","official"].includes(item.source)&&String(item.query||"").trim())
    :false;
}

function hasExternalRetrieval(plan){
  return Array.isArray(plan?.external_searches)
    ?plan.external_searches.some(item=>item&&item.source&&item.source!=="none"&&String(item.query||"").trim())
    :false;
}

function hasAnyRetrieval(plan){
  const searches=hasExternalRetrieval(plan);
  const passportTerms=Array.isArray(plan?.passport_search?.terms)&&plan.passport_search.terms.some(term=>String(term||"").trim());
  return searches||passportTerms;
}

function hasContradictoryClarification(plan){
  return Boolean(plan?.clarification?.required&&plan?.clarification?.question&&hasExternalRetrieval(plan));
}

function planNeedsRecovery(plan,{locationAvailable=false}={}){
  // A clarification is allowed to block only when Atlas genuinely cannot start
  // a useful external action yet. If Brain already produced executable searches,
  // saying “clarification required” is contradictory and must be rebuilt.
  if(hasContradictoryClarification(plan))return true;
  if(plan?.clarification?.required&&plan?.clarification?.question)return false;

  // A destination route is not a nearby-place lookup. Atlas must resolve the
  // named destination globally and route to it from the user's current point.
  if(plan?.solution_scope==="destination_route"&&!hasMapMode(plan,"destination"))return true;

  // If location is materially required for a local action, Atlas must actually
  // retrieve a nearby real-world option rather than only return articles/pages.
  if(plan?.solution_scope==="local_action"&&plan?.needs_location&&!hasMapMode(plan,"nearby"))return true;
  if(plan?.needs_location&&!hasSearch(plan,"maps"))return true;

  // Channel-neutral mixed tasks must not collapse into web/delivery only.
  // When Atlas itself classifies the task as mixed and the user's location is
  // already known, a web retrieval path must be accompanied by a nearby path.
  if(plan?.solution_scope==="mixed"&&locationAvailable&&hasWebRetrieval(plan)&&!hasMapMode(plan,"nearby"))return true;

  // Atlas must not stop after merely understanding the request.
  return !hasAnyRetrieval(plan);
}

function recoveryInstruction(plan,{lang="uk",locationAvailable=false}={}){
  const clarificationRule=hasContradictoryClarification(plan)
    ?(lang==="uk"
      ?"План суперечливий: він одночасно каже, що уточнення обов'язкове, і вже містить виконувані зовнішні пошуки. Якщо корисний пошук уже можна почати, встанови clarification.required=false і продовжуй виконання. Уточнення допустиме лише коли без нього справді неможливо почати корисний пошук."
      :"The plan is contradictory: it marks clarification as required while already containing executable external searches. If useful retrieval can already begin, set clarification.required=false and continue execution. Clarification is allowed only when useful searching truly cannot start without it.")
    :"";

  const routeRule=plan?.solution_scope==="destination_route"
    ?(lang==="uk"
      ?"Це маршрут до названого пункту призначення. План зобов'язаний містити source=maps, mode=destination, а query має бути лише назвою/адресою пункту призначення без слів про маршрут."
      :"This is a route to a named destination. The plan must contain source=maps, mode=destination, and query must be only the destination name/address without route wording.")
    :"";

  const localRule=plan?.solution_scope==="local_action"&&plan?.needs_location
    ?(lang==="uk"
      ?"Це локальна фізична дія. План зобов'язаний містити source=maps, mode=nearby для реальної людини/місця/сервісу поруч."
      :"This is a local physical action. The plan must contain source=maps, mode=nearby for a real nearby person/place/service.")
    :"";

  const mixedRule=plan?.solution_scope==="mixed"&&locationAvailable&&hasWebRetrieval(plan)&&!hasMapMode(plan,"nearby")
    ?(lang==="uk"
      ?"Це змішана задача з відомою локацією, але план звузив рішення до web/доставки. Це порушує нейтральність каналів: додай source=maps, mode=nearby для реальних локальних варіантів. Web/доставка може залишитися лише додатковим каналом після Паспортів і локальних варіантів."
      :"This is a mixed task with known location, but the plan collapsed fulfillment into web/delivery. This violates channel neutrality: add source=maps, mode=nearby for real local options. Web/delivery may remain only as an additional channel after Passports and local options.")
    :"";

  return [clarificationRule,routeRule,localRule,mixedRule].filter(Boolean).join(" ");
}

export async function analyzeAtlasQuery(query,{lang="uk",location=null,locationText="",signal}={}){
  const original=String(query||"").trim();
  const qualityContext={locationAvailable:Boolean(location||String(locationText||"").trim())};
  let candidate=await requestBrainPlan(original,{lang,location,locationText,signal});
  if(!planNeedsRecovery(candidate,qualityContext))return candidate;

  // Give Brain up to two chances to rebuild an invalid plan. Never return the
  // original invalid plan merely because the first recovery was also invalid.
  for(let attempt=0;attempt<2;attempt+=1){
    const violation=recoveryInstruction(candidate,{lang,...qualityContext});
    const recoveryQuery=lang==="uk"
      ?`Оригінальний запит користувача: «${original}». Поточний план не пройшов контроль якості. ${violation} Паспорти можливостей завжди перевіряються першими, але їх відсутність не може зупинити виконання задачі. Не нав'язуй канал, якого користувач не просив. Не став уточнення, якщо вже можна почати корисний пошук. Якщо одного відсутнього параметра справді бракує для будь-якого корисного пошуку — постав одне коротке уточнення. Інакше сформуй практичні пошуки, які ведуть до конкретної дії. Не вигадуй результатів і не створюй сценарій під цей приклад.`
      :`Original user request: “${original}”. The current plan failed the quality gate. ${violation} Opportunity Passports are always checked first, but a Passport miss must not stop execution. Do not impose a fulfillment channel the user did not request. Do not ask for clarification when useful searching can already begin. If one missing parameter truly blocks all useful retrieval, ask one short clarification. Otherwise produce practical retrieval actions that lead to a concrete next step. Do not invent results or create a scenario for this example.`;

    try{
      candidate=await requestBrainPlan(recoveryQuery,{lang,location,locationText,signal});
      if(!planNeedsRecovery(candidate,qualityContext))return candidate;
    }catch(error){
      if(error?.name==="AbortError")throw error;
      break;
    }
  }

  // If Brain still returns a contradictory clarification together with runnable
  // searches, do not block the user with the question: keep the searches and
  // let Atlas execute them. Structural map/channel checks above still apply.
  if(hasContradictoryClarification(candidate)){
    candidate={
      ...candidate,
      clarification:{required:false,question:"",options:[]}
    };
  }

  // If Brain still cannot produce a quality-valid channel-neutral plan, suppress
  // misleading web-only fulfillment instead of pretending it is the full answer.
  if(candidate?.solution_scope==="mixed"&&qualityContext.locationAvailable&&hasWebRetrieval(candidate)&&!hasMapMode(candidate,"nearby")){
    return {
      ...candidate,
      external_searches:(candidate.external_searches||[]).filter(item=>!["web","marketplace","official"].includes(item?.source)),
      clarification:{
        required:true,
        question:lang==="uk"?"Не вдалося надійно знайти локальні варіанти. Хочете, щоб Atlas поки показав онлайн/доставку?":"Local options could not be retrieved reliably. Should Atlas show online/delivery options for now?",
        options:lang==="uk"?["Так, показати онлайн / доставку"]:["Yes, show online / delivery"]
      }
    };
  }

  return candidate;
}
