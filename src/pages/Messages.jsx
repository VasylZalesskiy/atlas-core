import {useCallback,useEffect,useMemo,useState} from "react";
import {ArrowLeft,Bell,CheckCircle2,Clock3,Home as HomeIcon,Inbox,MessageCircle,MessageCircleMore,MessagesSquare,PackageCheck,Phone,RefreshCw,Send,Sparkles,X} from "lucide-react";
import {Link,useSearchParams} from "react-router-dom";
import OnlinePresence from "../components/OnlinePresence";
import {
  cancelSolutionFlow,
  completeSolutionFlow,
  loadSolutionFlows,
  loadSolutionThread,
  markSolutionProvided,
  markSolutionThreadRead,
  respondToSolutionFlow,
  sendSolutionMessage
} from "../services/solutionFlowStore";
import "../styles/messages.css";
import "../styles/cleanHome.css";
import "../styles/cleanMessages.css";

const openStatuses=new Set(["pending","accepted","provided"]);

function cleanOpportunity(value){
  return String(value||"").replace(/[\u200B-\u200D\u2060\u2062\u2063\uFEFF]*ATLAS_META:[\s\S]*/u,"").trim();
}

function statusLabel(status,uk){
  const labels={
    pending:uk?"Очікує відповіді":"Awaiting reply",
    accepted:uk?"Домовляєтесь":"In progress",
    provided:uk?"Надано":"Provided",
    completed:uk?"Завершено":"Completed",
    declined:uk?"Відхилено":"Declined",
    cancelled:uk?"Скасовано":"Cancelled"
  };
  return labels[status]||status;
}

function flowSubject(flow,uk){
  if(flow?.subject)return flow.subject;
  const opportunity=cleanOpportunity(flow?.opportunity?.text);
  if(opportunity)return opportunity;
  if(flow?.need)return `${uk?"Потреба":"Need"}: ${flow.need.quantity||""} ${flow.need.unit||""} ${flow.need.item_key||""}`.trim();
  return uk?"Розмова в Atlas":"Atlas conversation";
}

function counterpartName(flow,uk){
  return flow?.counterpart?.display_name||flow?.requester_name||(uk?"Користувач Atlas":"Atlas user");
}

function formatStamp(value,uk){
  if(!value)return "";
  const date=new Date(value);
  const today=new Date();
  const sameDay=date.toDateString()===today.toDateString();
  return new Intl.DateTimeFormat(uk?"uk-UA":"en-GB",sameDay?{hour:"2-digit",minute:"2-digit"}:{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(date);
}

export default function Messages({lang="uk",setLang=()=>{},inboxUnread=0}){
  const uk=lang!=="en";
  const [searchParams,setSearchParams]=useSearchParams();
  const selectedFromUrl=searchParams.get("thread")||"";
  const [flows,setFlows]=useState([]);
  const [selectedId,setSelectedId]=useState(selectedFromUrl);
  const [thread,setThread]=useState(null);
  const [messages,setMessages]=useState([]);
  const [filter,setFilter]=useState("all");
  const [draft,setDraft]=useState("");
  const [loading,setLoading]=useState(true);
  const [threadLoading,setThreadLoading]=useState(false);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [noticeUnread,setNoticeUnread]=useState(0);

  useEffect(()=>{
    document.body.classList.add("clean-home-route");
    const onNotifications=event=>setNoticeUnread(Number(event?.detail?.unread)||0);
    window.addEventListener("atlas:notifications",onNotifications);
    return()=>{
      window.removeEventListener("atlas:notifications",onNotifications);
      document.body.classList.remove("clean-home-route");
    };
  },[]);

  const refreshFlows=useCallback(async({quiet=false}={})=>{
    if(!quiet)setLoading(true);
    try{
      const next=await loadSolutionFlows();
      setFlows(next||[]);
      try{window.dispatchEvent(new CustomEvent("atlas:inbox-changed",{detail:{unread:(next||[]).reduce((sum,item)=>sum+Number(item.unread_count||0),0)}}))}catch{}
    }catch(cause){if(!quiet)setError(String(cause?.message||cause||"inbox-failed"))}
    finally{if(!quiet)setLoading(false)}
  },[selectedId]);

  const openThread=useCallback(async(id,{quiet=false}={})=>{
    if(!id)return;
    if(!quiet)setThreadLoading(true);
    try{
      const data=await loadSolutionThread(id);
      setThread(data.flow||null);
      setMessages(data.messages||[]);
      await markSolutionThreadRead(id).catch(()=>{});
      setFlows(items=>items.map(item=>item.id===id?{...item,...data.flow,unread_count:0}:item));
      try{window.dispatchEvent(new CustomEvent("atlas:inbox-changed"))}catch{}
    }catch(cause){if(!quiet)setError(String(cause?.message||cause||"thread-failed"))}
    finally{if(!quiet)setThreadLoading(false)}
  },[]);

  useEffect(()=>{refreshFlows()},[refreshFlows]);
  useEffect(()=>{if(selectedId)openThread(selectedId)},[selectedId,openThread]);
  useEffect(()=>{
    if(selectedFromUrl&&selectedFromUrl!==selectedId)setSelectedId(selectedFromUrl);
  },[selectedFromUrl,selectedId]);
  useEffect(()=>{
    const timer=window.setInterval(()=>{
      if(document.visibilityState!=="visible")return;
      refreshFlows({quiet:true});
      if(selectedId)openThread(selectedId,{quiet:true});
    },8000);
    return()=>window.clearInterval(timer);
  },[refreshFlows,openThread,selectedId]);

  const filteredFlows=useMemo(()=>flows.filter(flow=>{
    if(filter==="unread")return Number(flow.unread_count)>0;
    if(filter==="active")return openStatuses.has(flow.status);
    if(filter==="closed")return !openStatuses.has(flow.status);
    return true;
  }),[flows,filter]);
  const unreadTotal=useMemo(()=>flows.reduce((sum,item)=>sum+Number(item.unread_count||0),0),[flows]);

  function selectFlow(id){
    setSelectedId(id);setError("");setNotice("");
    setSearchParams(current=>{const next=new URLSearchParams(current);next.set("thread",id);return next},{replace:true});
  }
  function closeThread(){
    setSelectedId("");setThread(null);setMessages([]);setError("");setNotice("");
    setSearchParams(current=>{const next=new URLSearchParams(current);next.delete("thread");return next},{replace:true});
  }

  async function sendMessage(event){
    event.preventDefault();
    const text=draft.trim();
    if(!text||!selectedId||busy)return;
    setBusy("message");setError("");setNotice("");
    try{
      await sendSolutionMessage(selectedId,text);
      setDraft("");
      await Promise.all([openThread(selectedId,{quiet:true}),refreshFlows({quiet:true})]);
    }catch(cause){setError(String(cause?.message||cause||"message-failed"))}
    finally{setBusy("")}
  }

  async function action(name){
    if(!thread?.id||busy)return;
    setBusy(name);setError("");setNotice("");
    try{
      if(name==="accept")await respondToSolutionFlow(thread.id,"accepted");
      if(name==="decline")await respondToSolutionFlow(thread.id,"declined");
      if(name==="provided")await markSolutionProvided(thread.id);
      if(name==="complete")await completeSolutionFlow(thread.id);
      if(name==="cancel")await cancelSolutionFlow(thread.id);
      const messagesByAction={accept:uk?"Домовленість прийнято.":"Agreement accepted.",decline:uk?"Звернення відхилено.":"Request declined.",provided:uk?"Позначено як надано.":"Marked as provided.",complete:uk?"Рішення завершено.":"Solution completed.",cancel:uk?"Розмову закрито.":"Conversation closed."};
      setNotice(messagesByAction[name]||"");
      await Promise.all([openThread(thread.id,{quiet:true}),refreshFlows({quiet:true})]);
    }catch(cause){setError(String(cause?.message||cause||"action-failed"))}
    finally{setBusy("")}
  }

  const canReply=thread&&openStatuses.has(thread.status);
  const needsResponse=thread?.status==="pending"&&!thread?.is_initiator;

  const shellUnread=Math.max(inboxUnread,noticeUnread);

  return <main className="cleanHomeShell cleanMessagesShell">
    <header className="cleanHomeTopbar">
      <Link className="cleanHomeBrand" to="/" aria-label={uk?"Головна":"Home"}>
        <span className="cleanHomeLogo">A</span>
        <span>ATLAS</span>
      </Link>
      <div className="cleanHomeTopActions">
        <div className="cleanHomeLanguage" aria-label={uk?"Мова":"Language"}>
          <button type="button" className={lang==="uk"?"active":""} onClick={()=>setLang("uk")}>UA</button>
          <span>/</span>
          <button type="button" className={lang==="en"?"active":""} onClick={()=>setLang("en")}>EN</button>
        </div>
        <OnlinePresence lang={lang} compact/>
        <button className="cleanHomeBell" type="button" onClick={()=>window.dispatchEvent(new CustomEvent("atlas:open-notifications"))} aria-label={uk?"Сповіщення Atlas":"Atlas notifications"}>
          <Bell size={17}/>
          {shellUnread>0&&<b>{shellUnread>9?"9+":shellUnread}</b>}
        </button>
      </div>
    </header>

    <section className="cleanMessagesBody">
      <div className="messagesHero">
      <div><span className="kicker">ATLAS · {uk?"ПОВІДОМЛЕННЯ":"MESSAGES"}</span><h1>{uk?"Мої розмови":"My conversations"}</h1><p>{uk?"Усі звернення щодо потреб і можливостей зібрані в одному місці.":"All conversations about needs and opportunities are organized in one place."}</p></div>
      <button type="button" onClick={()=>refreshFlows()} disabled={loading}><RefreshCw className={loading?"spin":""} size={18}/>{uk?"Оновити":"Refresh"}</button>
    </div>

    <div className="messagesFilters">
      {[
        ["all",uk?"Усі":"All",flows.length],
        ["unread",uk?"Нові":"Unread",unreadTotal],
        ["active",uk?"Активні":"Active",flows.filter(item=>openStatuses.has(item.status)).length],
        ["closed",uk?"Завершені":"Closed",flows.filter(item=>!openStatuses.has(item.status)).length]
      ].map(([value,label,count])=><button type="button" className={filter===value?"active":""} onClick={()=>setFilter(value)} key={value}>{label}<span>{count}</span></button>)}
    </div>

    {(error||notice)&&<div className={error?"messagesError":"messagesNotice"} role="status">{error||notice}</div>}

    <div className={`messagesWorkspace ${selectedId?"threadOpen":""}`}>
      <aside className="conversationList">
        {loading&&<div className="conversationEmpty"><RefreshCw className="spin" size={20}/>{uk?"Завантажую розмови…":"Loading conversations…"}</div>}
        {!loading&&filteredFlows.length===0&&<div className="conversationEmpty"><Inbox size={24}/><strong>{uk?"Тут поки порожньо":"Nothing here yet"}</strong><span>{uk?"Коли ви напишете людині або хтось звернеться до вас, розмова з’явиться тут.":"A conversation appears here when you contact someone or someone contacts you."}</span></div>}
        {filteredFlows.map(flow=><button type="button" className={`conversationCard ${selectedId===flow.id?"active":""}`} onClick={()=>selectFlow(flow.id)} key={flow.id}>
          <span className="conversationAvatar">{counterpartName(flow,uk).slice(0,1).toLocaleUpperCase(uk?"uk-UA":"en-GB")}</span>
          <span className="conversationCardCopy"><span><strong>{counterpartName(flow,uk)}</strong><time>{formatStamp(flow.last_message?.created_at||flow.last_message_at,uk)}</time></span><b>{flowSubject(flow,uk)}</b><small>{flow.last_message?.body||flow.message}</small><em className={`conversationStatus status-${flow.status}`}>{statusLabel(flow.status,uk)}</em></span>
          {Number(flow.unread_count)>0&&<span className="conversationUnread">{flow.unread_count>99?"99+":flow.unread_count}</span>}
        </button>)}
      </aside>

      <section className="conversationThread">
        {!selectedId&&<div className="threadBlank"><MessageCircle size={30}/><strong>{uk?"Оберіть розмову":"Choose a conversation"}</strong></div>}
        {selectedId&&threadLoading&&!thread&&<div className="threadBlank"><RefreshCw className="spin" size={22}/>{uk?"Відкриваю…":"Opening…"}</div>}
        {thread&&<>
          <header className="threadHeader"><button className="threadBack" type="button" onClick={closeThread} aria-label={uk?"Назад до розмов":"Back to conversations"}><ArrowLeft size={20}/></button><div><strong>{counterpartName(thread,uk)}</strong><span>{flowSubject(thread,uk)}</span></div><em className={`conversationStatus status-${thread.status}`}>{statusLabel(thread.status,uk)}</em></header>

          {needsResponse&&<div className="threadDecision"><div><Clock3 size={19}/><span><strong>{uk?"Людина чекає на вашу відповідь":"This person is waiting for your reply"}</strong><small>{uk?"Прийміть звернення, щоб підтвердити домовленість.":"Accept the request to confirm the agreement."}</small></span></div><div><button type="button" className="accept" disabled={Boolean(busy)} onClick={()=>action("accept")}><CheckCircle2 size={17}/>{uk?"Прийняти":"Accept"}</button><button type="button" disabled={Boolean(busy)} onClick={()=>action("decline")}><X size={17}/>{uk?"Відхилити":"Decline"}</button></div></div>}

          <div className="threadMessages">
            {messages.map(message=>{const mine=message.sender_side===thread.viewer_side;return <article className={mine?"mine":"theirs"} key={message.id}><p>{message.body}</p><time>{formatStamp(message.created_at,uk)}</time></article>})}
            {messages.length===0&&<div className="threadBlank">{uk?"Повідомлень ще немає.":"No messages yet."}</div>}
          </div>

          {(["accepted","provided"].includes(thread.status))&&<div className="threadProgressActions">
            {thread.chat_hash&&<Link to={`/chat${thread.chat_hash}`}><Phone size={16}/>{uk?"Чат і дзвінок":"Chat and call"}</Link>}
            {thread.status==="accepted"&&thread.viewer_side==="provider"&&<button type="button" disabled={Boolean(busy)} onClick={()=>action("provided")}><PackageCheck size={16}/>{uk?"Я надав / виконав":"I provided it"}</button>}
            {thread.viewer_side==="need_owner"&&<button type="button" disabled={Boolean(busy)} onClick={()=>action("complete")}><CheckCircle2 size={16}/>{uk?"Отримано · завершити":"Received · complete"}</button>}
            <button type="button" className="cancel" disabled={Boolean(busy)} onClick={()=>action("cancel")}>{uk?"Скасувати":"Cancel"}</button>
          </div>}

          {canReply?<form className="threadComposer" onSubmit={sendMessage}><textarea value={draft} onChange={event=>setDraft(event.target.value)} placeholder={uk?"Напишіть повідомлення…":"Write a message…"} maxLength={2000}/><button disabled={busy==="message"||!draft.trim()} aria-label={uk?"Надіслати повідомлення":"Send message"}><Send size={20}/><span>{uk?"Надіслати":"Send"}</span></button></form>:<div className="threadClosed">{uk?"Ця розмова завершена. Повідомлення збережені в історії.":"This conversation is closed. Messages remain in history."}</div>}
        </>}
      </section>
    </div>
    </section>

    <nav className="cleanHomeBottom" aria-label={uk?"Головна навігація":"Main navigation"}>
      <Link to="/"><HomeIcon size={19}/><span>{uk?"Головна":"Home"}</span></Link>
      <Link to="/profile"><Sparkles size={19}/><span>{uk?"Можливості":"Capabilities"}</span></Link>
      <Link className="active" to="/messages"><MessagesSquare size={19}/><span>{uk?"Повідомлення":"Messages"}</span>{inboxUnread>0&&<b>{inboxUnread>9?"9+":inboxUnread}</b>}</Link>
      <Link to="/chat"><MessageCircleMore size={19}/><span>{uk?"Кімнати":"Rooms"}</span></Link>
    </nav>
  </main>;
}
