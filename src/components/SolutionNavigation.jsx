import {ArrowLeft,Home,PenLine,Plus} from "lucide-react";
import {useNavigate} from "react-router-dom";
import "../styles/solutionNavigation.css";

export default function SolutionNavigation({lang="uk"}){
  const navigate=useNavigate();
  const uk=lang!=="en";

  function goBack(){
    if(window.history.length>1)navigate(-1);
    else navigate("/");
  }

  function editQuery(){
    const input=document.querySelector(".simpleQueryForm input, .simpleQueryForm textarea");
    if(!input)return;
    input.scrollIntoView({behavior:"smooth",block:"center"});
    window.setTimeout(()=>{
      input.focus();
      if(typeof input.select==="function")input.select();
    },220);
  }

  return <nav className="solutionNavigation" aria-label={uk?"Навігація пошуку":"Search navigation"}>
    <div className="solutionNavigationInner">
      <button type="button" onClick={goBack}><ArrowLeft size={17}/><span>{uk?"Назад":"Back"}</span></button>
      <button type="button" onClick={()=>navigate("/")}><Home size={17}/><span>{uk?"Головна":"Home"}</span></button>
      <button type="button" className="solutionNavigationEdit" onClick={editQuery}><PenLine size={17}/><span>{uk?"Змінити запит":"Edit query"}</span></button>
      <button type="button" className="solutionNavigationNew" onClick={()=>navigate("/")}><Plus size={17}/><span>{uk?"Новий пошук":"New search"}</span></button>
    </div>
  </nav>;
}
