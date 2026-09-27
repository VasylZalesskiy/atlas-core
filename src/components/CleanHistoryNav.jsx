import {ArrowLeft,ArrowRight} from "lucide-react";

export default function CleanHistoryNav({lang="uk"}){
  const uk=lang!=="en";
  return <nav className="cleanHistoryNav" aria-label={uk?"Навігація сторінок":"Page navigation"}>
    <button type="button" onClick={()=>window.history.back()}>
      <ArrowLeft size={15}/>
      <span>{uk?"Назад":"Back"}</span>
    </button>
    <button type="button" onClick={()=>window.history.forward()}>
      <span>{uk?"Вперед":"Forward"}</span>
      <ArrowRight size={15}/>
    </button>
  </nav>;
}
