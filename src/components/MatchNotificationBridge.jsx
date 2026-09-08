import {useEffect,useRef,useState} from "react";
import {Bell,Volume2,VolumeX,X} from "lucide-react";
import {useNavigate} from "react-router-dom";
import {askNotificationPermission,getSoundEnabled,loadMatchNotifications,markMatchNotificationRead,playMatchSound,setAppBadge,setSoundEnabled} from "../services/matchNotificationStore";

export default function MatchNotificationBridge({lang="uk"}){
  const uk=lang!=="en";
  const navigate=useNavigate();
  const [items,setItems]=useState([]);
  const [sound,setSound]=useState(()=>getSoundEnabled());
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
        <strong>{latest.title|| (uk?"Atlas знайшов збіг":"Atlas found a match")}</strong>
        <small>{latest.body|| (uk?"Є нове повідомлення":"You have a new notification")}</small>
      </button>
      <button className="atlasNotifyToastClose" onClick={()=>setShowPanel(false)} aria-label={uk?"Закрити":"Close"}><X size={16}/></button>
    </div>}
    {showPanel&&<div className="atlasNotifyPanel">
      <div className="atlasNotifyPanelHead"><strong>{uk?"Сповіщення":"Notifications"}</strong><button onClick={toggleSound}>{sound?<Volume2 size={18}/>:<VolumeX size={18}/>}<span>{sound?(uk?"Звук увімкнено":"Sound on"):(uk?"Звук вимкнено":"Sound off")}</span></button></div>
      {unread.length===0?<p>{uk?"Нових сповіщень немає.":"No new notifications."}</p>:unread.slice(0,8).map(item=><button className="atlasNotifyItem" key={item.id} onClick={()=>openItem(item)}><b>{item.title||"Atlas"}</b><span>{item.body||""}</span></button>)}
    </div>}
  </>;
}
