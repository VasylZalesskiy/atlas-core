import {Link} from "react-router-dom";
import {Globe2} from "lucide-react";

export default function Header({lang,setLang}){return <header><Link className="brand" to="/"><b>A</b><span>ATLAS</span></Link><div className="actions"><button className="lang" onClick={()=>setLang(lang==="uk"?"en":"uk")}><Globe2 size={17}/>{lang==="uk"?"UA":"EN"}</button></div></header>}
