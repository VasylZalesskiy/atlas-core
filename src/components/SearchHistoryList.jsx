import {useEffect,useState} from "react";
import {Clock3,MapPin,RotateCcw,Trash2} from "lucide-react";
import {clearSearchHistory,listSearchHistory,solutionUrl} from "../services/searchHistory";

function formatDate(value,lang){
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return "";
  return new Intl.DateTimeFormat(lang==="uk"?"uk-UA":"en-US",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(date);
}

export default function SearchHistoryList({lang="uk",limit=12,compact=false,onSelect}){
  const [items,setItems]=useState(()=>listSearchHistory());

  useEffect(()=>{
    const refresh=()=>setItems(listSearchHistory());
    window.addEventListener("atlas-search-history",refresh);
    window.addEventListener("storage",refresh);
    return()=>{window.removeEventListener("atlas-search-history",refresh);window.removeEventListener("storage",refresh)};
  },[]);

  const shown=items.slice(0,limit);
  if(!shown.length)return compact?null:<div className="historyEmpty">{lang==="uk"?"Після першого пошуку тут збережеться ваш запит.":"Your searches will appear here."}</div>;

  return <div className={`searchHistory ${compact?"compact":""}`}>
    <div className="searchHistoryHead">
      <strong><Clock3 size={17}/>{lang==="uk"?"Попередні запити":"Previous searches"}</strong>
      {!compact&&<button type="button" onClick={clearSearchHistory}><Trash2 size={15}/>{lang==="uk"?"Очистити":"Clear"}</button>}
    </div>
    <div className="searchHistoryList">{shown.map(item=><a
      href={solutionUrl(item.task,item.where)}
      key={item.id}
      onClick={onSelect?event=>{event.preventDefault();onSelect(item)}:undefined}
    >
      <RotateCcw size={16}/>
      <span><b>{item.task}</b>{item.where&&<small><MapPin size={12}/>{item.where}</small>}</span>
      <time>{formatDate(item.createdAt,lang)}</time>
    </a>)}</div>
  </div>;
}
