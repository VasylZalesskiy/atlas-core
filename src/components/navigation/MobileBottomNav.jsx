import {Home,PlusCircle,Search,UserRound,UsersRound} from "lucide-react";
import {NavLink} from "react-router-dom";

export default function MobileBottomNav({t}){return <nav className="mobileBottomNav" aria-label={t.mobileNavigation}><NavLink to="/"><Home/><span>{t.nav.home}</span></NavLink><NavLink to="/" state={{focusQuery:true}}><Search/><span>{t.search}</span></NavLink><button disabled title={t.foundationOnly}><PlusCircle/><span>{t.createTask}</span></button><button disabled title={t.foundationOnly}><UsersRound/><span>{t.nav.communities}</span></button><NavLink to="/passport"><UserRound/><span>{t.passportShort}</span></NavLink></nav>}
