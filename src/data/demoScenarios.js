const demoScenarios={
  "medical-emergency":{
    mode:"emergency",
    title:{uk:"Може потребувати невідкладної допомоги",en:"May require urgent medical attention"},
    warning:{uk:"Atlas не встановлює діагноз. Якщо біль дуже сильний або раптовий, є втрата свідомості, утруднене дихання, слабкість/оніміння однієї сторони тіла, порушення мовлення, сильна кровотеча або інша небезпека — телефонуйте 103.",en:"Atlas does not diagnose. If pain is sudden or severe, there is loss of consciousness, breathing difficulty, one-sided weakness or numbness, speech difficulty, severe bleeding, or another danger, call emergency services."},
    bestAction:{uk:"За небезпечних ознак — негайно звернутися по невідкладну допомогу.",en:"If warning signs are present, seek emergency care immediately."},
    primaryOption:{title:{uk:"Найближча невідкладна медична допомога",en:"Nearest emergency medical care"},subtitle:{uk:"Потрібно підтвердити реальну установу поруч",en:"A real nearby facility must be verified"},status:{uk:"Пошук реальної установи ще не підключено",en:"Real facility lookup is not connected yet"}},
    alternatives:[],metrics:{firstActionMinutes:0,distanceKm:0,totalMinutes:0,trustScore:0,completeness:35},
    steps:[{uk:"Оцінити небезпечні ознаки",en:"Assess warning signs"},{uk:"Звернутися по невідкладну допомогу",en:"Seek emergency care"}],
    route:{distanceKm:0,minutes:0},
    contactPolicy:{uk:"Atlas не повинен вигадувати установи, контакти, відстані або час маршруту.",en:"Atlas must not invent facilities, contacts, distances, or route times."}
  },
  "health-symptom":{
    mode:"quick",
    title:{uk:"Потрібно уточнити стан",en:"Your symptoms need clarification"},
    warning:{uk:"Atlas не встановлює діагноз. Якщо головний біль раптовий і надзвичайно сильний, після травми голови, разом із втратою свідомості, слабкістю/онімінням, порушенням мовлення, судомами, високою температурою з ригідністю шиї або іншою різкою зміною стану — потрібна невідкладна медична допомога.",en:"Atlas does not diagnose. A sudden extremely severe headache, headache after head injury, or headache with loss of consciousness, weakness/numbness, speech difficulty, seizures, high fever with a stiff neck, or another abrupt deterioration needs urgent medical attention."},
    bestAction:{uk:"Спочатку оцініть небезпечні ознаки. Якщо їх немає — уточніть симптоми й знайдіть відповідну медичну консультацію.",en:"First check for warning signs. If none are present, clarify the symptoms and find an appropriate medical consultation."},
    primaryOption:{title:{uk:"Медична консультація за симптомами",en:"Symptom-based medical consultation"},subtitle:{uk:"Atlas має уточнити тривалість, силу болю та супутні симптоми перед рекомендацією",en:"Atlas should clarify duration, severity, and accompanying symptoms before recommending next steps"},status:{uk:"Потрібне уточнення · без вигаданих маршрутів",en:"Clarification needed · no invented routes"}},
    alternatives:[],metrics:{firstActionMinutes:0,distanceKm:0,totalMinutes:0,trustScore:0,completeness:45},
    steps:[{uk:"Перевірити небезпечні ознаки",en:"Check warning signs"},{uk:"Уточнити симптоми",en:"Clarify symptoms"},{uk:"Підібрати наступну дію",en:"Choose the next action"}],
    route:{distanceKm:0,minutes:0},
    contactPolicy:{uk:"Реальні установи та контакти можна показувати лише після перевіреного пошуку.",en:"Real facilities and contacts should only be shown after verified lookup."}
  },
  pharmacy:{mode:"quick",title:{uk:"Швидкий пошук допомоги",en:"Quick help search"},warning:{uk:"Наявність препаратів і режим роботи потрібно перевіряти в реальному джерелі.",en:"Medicine availability and opening hours must be verified from a real source."},bestAction:{uk:"Знайти найближчу реально відкриту аптеку та перевірити наявність потрібного.",en:"Find the nearest actually open pharmacy and verify availability."},primaryOption:{title:{uk:"Пошук реальної аптеки поруч",en:"Search for a real nearby pharmacy"},subtitle:{uk:"Поки що зовнішній пошук не підключено",en:"External lookup is not connected yet"},status:{uk:"Без демоданих",en:"No demo data"}},alternatives:[],metrics:{firstActionMinutes:0,distanceKm:0,totalMinutes:0,trustScore:0,completeness:35},steps:[{uk:"Перевірити режим роботи",en:"Check opening hours"},{uk:"Уточнити наявність",en:"Confirm availability"},{uk:"Побудувати маршрут",en:"Build route"}],route:{distanceKm:0,minutes:0},contactPolicy:{uk:"Не показувати вигадані контакти або відстані.",en:"Do not show invented contacts or distances."}},
  roadside:{mode:"quick",title:{uk:"Швидке рішення на дорозі",en:"Quick roadside solution"},warning:{uk:"Спочатку убезпечте місце зупинки. Реальний сервіс потрібно знайти й перевірити.",en:"Secure the stopping place first. A real service must be found and verified."},bestAction:{uk:"Убезпечити місце зупинки та знайти реальну допомогу на дорозі поруч.",en:"Secure the stopping place and find real nearby roadside assistance."},primaryOption:{title:{uk:"Пошук допомоги на дорозі",en:"Roadside assistance search"},subtitle:{uk:"Шиномонтаж або евакуатор — після перевіреного пошуку",en:"Tire service or tow truck after verified lookup"},status:{uk:"Без демоданих",en:"No demo data"}},alternatives:[],metrics:{firstActionMinutes:0,distanceKm:0,totalMinutes:0,trustScore:0,completeness:35},steps:[{uk:"Убезпечити місце зупинки",en:"Secure the stopping place"},{uk:"Описати несправність",en:"Describe the issue"},{uk:"Знайти реальний сервіс",en:"Find a real service"}],route:{distanceKm:0,minutes:0},contactPolicy:{uk:"Не показувати вигадані контакти або час прибуття.",en:"Do not show invented contacts or arrival times."}},
  transport:{mode:"planned",title:{uk:"Планове рішення",en:"Planned solution"}},
  cafe:{mode:"planned",title:{uk:"Планове рішення",en:"Planned solution"}},
  greenhouse:{mode:"planned",title:{uk:"Планове рішення",en:"Planned solution"}},
  universal:{mode:"planned",title:{uk:"Планове рішення",en:"Planned solution"}}
};

export default demoScenarios;
