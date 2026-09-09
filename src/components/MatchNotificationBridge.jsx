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
  const [dismissedToastId,setDismissedToastId]=useState(null);
  const previousUnread=useRef(0);
  const initialized=useRef(false);

  async function refresh({silent=false}={}){
    try{
      const rows=await loadMatchNotifications();
      const unread=rows.filter(item=>item.status==="unread");
      setItems(rows);
      await setAppBadge(unread.length);
      try{
        window.dispatchEvent(new CustomEvent("atlas:notifications",{detail:{unread:unread.length}}));
      }catch{}
      if(initialized.current&&!silent&&unread.length>previousUnread.current)playMatchSound();
      previousUnread.current=unread.length;
      initialized.current=true;
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
  const showToast=latest&&!showPanel&&latest.id!==dismissedToastId;

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
        setPushState(uk?"Готово: Atlas може показувати повідомлення навіть коли застосунок закритий.":"Done: Atlas can notify you even when the app is closed.");
      }else if(result.status==="denied")setPushState(uk?"Дозвіл на сповіщення вимкнений у налаштуваннях телефону.":"Notifications are blocked in phone settings.");
      else if(result.status==="unsupported")setPushState(uk?"На цьому пристрої push недоступний. На iPhone відкрийте Atlas з ярлика на головному екрані.":"Push is unavailable here. On iPhone, open Atlas from its Home Screen icon.");
      else setPushState(uk?"Сповіщення не були увімкнені.":"Notifications were not enabled.");
    }catch{setPushState(uk?"Не вдалося підключити сповіщення. Спробуйте ще раз.":"Could not enable notifications. Try again.")}finally{setPushBusy(false)}
  }

  async function openItem(item){
    try{await markMatchNotificationRead(item.id)}catch{}
    await refresh({silent:true});
    setShowPanel(false);
    setDismissedToastId(item.id);
    navigate(item.kind==="opportunity_matches_need"?"/requests":"/matches");
  }

  return <>
    <button className="atlasNotifyButton" onClick={()=>setShowPanel(value=>!value)} aria-label={uk?"Сповіщення Atlas":"Atlas notifications"}>
      <Bell size={19}/>{unread.length>0&&<span>{unread.length>99?"99+":unread.length}</span>}
    </button>
    {showToast&&<div className="atlasNotifyToast" role="status">
      <button className="atlasNotifyToastMain" onClick={()=>openItem(latest)}>
        <strong>{latest.title||(uk?"Atlas знайшов збіг":"Atlas found a match")}</strong>
        <small>{latest.body||(uk?"Є нове повідомлення":"You have a new notification")}</small>
      </button>
      <button className="atlasNotifyToastClose" onClick={()=>setDismissedToastId(latest.id)} aria-label={uk?"Закрити":"Close"}><X size={16}/></button>
    </div>}
    {showPanel&&<div className="atlasNotifyPanel">
      <div className="atlasNotifyTitleRow"><div><strong>{uk?"Сповіщення Atlas":"Atlas notifications"}</strong><small>{uk?"Керуйте повідомленнями та звуком":"Control alerts and sound"}</small></div><button className="atlasNotifyClose" onClick={()=>setShowPanel(false)}><X size={18}/></button></div>

      <div className="atlasNotifySetting">
        <div className="atlasNotifySettingText"><strong>{uk?"Сповіщення на телефоні":"Phone notifications"}</strong><small>{uk?"Показуються навіть коли Atlas закритий. На ярлику буде цифра з кількістю нових повідомлень.":"Shown even when Atlas is closed. The app icon shows the number of new alerts."}</small></div>
        {pushEnabled?<span className="atlasSettingStatus on">{uk?"Увімкнено":"On"}</span>:<button className="atlasSettingAction" onClick={enablePush} disabled={pushBusy}>{pushBusy?(uk?"Підключаю…":"Enabling…"):(uk?"Підключити":"Enable")}</button>}
      </div>

      <div className="atlasNotifySetting">
        <div className="atlasNotifySettingText"><strong>{uk?"Звук нової потреби":"New-need sound"}</strong><small>{uk?"Короткий сигнал, коли Atlas знаходить нову потребу або збіг для вашої можливості.":"A short sound when Atlas finds a new need or match for your opportunity."}</small></div>
        <button className={`atlasSoundToggle ${sound?"on":"off"}`} onClick={toggleSound}>{sound?<Volume2 size={17}/>:<VolumeX size={17}/>}<span>{sound?(uk?"Увімкнено":"On"):(uk?"Вимкнено":"Off")}</span></button>
      </div>

      {pushState&&<div className="atlasPushState">{pushState}</div>}
      <div className="atlasNotifyListTitle">{uk?`Нові повідомлення: ${unread.length}`:`New notifications: ${unread.length}`}</div>
      {unread.length===0?<p>{uk?"Нових сповіщень немає.":"No new notifications."}</p>:unread.slice(0,8).map(item=><button className="atlasNotifyItem" key={item.id} onClick={()=>openItem(item)}><b>{item.title||"Atlas"}</b><span>{item.body||""}</span></button>)}
    </div>}
  </>;
}
