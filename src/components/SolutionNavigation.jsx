import {ArrowLeft,HeartHandshake,Home,IdCard,MessageCircleMore,PenLine,Plus,Sparkles} from "lucide-react";
import {NavLink,useNavigate} from "react-router-dom";
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

  const links=[
    {to:"/needs",label:uk?"Потреби":"Needs",icon:HeartHandshake},
    {to:"/matches",label:uk?"Збіги":"Matches",icon:Sparkles},
    {to:"/profile",label:uk?"Можливості":"Opportunities",icon:IdCard},
    {to:"/chat",label:uk?"Чат":"Chat",icon:MessageCircleMore}
  ];

  return <nav className="solutionNavigation" aria-label={uk?"Навігація Atlas":"Atlas navigation"}>
    <div className="solutionNavigationInner">
      <div className="solutionNavigationSearchGroup">
        <button type="button" onClick={goBack}><ArrowLeft size={17}/><span>{uk?"Назад":"Back"}</span></button>
        <button type="button" onClick={()=>navigate("/")}><Home size={17}/><span>{uk?"Головна":"Home"}</span></button>
        <button type="button" className="solutionNavigationEdit" onClick={editQuery}><PenLine size={17}/><span>{uk?"Змінити запит":"Edit query"}</span></button>
        <button type="button" className="solutionNavigationNew" onClick={()=>navigate("/")}><Plus size={17}/><span>{uk?"Новий пошук":"New search"}</span></button>
      </div>
      <div className="solutionNavigationMainGroup">
        {links.map(item=>{
          const Icon=item.icon;
          return <NavLink key={item.to} to={item.to}><Icon size={17}/><span>{item.label}</span></NavLink>;
        })}
      </div>
    </div>
  </nav>;
}
