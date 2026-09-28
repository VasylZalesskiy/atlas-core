import {useMemo,useState} from "react";
import {NavLink,Route,Routes,useNavigate,useParams,Navigate} from "react-router-dom";
import {
  ArrowLeft,ArrowRight,CheckCircle2,ChevronRight,Clock3,Compass,
  Heart,Home as HomeIcon,MapPin,MessageCircle,Mic,Plus,Search,
  Send,Settings,SmilePlus,Sparkles,Users,UserRound,AudioWaveform
} from "lucide-react";

const opportunitiesSeed=[
  {id:1,text:"Маю мікроавтобус. Можу допомогти з невеликим перевезенням після 18:00.",time:"після 18:00",radius:"20 км",distance:"3,2 км"},
  {id:2,text:"Ремонтую комп’ютери та ноутбуки. Можу підказати онлайн або приїхати ввечері.",time:"18:00–22:00",radius:"10 км",distance:"1,8 км"},
  {id:3,text:"Можу допомогти літній людині налаштувати телефон або державні застосунки.",time:"у вихідні",radius:"5 км",distance:"4,6 км"},
];

const needsSeed=[
  {id:1,text:"Потрібно завтра перевезти холодильник через місто.",status:"Активна"},
  {id:2,text:"Шукаю людину, яка допоможе налаштувати ноутбук.",status:"Активна"},
];

const dreamsSeed=[
  {id:1287,text:"Мрію хоч раз побачити море.",tag:"Подорожі"},
  {id:1288,text:"Хочу навчитися грати на гітарі.",tag:"Навчання"},
  {id:1291,text:"Мрію зробити маленьку бібліотеку у нашому дворі.",tag:"Спільнота"},
];

const groupsSeed=[
  {id:"house",name:"Наш будинок",members:48,desc:"Допомога, речі, послуги та спільні питання мешканців."},
  {id:"garden",name:"Город і сад",members:126,desc:"Досвід, насіння, інструменти й взаємодопомога."},
  {id:"business",name:"Підприємці Тернополя",members:91,desc:"Контакти, можливості та взаємодопомога."},
];

function Logo(){
  return <NavLink to="/" className="brand" aria-label="Atlas — головна">
    <span className="brandMark"><Compass size={20}/></span>
    <span><b>ATLAS</b><small>Твої можливості — це частинка чиєїсь задачі</small></span>
  </NavLink>
}

function Shell({children}){
  return <div className="atlas2">
    <header className="topbar">
      <Logo/>
      <div className="topActions">
        <NavLink to="/messages" className="iconBtn" aria-label="Повідомлення"><MessageCircle size={20}/><span className="dot">3</span></NavLink>
        <NavLink to="/profile" className="iconBtn" aria-label="Моя сторінка"><UserRound size={20}/></NavLink>
      </div>
    </header>
    <main className="main">{children}</main>
    <BottomNav/>
  </div>
}

function BottomNav(){
  const items=[
    ["/",HomeIcon,"Головна"],
    ["/opportunities",Sparkles,"Можливості"],
    ["/needs",Search,"Потреби"],
    ["/groups",Users,"Групи"],
    ["/messages",MessageCircle,"Чати"],
  ];
  return <nav className="bottomNav" aria-label="Головна навігація">
    {items.map(([to,Icon,label])=><NavLink key={to} to={to} end={to==="/"} className={({isActive})=>isActive?"active":""}>
      <Icon size={21}/><span>{label}</span>
    </NavLink>)}
  </nav>
}

function VoiceButton({onText,label="Надиктувати"}){
  const [listening,setListening]=useState(false);
  const start=()=>{
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!Recognition){
      alert("Голосове введення не підтримується цим браузером. Прототип покаже цю функцію, а в мобільній версії ми додамо стабільний варіант.");
      return;
    }
    const recognition=new Recognition();
    recognition.lang="uk-UA";
    recognition.interimResults=false;
    recognition.maxAlternatives=1;
    recognition.onstart=()=>setListening(true);
    recognition.onend=()=>setListening(false);
    recognition.onerror=()=>setListening(false);
    recognition.onresult=e=>onText?.(e.results?.[0]?.[0]?.transcript||"");
    recognition.start();
  };
  return <button type="button" className={"voiceBtn "+(listening?"listening":"")} onClick={start} aria-label={label}>
    {listening?<AudioWaveform size={22}/>:<Mic size={22}/>}
  </button>
}

function PageIntro({eyebrow,title,children,action}){
  return <div className="pageIntro">
    <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{children&&<p>{children}</p>}</div>
    {action}
  </div>
}

function Home(){
  const nav=useNavigate();
  const [task,setTask]=useState("");
  const solve=()=>nav("/results",{state:{task}});
  return <div className="page homePage">
    <section className="heroCard">
      <span className="eyebrow">Головна мета Atlas</span>
      <h1>Яку задачу тобі потрібно вирішити?</h1>
      <p>Опиши її своїми словами або просто надиктуй. Atlas шукає не оголошення — він шукає можливості людей, які можуть стати частиною рішення.</p>
      <div className="taskComposer">
        <textarea value={task} onChange={e=>setTask(e.target.value)} placeholder="Наприклад: потрібно завтра перевезти холодильник через місто…"/>
        <div className="composerActions">
          <VoiceButton onText={text=>setTask(v=>v? v+" "+text:text)}/>
          <button className="primaryBtn" onClick={solve}><Search size={18}/>Знайти рішення</button>
        </div>
      </div>
      <div className="exampleRow">
        <span>Спробуй:</span>
        {["Потрібен бухгалтер","Перевезти диван","Хто навчить Excel?"].map(x=><button key={x} onClick={()=>setTask(x)}>{x}</button>)}
      </div>
    </section>

    <section className="quickGrid">
      <button className="quickCard accent" onClick={()=>nav("/needs")}>
        <div className="quickIcon"><Plus size={22}/></div>
        <div><strong>Опублікувати потребу</strong><span>Щоб інші користувачі могли побачити твою задачу</span></div>
        <ChevronRight/>
      </button>
      <button className="quickCard" onClick={()=>nav("/opportunities")}>
        <div className="quickIcon"><Sparkles size={22}/></div>
        <div><strong>Мої можливості</strong><span>Що я маю, вмію або можу зробити</span></div>
        <ChevronRight/>
      </button>
    </section>

    <section className="sectionBlock">
      <div className="sectionHeading"><div><span className="eyebrow">Ще в Atlas</span><h2>Люди об’єднуються не тільки навколо задач</h2></div></div>
      <div className="miniGrid">
        <button className="miniCard" onClick={()=>nav("/groups")}><Users/><strong>Групи</strong><span>Будинок, професія, хобі, спільнота</span></button>
        <button className="miniCard" onClick={()=>nav("/dreams")}><Heart/><strong>Мрії людей</strong><span>Окремий, не головний розділ Atlas</span></button>
        <button className="miniCard" onClick={()=>nav("/messages")}><MessageCircle/><strong>Кімнати</strong><span>Усі розмови та спільні рішення</span></button>
      </div>
    </section>
  </div>
}

function Opportunities(){
  const [text,setText]=useState("");
  const [time,setTime]=useState("У будь-який час");
  const [radius,setRadius]=useState("5 км");
  const [items,setItems]=useState(opportunitiesSeed);
  const add=()=>{
    if(!text.trim())return;
    setItems([{id:Date.now(),text:text.trim(),time,radius,distance:"моє"},...items]);
    setText("");
  };
  return <div className="page">
    <PageIntro eyebrow="База можливостей" title="Що ти маєш або можеш?">Пиши довільно. Atlas сам має зрозуміти зміст — без десятків категорій і полів.</PageIntro>
    <div className="twoCol">
      <section className="card composerCard">
        <label>Нова можливість</label>
        <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Маю бус. Можу після роботи допомагати з перевезеннями…"/>
        <div className="voiceHint"><VoiceButton onText={x=>setText(v=>v? v+" "+x:x)}/><span>Натисни мікрофон і просто розкажи</span></div>
        <div className="formGrid">
          <label><span><Clock3 size={16}/>Коли можна турбувати?</span><select value={time} onChange={e=>setTime(e.target.value)}><option>У будь-який час</option><option>08:00–18:00</option><option>Після 18:00</option><option>У вихідні</option></select></label>
          <label><span><MapPin size={16}/>Радіус</span><select value={radius} onChange={e=>setRadius(e.target.value)}><option>1 км</option><option>5 км</option><option>20 км</option><option>Місто</option><option>Область</option><option>Вся Україна</option><option>Онлайн</option></select></label>
        </div>
        <button className="primaryBtn full" onClick={add}><Plus size={18}/>Опублікувати можливість</button>
      </section>
      <aside className="softCard">
        <Sparkles/>
        <h3>Головний принцип</h3>
        <p>Можливість — це не оголошення. Це будь-що, що може стати частиною чиєїсь задачі: час, знання, інструмент, транспорт, контакт, навичка.</p>
      </aside>
    </div>
    <section className="sectionBlock">
      <div className="sectionHeading"><h2>Мої можливості</h2><span>{items.length} активні</span></div>
      <div className="list">
        {items.map(item=><article className="listCard" key={item.id}>
          <div className="listIcon"><Sparkles size={19}/></div>
          <div className="listMain"><h3>{item.text}</h3><div className="meta"><span><Clock3/> {item.time}</span><span><MapPin/> {item.radius}</span></div></div>
          <button className="ghostBtn">Редагувати</button>
        </article>)}
      </div>
    </section>
  </div>
}

function Needs(){
  const nav=useNavigate();
  const [text,setText]=useState("");
  const [items,setItems]=useState(needsSeed);
  const add=()=>{if(!text.trim())return;setItems([{id:Date.now(),text:text.trim(),status:"Активна"},...items]);setText("");};
  return <div className="page">
    <PageIntro eyebrow="Мої задачі" title="Потреби">Потреба — це задача, яку ти вирішив опублікувати. Пошук рішення запускаєш сам, коли тобі це потрібно.</PageIntro>
    <section className="card horizontalComposer">
      <div className="grow"><label>Нова потреба</label><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Що тобі потрібно?"/></div>
      <div className="stackActions"><VoiceButton onText={x=>setText(v=>v? v+" "+x:x)}/><button className="primaryBtn" onClick={add}><Plus size={18}/>Опублікувати</button></div>
    </section>
    <section className="sectionBlock">
      <div className="sectionHeading"><h2>Активні потреби</h2><span>{items.length}</span></div>
      <div className="list">
        {items.map(item=><article className="listCard needCard" key={item.id}>
          <div className="listIcon"><Search size={19}/></div>
          <div className="listMain"><span className="status">{item.status}</span><h3>{item.text}</h3></div>
          <button className="primaryBtn compact" onClick={()=>nav("/results",{state:{task:item.text}})}>Знайти рішення</button>
        </article>)}
      </div>
    </section>
  </div>
}

function Results(){
  const nav=useNavigate();
  return <div className="page">
    <button className="backBtn" onClick={()=>nav(-1)}><ArrowLeft/>Назад</button>
    <PageIntro eyebrow="Atlas знайшов" title="Можливі частини рішення">Нижче не “товари”, а люди та можливості, які можуть допомогти з твоєю задачею.</PageIntro>
    <div className="solutionBanner"><CheckCircle2/><div><strong>Є 3 релевантні можливості</strong><span>Обери одну і почни розмову. За потреби можна запросити кількох людей у спільну кімнату.</span></div></div>
    <div className="list resultList">
      {opportunitiesSeed.map((item,i)=><article className="resultCard" key={item.id}>
        <div className="matchScore">{92-i*7}%</div>
        <div className="listMain"><span className="eyebrow">Можливість #{item.id}</span><h3>{item.text}</h3><div className="meta"><span><MapPin/> {item.distance}</span><span><Clock3/> {item.time}</span><span>Радіус {item.radius}</span></div></div>
        <button className="primaryBtn compact" onClick={()=>nav("/room/solution")}>Написати</button>
      </article>)}
    </div>
  </div>
}

function Groups(){
  return <div className="page">
    <PageIntro eyebrow="Спільноти" title="Групи" action={<button className="primaryBtn compact"><Plus size={18}/>Створити</button>}>Групи за місцем, інтересами, професією чи спільною справою.</PageIntro>
    <div className="searchLine"><Search/><input placeholder="Знайти групу…"/></div>
    <div className="groupGrid">{groupsSeed.map(g=><article className="groupCard" key={g.id}><div className="groupAvatar"><Users/></div><div><h3>{g.name}</h3><span>{g.members} учасників</span><p>{g.desc}</p></div><button className="ghostBtn">Відкрити</button></article>)}</div>
  </div>
}

function Dreams(){
  const nav=useNavigate();
  const [q,setQ]=useState("");
  const [mine,setMine]=useState("");
  const filtered=useMemo(()=>dreamsSeed.filter(d=>d.text.toLowerCase().includes(q.toLowerCase())||d.tag.toLowerCase().includes(q.toLowerCase())),[q]);
  return <div className="page">
    <PageIntro eyebrow="Додатковий розділ" title="Мрії людей">Мрія публікується інкогніто. Atlas не показує автора, контакти чи фінансові реквізити — контакт починається тільки в кімнаті мрії.</PageIntro>
    <div className="dreamTop">
      <section className="card myDream">
        <div className="dreamIcon"><Heart/></div>
        <div className="grow"><label>Моя одна активна мрія</label><textarea value={mine} onChange={e=>setMine(e.target.value)} placeholder="Про що ти мрієш?"/></div>
        <button className="ghostBtn">Опублікувати інкогніто</button>
      </section>
      <div className="searchLine"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Пошук мрій…"/></div>
    </div>
    <div className="dreamGrid">{filtered.map(d=><article className="dreamCard" key={d.id}><div className="dreamMeta"><span>Мрія №{d.id}</span><span>{d.tag}</span></div><h3>{d.text}</h3><button className="primaryBtn full" onClick={()=>nav("/room/dream")}><SmilePlus size={18}/>Долучитися</button></article>)}</div>
  </div>
}

function Messages(){
  const nav=useNavigate();
  const chats=[
    ["solution","Перевезення холодильника","Можу бути після 18:00","2"],
    ["dream","Кімната мрії №1287","3 учасники · нове повідомлення","5"],
    ["group","Наш будинок","Хтось може позичити драбину?",""],
  ];
  return <div className="page">
    <PageIntro eyebrow="Контакт" title="Чати та кімнати">Усі розмови Atlas в одному місці: задачі, групи та кімнати мрій.</PageIntro>
    <div className="chatList">{chats.map(([id,title,last,badge])=><button key={id} className="chatRow" onClick={()=>nav("/room/"+id)}><div className="chatAvatar"><MessageCircle/></div><div className="grow"><strong>{title}</strong><span>{last}</span></div>{badge&&<b className="badge">{badge}</b>}<ChevronRight/></button>)}</div>
  </div>
}

function Room(){
  const {type}=useParams();
  const nav=useNavigate();
  const dream=type==="dream";
  const title=dream?"Мрія №1287":type==="group"?"Наш будинок":"Перевезення холодильника";
  const subtitle=dream?"«Мрію хоч раз побачити море»":type==="group"?"48 учасників":"Потрібно завтра перевезти холодильник через місто";
  const [message,setMessage]=useState("");
  const [messages,setMessages]=useState([
    {mine:false,text:dream?"Я можу допомогти з дорогою.":"Доброго дня. Бачу, вам потрібне перевезення."},
    {mine:true,text:dream?"Я знаю житло біля моря.":"Так. Потрібно завтра після 18:00."},
    {mine:false,text:dream?"Давайте спробуємо організувати це разом.":"Можу. Напишіть деталі."},
  ]);
  const send=()=>{if(!message.trim())return;setMessages([...messages,{mine:true,text:message.trim()}]);setMessage("");};
  return <div className="roomPage">
    <div className="roomHeader">
      <button className="iconBtn" onClick={()=>nav(-1)}><ArrowLeft/></button>
      <div className="grow"><span className="eyebrow">{dream?"Кімната мрії":"Кімната Atlas"}</span><h2>{title}</h2><p>{subtitle}</p></div>
      <button className="iconBtn"><Users/></button>
    </div>
    <div className="messagesArea">
      {messages.map((m,i)=><div key={i} className={"bubbleRow "+(m.mine?"mine":"")}><div className="avatar">{m.mine?"Я":String.fromCharCode(65+i)}</div><div className="bubble">{m.text}</div></div>)}
    </div>
    {dream&&<div className="dreamNotice"><Heart/><span>Автор мрії залишається інкогніто. Лише автор зможе закрити її як здійснену.</span></div>}
    <div className="messageComposer"><VoiceButton onText={x=>setMessage(v=>v? v+" "+x:x)}/><input value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")send()}} placeholder="Написати повідомлення…"/><button className="sendBtn" onClick={send}><Send/></button></div>
  </div>
}

function Profile(){
  const nav=useNavigate();
  const items=[
    [Sparkles,"Мої можливості","3 активні","/opportunities"],
    [Search,"Мої потреби","2 активні","/needs"],
    [Heart,"Моя мрія","не опублікована","/dreams"],
    [Users,"Мої групи","3 групи","/groups"],
    [MessageCircle,"Мої чати","3 нові","/messages"],
  ];
  return <div className="page">
    <PageIntro eyebrow="Моя сторінка" title="Atlas пам’ятає мене">Профіль створюється один раз. Далі ти одразу потрапляєш у свою сторінку без повторного введення даних.</PageIntro>
    <section className="profileCard"><div className="profileAvatar">V</div><div><h3>Користувач Atlas</h3><span>Тернопіль · профіль активний</span></div><button className="ghostBtn"><Settings/>Змінити дані</button></section>
    <div className="profileLinks">{items.map(([Icon,title,meta,to])=><button key={title} onClick={()=>nav(to)}><Icon/><div><strong>{title}</strong><span>{meta}</span></div><ChevronRight/></button>)}</div>
  </div>
}

export default function App(){
  return <Shell><Routes>
    <Route path="/" element={<Home/>}/>
    <Route path="/opportunities" element={<Opportunities/>}/>
    <Route path="/needs" element={<Needs/>}/>
    <Route path="/results" element={<Results/>}/>
    <Route path="/groups" element={<Groups/>}/>
    <Route path="/dreams" element={<Dreams/>}/>
    <Route path="/messages" element={<Messages/>}/>
    <Route path="/room/:type" element={<Room/>}/>
    <Route path="/profile" element={<Profile/>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></Shell>
}
