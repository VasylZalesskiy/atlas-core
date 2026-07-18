const universalSteps = [
  {id:"consultation",titles:{uk:"Консультація",en:"Consultation"},type:"consulting",keywords:["consultation","консультація","планування"]},
  {id:"resources",titles:{uk:"Ресурси",en:"Resources"},type:"resource",keywords:["resources","ресурси","матеріали","обладнання"]},
  {id:"contractor",titles:{uk:"Виконавець",en:"Contractor"},type:"service",keywords:["contractor","виконавець","роботи","послуги"]},
  {id:"logistics",titles:{uk:"Логістика",en:"Logistics"},type:"logistics",keywords:["logistics","логістика","доставка","транспорт"]},
  {id:"funding",titles:{uk:"Фінансування",en:"Funding"},type:"funding",keywords:["funding","фінансування","кредит","грант"]}
];

const scenarios = [
  {id:"greenhouse",category:"agriculture",intent:"build",terms:["теплиц","greenhouse"],steps:[
    ["design",{uk:"Проєктування теплиці",en:"Greenhouse design"},"consulting",["проєктування","теплиця","design","greenhouse"]],
    ["materials",{uk:"Матеріали для теплиці",en:"Greenhouse materials"},"resource",["полікарбонат","каркас","матеріали","materials"]],
    ["construction",{uk:"Монтаж теплиці",en:"Greenhouse installation"},"service",["монтаж","теплиця","installation","construction"]],
    ["transport",{uk:"Доставка матеріалів",en:"Material delivery"},"logistics",["доставка","матеріали","delivery","transport"]]
  ]},
  {id:"cafe",category:"hospitality",intent:"open",terms:["кав'яр","кав’яр","кавяр","coffee shop","cafe","café"],steps:[
    ["business-plan",{uk:"Консультація та бізнес-план",en:"Consulting and business plan"},"consulting",["кав'ярня","бізнес-план","consulting","cafe"]],
    ["premises",{uk:"Приміщення",en:"Premises"},"rental",["оренда","приміщення","rental","premises"]],
    ["coffee-equipment",{uk:"Кавове обладнання",en:"Coffee equipment"},"equipment",["кавомашина","обладнання","coffee","equipment"]],
    ["supplies",{uk:"Постачання кави",en:"Coffee supplies"},"supply",["кава","постачання","coffee","supply"]],
    ["promotion",{uk:"Просування",en:"Promotion"},"marketing",["реклама","просування","marketing","promotion"]]
  ]},
  {id:"transport",category:"transport",intent:"transport",terms:["перевез","достав","тонн","transport","deliver","haul"],steps:[
    ["freight",{uk:"Вантажний транспорт",en:"Freight transport"},"logistics",["вантаж","перевезення","тонн","freight","transport"]],
    ["loading",{uk:"Завантаження",en:"Loading"},"service",["навантаження","завантаження","loading"]],
    ["storage",{uk:"Тимчасове зберігання",en:"Temporary storage"},"rental",["склад","зберігання","storage","warehouse"]]
  ]},
  {id:"foundation",category:"construction",intent:"build",terms:["фундамент","foundation","котлован"],steps:[
    ["survey",{uk:"Оцінка та розмітка",en:"Assessment and layout"},"consulting",["розмітка","оцінка","геодезія","survey"]],
    ["excavation",{uk:"Земляні роботи",en:"Excavation"},"service",["копати","земляні роботи","фундамент","excavation"]],
    ["excavator",{uk:"Екскаватор",en:"Excavator"},"equipment",["екскаватор","техніка","excavator","equipment"]],
    ["material-transport",{uk:"Вивезення ґрунту",en:"Soil removal"},"logistics",["ґрунт","вивезення","самоскид","soil","transport"]]
  ]},
  {id:"job",category:"employment",intent:"find",terms:["робот","ваканс","працевлаш","job","work","employment"],steps:[
    ["career",{uk:"Кар'єрна консультація",en:"Career consultation"},"consulting",["кар'єра","резюме","career","resume"]],
    ["vacancy",{uk:"Відповідна вакансія",en:"Suitable vacancy"},"employment",["вакансія","робота","job","vacancy"]],
    ["skills",{uk:"Підготовка навичок",en:"Skills preparation"},"education",["навички","навчання","skills","training"]]
  ]},
  {id:"renovation",category:"construction",intent:"renovate",terms:["ремонт","renovat","refurbish"],steps:[
    ["estimate",{uk:"Оцінка та кошторис",en:"Assessment and estimate"},"consulting",["кошторис","оцінка","estimate","renovation"]],
    ["renovation-materials",{uk:"Ремонтні матеріали",en:"Renovation materials"},"resource",["будматеріали","ремонт","materials"]],
    ["renovation-team",{uk:"Ремонтна команда",en:"Renovation team"},"service",["ремонт","майстри","renovation","contractor"]],
    ["waste",{uk:"Вивезення відходів",en:"Waste removal"},"logistics",["відходи","вивезення","waste","transport"]]
  ]}
];

function normalize(text){return text.toLowerCase().replace(/[.,!?;:()]/g," ").replace(/\s+/g," ").trim()}
function localizeStep(step,lang,category){
  if(Array.isArray(step)){return {id:step[0],title:step[1][lang]||step[1].uk,type:step[2],category,keywords:step[3]}}
  return {id:step.id,title:step.titles[lang]||step.titles.uk,type:step.type,category:"general",keywords:step.keywords};
}

/**
 * Перетворює довільну мету на структурований сценарій за словниковими правилами.
 * @param {string} goal Початковий текст мети.
 * @param {"uk"|"en"} lang Мова результату.
 * @returns {{originalGoal:string,normalizedGoal:string,category:string,intent:string,keywords:string[],scenario:string,requiredOpportunities:Array}}
 */
export function parseGoal(goal,lang="uk"){
  const originalGoal=String(goal||"").trim();
  const normalizedGoal=normalize(originalGoal).replace(/^(я |i |хочу |потрібно |мені потрібно |want to |need to )+/i,"").trim();
  const scenario=scenarios.find(item=>item.terms.some(term=>normalizedGoal.includes(term)));
  const words=normalizedGoal.split(" ").filter(word=>word.length>2);
  return {
    originalGoal,
    normalizedGoal,
    category:scenario?.category||"general",
    intent:scenario?.intent||"solve",
    keywords:[...new Set(words)],
    scenario:scenario?.id||"universal",
    requiredOpportunities:(scenario?.steps||universalSteps).map(step=>localizeStep(step,lang,scenario?.category||"general"))
  };
}
