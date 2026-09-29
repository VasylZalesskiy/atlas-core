import {useEffect,useMemo,useRef,useState} from "react";
import {MapPin} from "lucide-react";
import {searchDestination} from "../services/googleMaps";
import "../styles/locationAutocomplete.css";

const MEMORY_KEY="atlas-city";

const UKRAINE_PRIORITY_PLACES=[
  "Київ","Харків","Одеса","Дніпро","Запоріжжя","Львів","Кривий Ріг","Миколаїв","Вінниця","Херсон",
  "Полтава","Чернігів","Черкаси","Житомир","Суми","Рівне","Івано-Франківськ","Тернопіль","Луцьк","Ужгород",
  "Чернівці","Хмельницький","Кропивницький","Кременчук","Біла Церква","Бровари","Буча","Ірпінь","Мукачево","Дрогобич"
].map((name,index)=>({id:`atlas-ua-${index}`,name,address:`${name}, Україна`,source:"Atlas"}));

const COUNTRY_SUGGESTIONS=[
  ["Україна",["ук","uk","уа","ua","ukr","укра","ukraine"]],
  ["Польща",["поль","pol","poland"]],
  ["Німеччина",["нім","герм","germ","deutschland"]],
  ["Румунія",["рум","rom","romania"]],
  ["Молдова",["молд","mold","moldova"]],
  ["Словаччина",["словач","slovak"]],
  ["Угорщина",["угор","hung","hungary"]],
  ["Чехія",["чех","czech"]],
  ["Австрія",["австр","austria"]],
  ["Італія",["італ","italy"]],
  ["Франція",["фран","france"]],
  ["Іспанія",["ісп","spain"]],
  ["Португалія",["порту","portugal"]],
  ["Велика Британія",["британ","great britain","united kingdom","gb"]],
  ["США",["сша","usa","united states"]],
  ["Канада",["канад","canada"]],
  ["Туреччина",["туреч","turkey","türkiye"]],
  ["Грузія",["груз","georgia"]],
  ["Болгарія",["болгар","bulgaria"]]
].map(([name,aliases],index)=>({id:`atlas-country-${index}`,name,address:name,aliases,source:"Atlas"}));

function normalizeMatch(value){return clean(value).toLocaleLowerCase("uk-UA")}
function localSuggestions(value){
  const q=normalizeMatch(value);
  if(q.length<2)return [];
  const countries=COUNTRY_SUGGESTIONS.filter(item=>{
    const name=normalizeMatch(item.name);
    return name.startsWith(q)||item.aliases.some(alias=>normalizeMatch(alias).startsWith(q)||q.startsWith(normalizeMatch(alias)));
  });
  const cities=UKRAINE_PRIORITY_PLACES.filter(item=>normalizeMatch(item.name).startsWith(q));
  return [...countries,...cities].slice(0,6);
}
function isCountryQuery(value){
  const q=normalizeMatch(value);
  return COUNTRY_SUGGESTIONS.some(item=>normalizeMatch(item.name).startsWith(q)||item.aliases.some(alias=>normalizeMatch(alias).startsWith(q)||q.startsWith(normalizeMatch(alias))));
}

function clean(value){return String(value||"").replace(/\s+/g," ").trim()}

export function rememberedAtlasLocation(){
  try{return clean(localStorage.getItem(MEMORY_KEY)||"")}catch{return ""}
}

export function rememberAtlasLocation(value){
  const next=clean(value);
  if(!next)return;
  try{localStorage.setItem(MEMORY_KEY,next)}catch{}
}

function expandedQuery(value,lang){
  const q=clean(value);
  const lower=q.toLocaleLowerCase(lang==="en"?"en":"uk");
  if(["ук","uk","уа","ua","ukr","ukraine","укра","україна"].includes(lower))return lang==="en"?"Ukraine":"Україна";
  if(lang!=="en"&&!isCountryQuery(q)&&/^[А-ЯІЇЄҐа-яіїєґ'’ -]+$/u.test(q))return `${q} Україна`;
  return q;
}

function secondaryLabel(item){
  const address=clean(item?.address);
  const name=clean(item?.name||item?.title);
  if(!address)return "";
  if(address.toLowerCase()===name.toLowerCase())return "";
  return address;
}

export default function LocationAutocomplete({
  value="",
  onChange,
  onSelect,
  lang="uk",
  placeholder="",
  className="",
  inputClassName="",
  autoRemember=true
}){
  const [open,setOpen]=useState(false);
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(false);
  const [focused,setFocused]=useState(false);
  const requestRef=useRef(0);
  const wrapRef=useRef(null);
  const query=useMemo(()=>clean(value),[value]);

  useEffect(()=>{
    const onPointer=event=>{
      if(!wrapRef.current?.contains(event.target))setOpen(false);
    };
    document.addEventListener("pointerdown",onPointer);
    return()=>document.removeEventListener("pointerdown",onPointer);
  },[]);

  useEffect(()=>{
    if(!focused||query.length<2){
      setItems([]);
      setLoading(false);
      return;
    }
    const requestId=++requestRef.current;
    const controller=new AbortController();
    const timer=window.setTimeout(async()=>{
      setLoading(true);
      try{
        const local=localSuggestions(query);
        const result=await searchDestination(null,expandedQuery(query,lang),{lang,limit:6,signal:controller.signal});
        if(requestId!==requestRef.current)return;
        const remote=(result||[])
          .filter(item=>item?.name||item?.title)
          .sort((a,b)=>{
            const uaA=/україна|ukraine/i.test(String(a?.address||""))?1:0;
            const uaB=/україна|ukraine/i.test(String(b?.address||""))?1:0;
            return uaB-uaA;
          });
        const unique=[...local,...remote]
          .filter((item,index,array)=>{
            const name=normalizeMatch(item?.name||item?.title);
            return name&&array.findIndex(other=>normalizeMatch(other?.name||other?.title)===name)===index;
          })
          .slice(0,6);
        setItems(unique);
        setOpen(true);
      }catch(error){
        if(error?.name!=="AbortError"&&requestId===requestRef.current)setItems([]);
      }finally{
        if(requestId===requestRef.current)setLoading(false);
      }
    },260);
    return()=>{window.clearTimeout(timer);controller.abort()};
  },[query,lang,focused]);

  function choose(item){
    const label=clean(item?.name||item?.title||item?.address);
    if(!label)return;
    onChange?.(label);
    if(autoRemember)rememberAtlasLocation(label);
    setOpen(false);
    setItems([]);
    onSelect?.({...item,label});
  }

  function handleBlur(){
    window.setTimeout(()=>{
      setFocused(false);
      const text=clean(value);
      if(autoRemember&&text)rememberAtlasLocation(text);
    },120);
  }

  return <div className={["atlasLocationAutocomplete",className].filter(Boolean).join(" ")} ref={wrapRef}>
    <input
      className={inputClassName}
      value={value}
      onChange={event=>{onChange?.(event.target.value);setOpen(true)}}
      onFocus={()=>{setFocused(true);if(query.length>=2)setOpen(true)}}
      onBlur={handleBlur}
      placeholder={placeholder}
      autoComplete="off"
      inputMode="search"
      aria-autocomplete="list"
      aria-expanded={open&&Boolean(items.length)}
    />
    {focused&&query.length>=2&&(loading||items.length>0)&&<div className="atlasLocationSuggestions" role="listbox">
      {loading&&items.length===0&&<div className="atlasLocationLoading">{lang==="uk"?"Шукаю місце…":"Finding place…"}</div>}
      {items.map(item=><button type="button" key={item.id||item.address||item.name} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(item)} role="option">
        <MapPin size={16}/>
        <span><strong>{item.name||item.title}</strong>{secondaryLabel(item)&&<small>{secondaryLabel(item)}</small>}</span>
      </button>)}
    </div>}
  </div>;
}
