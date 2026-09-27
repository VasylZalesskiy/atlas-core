import {useEffect,useState} from "react";
import {ExternalLink,Globe2,MapPin,Search} from "lucide-react";
import {useSearchParams} from "react-router-dom";
import {searchExternalSources} from "../services/externalSearch";
import "../styles/pilotRedesign.css";

function buildPlan(q,where){
  const medical=/болить|біль|травм|температур|задишк|непритом|лікар|медич|pain|hurt|injur|doctor|medical/i.test(q);
  const query=[q,where].filter(Boolean).join(" ");
  return {
    goal:q,
    original_query:q,
    location_text:where,
    domain:medical?"health":"general",
    external_searches:medical
      ?[{source:"official",query:q},{source:"web",query}]
      :[{source:"web",query},{source:"marketplace",query},{source:"official",query:q}]
  };
}

export default function WebResults({lang="uk"}){
  const uk=lang!=="en";
  const [params]=useSearchParams();
  const q=(params.get("q")||"").trim();
  const where=(params.get("where")||"").trim();
  const medical=/болить|біль|травм|температур|задишк|непритом|лікар|медич|pain|hurt|injur|doctor|medical/i.test(q);
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError("");
    searchExternalSources(buildPlan(q,where),{lang,signal:controller.signal})
      .then(setItems)
      .catch(cause=>{if(cause?.name!=="AbortError")setError(String(cause?.message||cause||"external-search-failed"))})
      .finally(()=>setLoading(false));
    return()=>controller.abort();
  },[q,where,lang]);

  const google=`https://www.google.com/search?q=${encodeURIComponent([q,where].filter(Boolean).join(" "))}`;
  const maps=`https://www.google.com/maps/search/${encodeURIComponent([q,where].filter(Boolean).join(" "))}`;

  return <main className="pilotPage pilotResults">
    <header className="pilotPageHead"><div><Globe2 size={22}/><h1>{medical?(uk?"Медичні джерела з інтернету":"Medical web sources"):(uk?"Результати з інтернету":"Internet results")}</h1></div><p>{medical?(uk?"Це додаткові джерела, а не діагноз. За погіршення стану зверніться по медичну допомогу.":"These are additional sources, not a diagnosis. Seek medical care if symptoms worsen."):(uk?"Зовнішні джерела показані окремо від можливостей Atlas.":"External sources are separate from Atlas capabilities.")}</p></header>
    <section className="pilotQueryBar"><Search size={18}/><strong>{q}</strong>{where&&<small><MapPin size={14}/>{where}</small>}</section>
    {loading&&<div className="pilotState">{uk?"Шукаю у зовнішніх джерелах…":"Searching external sources…"}</div>}
    {error&&<div className="pilotError">{error}</div>}
    <div className="pilotResultList">
      {items.map((item,index)=><article className="pilotResultCard web" key={item.url||index}>
        <div className="pilotResultTop"><div><strong>{item.title||item.source_name||q}</strong><span>{item.source_name||item.source_type||"Web"}</span></div></div>
        {(item.snippet||item.description||item.answer)&&<p>{item.snippet||item.description||item.answer}</p>}
        {item.url&&<a href={item.url} target="_blank" rel="noreferrer"><ExternalLink size={16}/>{uk?"Відкрити джерело":"Open source"}</a>}
      </article>)}
    </div>
    {!loading&&!items.length&&<div className="pilotEmpty"><strong>{uk?"Atlas не отримав структурованих результатів":"Atlas did not receive structured results"}</strong><span>{uk?"Можна відкрити звичайний пошук у браузері.":"You can open a regular browser search."}</span></div>}
    <div className="pilotBrowserFallback"><a href={google} target="_blank" rel="noreferrer"><Globe2 size={17}/>Google</a><a href={maps} target="_blank" rel="noreferrer"><MapPin size={17}/>Google Maps</a></div>
  </main>;
}