import {useEffect,useRef,useState} from "react";
import {Bell,Volume2,VolumeX,X} from "lucide-react";
import {useNavigate} from "react-router-dom";
import {askNotificationPermission,enablePushNotifications,getSoundEnabled,loadMatchNotifications,markMatchNotificationRead,playMatchSound,pushPreferenceEnabled,setAppBadge,setSoundEnabled} from "../services/matchNotificationStore";
import "../styles/notifications.css";

export default function MatchNotificationBridge({lang="uk"}){
  const uk=lang!=="en";
  const navigate=useNavigate();
  const [items,setItems]=useState([]);
  const [sound,setSound]=useState(()=>getSoundEnabled());
  const [pushEnabled,setPushEnabled]=useState(()=>pushPreferenceEnabled());
  const [pushBusy,setPushBusy]=useState(false);
  const [pushState,setPushState]=useState("");
  const [showPanel,setShowPanel]=useState(false);
  const previousUnread=useRef(0);

  async function refresh({silent=false}={}){
    try{
      const rows=await loadMatchNotifications();
      const unread=rows.filter(item=>item.status==="unread");
      setItems(rows);
      await setAppBadge(unread.length);
      if(!silent&&unread.length>previousUnread.current&&previousUnread.current!==0)playMatchSound();
      previousUnread.current=unread.length;
    }catch{}
  }

  useEffect(()=>{
    let alive=true;
    refresh({silent:true});
    const timer=setInterval(()=>{if(alive)refresh()},15000);
    const onVisible=()=>{if(document.visibilityState==="visible")refresh()};
    document.addEventListener("visibilitychange",onVisible);
    return()=>{alive=false;clearInterval(timer);document.removeEventListener("visibilitychange",onVisible)};
  },[]);

  const unread=items.filter(item=>item.status==="unread");
  const latest=unread[0]||null;

  async function toggleSound(){
    const next=!sound;
    setSound(next);setSoundEnabled(next);
    if(next){await askNotificationPermission();playMatchSound()}
  }

  async function enablePush(){
    if(pushBusy)return;
    setPushBusy(true);setPushState("");
    try{
      const result=await enablePushNotifications();
      if(result.status==="granted"){
        setPushEnabled(true);
        setPushState(uk?"Сповіщення на телефоні увімкнено.":"Phone notifications are enabled.");
      }else if(result.status==="denied")setPushState(uk?"Дозвіл на сповіщення вимкнений у налаштуваннях телефону.":"Notifications are blocked in phone settings.");
      else if(result.status==="unsupported")setPushState(uk?"На цьому пристрої push недоступний. На iPhone відкрийте Atlas з ярлика на головному екрані.":"Push is unavailable here. On iPhone, open Atlas from its Home Screen icon.");
      else setPushState(uk?"Сповіщення не були увімкнені.":"Notifications were not enabled.");
    }catch{setPushState(uk?"Не вдалося підключити push. Спробуйте ще раз.":"Could not enable push. Try again.")}finally{setPushBusy(false)}
  }

  async function openItem(item){
    try{await markMatchNotificationRead(item.id)}catch{}
    await refresh({silent:true});
    setShowPanel(false);
    navigate(item.kind==="opportunity_matches_need"?"/requests":"/matches");
  }

  return <>
    <button className="atlasNotifyButton" onClick={()=>setShowPanel(value=>!value)} aria-label={uk?"Сповіщення Atlas":"Atlas notifications"}>
      <Bell size={19}/>{unread.length>0&&<span>{unread.length>99?"99+":unread.length}</span>}
    </button>
    {latest&&!showPanel&&<div className="atlasNotifyToast" role="status">
      <button className="atlasNotifyToastMain" onClick={()=>openItem(latest)}>
        <strong>{latest.title||(uk?"Atlas знайшов збіг":"Atlas found a match")}</strong>
        <small>{latest.body||(uk?"Є нове повідомлення":"You have a new notification")}</small>
      </button>
      <button className="atlasNotifyToastClose" onClick={()=>setShowPanel(false)} aria-label={uk?"Закрити":"Close"}><X size={16}/></button>
    </div>}
    {showPanel&&<div className="atlasNotifyPanel">
      <div className="atlasNotifyPanelHead"><strong>{uk?"Сповіщення":"Notifications"}</strong><button onClick={toggleSound}>{sound?<Volume2 size={18}/>:<VolumeX size={18}/>}<span>{sound?(uk?"Звук увімкнено":"Sound on"):(uk?"Звук вимкнено":"Sound off")}</span></button></div>
      {!pushEnabled&&<button className="atlasPushEnable" onClick={enablePush} disabled={pushBusy}>{pushBusy?(uk?"Підключаю…":"Enabling…"):(uk?"Увімкнути сповіщення на телефоні":"Enable phone notifications")}</button>}
      {pushEnabled&&<div className="atlasPushState">✓ {uk?"Push і цифра на ярлику підключені":"Push and app-icon badge enabled"}</div>}
      {pushState&&<div className="atlasPushState">{pushState}</div>}
      {unread.length===0?<p>{uk?"Нових сповіщень немає.":"No new notifications."}</p>:unread.slice(0,8).map(item=><button className="atlasNotifyItem" key={item.id} onClick={()=>openItem(item)}><b>{item.title||"Atlas"}</b><span>{item.body||""}</span></button>)}
    </div>}
  </>;
}
