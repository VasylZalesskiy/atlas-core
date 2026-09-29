import {useEffect,useMemo,useRef,useState} from "react";
import {MapPin} from "lucide-react";
import {searchDestination} from "../services/googleMaps";
import "../styles/locationAutocomplete.css";

const MEMORY_KEY="atlas-city";

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
        const result=await searchDestination(null,expandedQuery(query,lang),{lang,limit:6,signal:controller.signal});
        if(requestId!==requestRef.current)return;
        const unique=(result||[])
          .filter(item=>item?.name||item?.title)
          .filter((item,index,array)=>array.findIndex(other=>(other.id||other.address||other.name)===(item.id||item.address||item.name))===index)
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
