import {useEffect,useRef,useState} from "react";
import {Users,X} from "lucide-react";
import {joinAtlasPresence,presenceUsers} from "../services/onlinePresence";

function pageLabel(path,uk){
  if(path.startsWith("/chat"))return uk?"Чат":"Chat";
  if(path.startsWith("/needs"))return uk?"Потреби":"Needs";
  if(path.startsWith("/profile"))return uk?"Можливості":"Opportunities";
  if(path.startsWith("/solution"))return uk?"Рішення":"Solution";
  return uk?"Головна":"Home";
}

export default function OnlinePresence({lang="uk",compact=false}){
  const uk=lang!=="en";
  const [users,setUsers]=useState([]);
  const [open,setOpen]=useState(false);
  const channelRef=useRef(null);

  useEffect(()=>{
    let alive=true;
    let channel=null;
    joinAtlasPresence({page:window.location.pathname}).then(({channel:next,me})=>{
      if(!alive)return;
      channel=next;channelRef.current=next;
      const sync=()=>{if(alive)setUsers(presenceUsers(next))};
      next.on("presence",{event:"sync"},sync).on("presence",{event:"join"},sync).on("presence",{event:"leave"},sync).subscribe(async status=>{
        if(status!=="SUBSCRIBED")return;
        await next.track(me);
        sync();
      });
    }).catch(()=>{});
    return()=>{alive=false;if(channel){channel.untrack().catch(()=>{});channel.unsubscribe().catch(()=>{})}}
  },[]);

  return <div className={`atlasPresence ${compact?"compact":""}`}>
    <button type="button" className="atlasPresenceButton" onClick={()=>setOpen(v=>!v)} aria-expanded={open}>
      <span className="atlasPresenceDot"/><Users size={compact?15:17}/><b>{users.length}</b><span>{uk?"онлайн":"online"}</span>
    </button>
    {open&&<div className="atlasPresencePopup">
      <div className="atlasPresenceTitle"><strong>{uk?"Зараз в Atlas":"Online in Atlas"}</strong><button type="button" onClick={()=>setOpen(false)}><X size={17}/></button></div>
      {users.length?users.slice(0,12).map(user=><div className="atlasPresenceUser" key={user.userId}><span className="atlasPresenceDot"/><div><b>{user.displayName}</b><small>{pageLabel(user.page,uk)}</small></div></div>):<p>{uk?"Поки нікого немає онлайн.":"No one is online yet."}</p>}
      {users.length>12&&<small className="atlasPresenceMore">+{users.length-12}</small>}
    </div>}
  </div>;
}
