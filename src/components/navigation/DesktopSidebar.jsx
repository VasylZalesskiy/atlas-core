import {Bell,BookOpen,Home,LifeBuoy,MessageCircle,Search,Settings,ShieldAlert,UserRound,UsersRound} from "lucide-react";
import {NavLink} from "react-router-dom";

const items=[{key:"home",to:"/",Icon:Home},{key:"profile",to:"/passport",Icon:UserRound},{key:"myTasks",Icon:BookOpen},{key:"communities",Icon:UsersRound},{key:"announcements",Icon:MessageCircle},{key:"contacts",Icon:Search},{key:"messages",Icon:Bell},{key:"atlasSos",Icon:ShieldAlert},{key:"settings",Icon:Settings}];

export default function DesktopSidebar({t}){return <aside className="desktopSidebar" aria-label={t.mainNavigation}>{items.map(({key,to,Icon})=>to?<NavLink key={key} to={to} end={to==="/"} className={({isActive})=>isActive?"active":""}><Icon/>{t.nav[key]}</NavLink>:<button key={key} disabled title={t.foundationOnly}><Icon/>{t.nav[key]}<span>{t.soon}</span></button>)}<div className="sidebarMission"><LifeBuoy/><p>{t.principle}</p></div></aside>}
