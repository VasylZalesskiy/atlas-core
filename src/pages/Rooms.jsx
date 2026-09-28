import {useEffect,useMemo,useState} from "react";
import {Clock3,DoorOpen,Link2,MessageCircleMore,Plus,Trash2} from "lucide-react";
import {createChatRoom,formatChatHash} from "../services/chatCrypto";
import "../styles/pilotRedesign.css";

const STORAGE="atlas.permanent-rooms.v1";
const TEN_YEARS=10*365*24*60*60*1000;

function readRooms(){try{const v=JSON.parse(localStorage.getItem(STORAGE)||"[]");return Array.isArray(v)?v:[]}catch{return []}}
function saveRooms(items){localStorage.setItem(STORAGE,JSON.stringify(items));window.dispatchEvent(new Event("atlas:rooms-changed"))}

export default function Rooms({lang="uk"}){
  const uk=lang!=="en";
  const [rooms,setRooms]=useState(()=>readRooms());

  useEffect(()=>{const refresh=()=>setRooms(readRooms());window.addEventListener("atlas:rooms-changed",refresh);return()=>window.removeEventListener("atlas:rooms-changed",refresh)},[]);

  const sorted=useMemo(()=>rooms.slice().sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)),[rooms]);

  function openTemporary(){window.location.assign("/chat")}

  function createPermanent(){
    const room=createChatRoom(Date.now(),TEN_YEARS);
    const name=prompt(uk?"Назва кімнати":"Room name",uk?"Переговори":"Negotiation")?.trim()||(uk?"Переговори":"Negotiation");
    const href=`/chat?permanent=1${formatChatHash(room)}`;
    const next=[{id:room.roomId,name,href,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()},...readRooms().filter(item=>item.id!==room.roomId)];
    saveRooms(next);
    window.location.assign(href);
  }

  function remove(id){saveRooms(readRooms().filter(item=>item.id!==id))}

  async function copy(href){try{await navigator.clipboard.writeText(new URL(href,window.location.origin).href)}catch{}}

  return <main className="pilotPage pilotRooms">
    <header className="pilotPageHead"><div><MessageCircleMore size={23}/><h1>{uk?"Кімнати переговорів":"Negotiation rooms"}</h1></div><p>{uk?"Постійні кімнати зберігаються. Тимчасова кімната живе 1 годину й не потрапляє в список.":"Permanent rooms are saved. A temporary room lives for 1 hour and is not saved."}</p></header>

    <section className="pilotRoomActions">
      <button className="pilotPrimary" type="button" onClick={createPermanent}><Plus size={19}/>{uk?"Створити кімнату":"Create room"}</button>
      <button className="pilotTempRoom" type="button" onClick={openTemporary}><Clock3 size={19}/><span><strong>{uk?"Тимчасова кімната":"Temporary room"}</strong><small>{uk?"Автоматично зникне через 1 годину":"Automatically disappears after 1 hour"}</small></span></button>
    </section>

    <section className="pilotRoomsList">
      <h2>{uk?"Мої кімнати":"My rooms"}</h2>
      {!sorted.length&&<div className="pilotEmpty"><strong>{uk?"Постійних кімнат ще немає":"No permanent rooms yet"}</strong><span>{uk?"Створіть кімнату для переговорів, до якої можна повернутися.":"Create a negotiation room you can return to."}</span></div>}
      {sorted.map(room=><article key={room.id}>
        <button className="pilotRoomOpen" type="button" onClick={()=>window.location.assign(room.href)}><DoorOpen size={20}/><span><strong>{room.name}</strong><small>{room.id}</small></span></button>
        <button type="button" onClick={()=>copy(room.href)} title={uk?"Копіювати посилання":"Copy link"}><Link2 size={17}/></button>
        <button type="button" onClick={()=>remove(room.id)} title={uk?"Видалити":"Delete"}><Trash2 size={17}/></button>
      </article>)}
    </section>
  </main>;
}