import {Outlet} from "react-router-dom";
import Header from "../Header";
import DesktopSidebar from "../navigation/DesktopSidebar";
import MobileBottomNav from "../navigation/MobileBottomNav";
import {useLocale} from "../../i18n";

export default function AppShell(){const {t,lang,setLang}=useLocale();return <div className="appShell"><Header lang={lang} setLang={setLang} t={t}/><DesktopSidebar t={t}/><div className="appContent"><Outlet/><footer>Atlas 2.5 Foundation · {t.principle}</footer></div><MobileBottomNav t={t}/></div>}
