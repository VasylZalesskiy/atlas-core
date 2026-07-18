import {Link} from "react-router-dom";
import {Globe2} from "lucide-react";

export default function Header({lang,setLang,t}){return <header><Link className="brand" to="/"><b>A</b><span>ATLAS</span></Link><nav className="headerNav"><Link to="/">{t.home}</Link><Link to="/" state={{focusQuery:true}}>{t.findSolution}</Link><Link to="/profile">{t.profile}</Link></nav><div className="actions"><button className="lang" onClick={()=>setLang(lang==="uk"?"en":"uk")}><Globe2 size={17}/>{lang==="uk"?"UA":"EN"}</button></div></header>}
