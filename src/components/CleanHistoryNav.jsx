import {ArrowLeft,ArrowRight} from "lucide-react";

export default function CleanHistoryNav({lang="uk"}){
  const uk=lang!=="en";
  return <nav className="cleanHeaderHistory" aria-label={uk?"Навігація сторінок":"Page navigation"}>
    <button type="button" onClick={()=>window.history.back()} aria-label={uk?"Назад":"Back"}>
      <ArrowLeft size={14}/>
      <span>{uk?"Назад":"Back"}</span>
    </button>
    <button type="button" onClick={()=>window.history.forward()} aria-label={uk?"Вперед":"Forward"}>
      <span>{uk?"Вперед":"Forward"}</span>
      <ArrowRight size={14}/>
    </button>
  </nav>;
}
