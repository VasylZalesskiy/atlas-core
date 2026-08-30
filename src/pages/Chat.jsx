import {useCallback,useEffect,useRef,useState} from "react";
import {Copy,Headphones,LockKeyhole,LogOut,Mic,MicOff,Phone,PhoneIncoming,PhoneOff,RefreshCw,Send,Share2,ShieldCheck,Timer,Volume2} from "lucide-react";
import supabase from "../services/supabase";
import {createChatRoom,decryptChatPacket,encryptChatPacket,formatChatHash,importChatKey,isChatRoomExpired,parseChatHash,randomHex} from "../services/chatCrypto";

const rtcConfig={
  iceServers:[
    {urls:"stun:stun.cloudflare.com:3478"},
    {urls:"stun:stun.l.google.com:19302"}
  ],
  iceCandidatePoolSize:8
};

const timeNow=()=>new Intl.DateTimeFormat("uk-UA",{hour:"2-digit",minute:"2-digit"}).format(new Date());
const roomTimeLeft=milliseconds=>{
  const total=Math.max(0,Math.ceil(milliseconds/1000));
  const minutes=Math.floor(total/60);
  const seconds=String(total%60).padStart(2,"0");
  return `${minutes}:${seconds}`;
};

function waitForIce(peer){
  return new Promise(resolve=>{
    if(peer.iceGatheringState==="complete"){resolve();return}
    const timeout=window.setTimeout(done,7000);
    function done(){window.clearTimeout(timeout);peer.removeEventListener("icegatheringstatechange",onChange);resolve()}
    function onChange(){if(peer.iceGatheringState==="complete")done()}
    peer.addEventListener("icegatheringstatechange",onChange);
  });
}

export default function Chat(){
  const [roomId,setRoomId]=useState("");
  const [roomSecret,setRoomSecret]=useState("");
  const [roomExpiresAt,setRoomExpiresAt]=useState(0);
  const [remainingMs,setRemainingMs]=useState(0);
  const [roomExpired,setRoomExpired]=useState(false);
  const [roomClosed,setRoomClosed]=useState(false);
  const [participantCount,setParticipantCount]=useState(0);
  const [isOwner,setIsOwner]=useState(false);
  const [keyReady,setKeyReady]=useState(false);
  const [connection,setConnection]=useState("preparing");
  const [displayName,setDisplayName]=useState("");
  const [peerName,setPeerName]=useState("Товариш");
  const [peerOnline,setPeerOnline]=useState(false);
  const [messageText,setMessageText]=useState("");
  const [messages,setMessages]=useState([]);
  const [copied,setCopied]=useState(false);
  const [error,setError]=useState("");
  const [callState,setCallState]=useState("idle");
  const [incomingCall,setIncomingCall]=useState(null);
  const [callSoundReady,setCallSoundReady]=useState(false);
  const [muted,setMuted]=useState(false);
  const [audioOutputs,setAudioOutputs]=useState([]);
  const [audioOutputName,setAudioOutputName]=useState("Автоматично");
  const [audioNeedsResume,setAudioNeedsResume]=useState(false);
  const [reconnectKey,setReconnectKey]=useState(0);

  const deviceIdRef=useRef("");
  const nameRef=useRef("Учасник");
  const roomKeyRef=useRef(null);
  const channelRef=useRef(null);
  const packetHandlerRef=useRef(null);
  const seenMessageIdsRef=useRef(new Set());
  const lastPeerSeenRef=useRef(0);
  const audioPeerRef=useRef(null);
  const localAudioRef=useRef(null);
  const remoteAudioRef=useRef(null);
  const outgoingCallRef=useRef("");
  const incomingCallRef=useRef(null);
  const callStateRef=useRef("idle");
  const inviteRetryRef=useRef(null);
  const offerRetryRef=useRef(null);
  const callTimeoutRef=useRef(null);
  const ringTimerRef=useRef(null);
  const audioContextRef=useRef(null);
  const expiryHandledRef=useRef(false);
  const activeCallRef=useRef(null);
  const connectionRef=useRef("preparing");
  const recoveryPendingRef=useRef(false);
  const recoverCallRef=useRef(null);
  const hiddenAtRef=useRef(0);
  const wakeLockRef=useRef(null);
  const messagesEndRef=useRef(null);
  const composerRef=useRef(null);

  const changeCallState=useCallback(next=>{
    callStateRef.current=next;
    setCallState(next);
  },[]);

  const changeIncomingCall=useCallback(next=>{
    incomingCallRef.current=next;
    setIncomingCall(next);
  },[]);

  useEffect(()=>{connectionRef.current=connection},[connection]);

  const clearCallTimers=useCallback(()=>{
    window.clearInterval(inviteRetryRef.current);
    window.clearInterval(offerRetryRef.current);
    window.clearTimeout(callTimeoutRef.current);
    inviteRetryRef.current=null;
    offerRetryRef.current=null;
    callTimeoutRef.current=null;
  },[]);

  const stopCallTone=useCallback(()=>{
    window.clearInterval(ringTimerRef.current);
    ringTimerRef.current=null;
    navigator.vibrate?.(0);
  },[]);

  const soundPulse=useCallback(mode=>{
    const context=audioContextRef.current;
    if(!context||context.state!=="running")return false;
    const frequencies=mode==="incoming"?[740,880]:[420,500];
    frequencies.forEach((frequency,index)=>{
      const starts=context.currentTime+(index*.28);
      const oscillator=context.createOscillator();
      const gain=context.createGain();
      oscillator.type="sine";
      oscillator.frequency.value=frequency;
      gain.gain.setValueAtTime(.0001,starts);
      gain.gain.exponentialRampToValueAtTime(mode==="incoming"?.16:.07,starts+.025);
      gain.gain.exponentialRampToValueAtTime(.0001,starts+.22);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(starts);
      oscillator.stop(starts+.24);
    });
    return true;
  },[]);

  const startCallTone=useCallback(mode=>{
    stopCallTone();
    soundPulse(mode);
    ringTimerRef.current=window.setInterval(()=>soundPulse(mode),1700);
    if(mode==="incoming")navigator.vibrate?.([450,220,450,650,450,220,450]);
  },[soundPulse,stopCallTone]);

  const enableCallSound=useCallback(async({preview=true}={})=>{
    const AudioContextClass=window.AudioContext||window.webkitAudioContext;
    if(!AudioContextClass)throw new Error("audio-context-unavailable");
    const context=audioContextRef.current||new AudioContextClass();
    audioContextRef.current=context;
    if(context.state!=="running")await context.resume();
    const ready=context.state==="running";
    setCallSoundReady(ready);
    if(ready&&preview)soundPulse("outgoing");
    if(ready&&callStateRef.current==="incoming")startCallTone("incoming");
    return ready;
  },[soundPulse,startCallTone]);

  useEffect(()=>{
    let deviceId=sessionStorage.getItem("atlas-chat-device");
    if(!deviceId){deviceId=randomHex(16);sessionStorage.setItem("atlas-chat-device",deviceId)}
    deviceIdRef.current=deviceId;
    const savedName=localStorage.getItem("atlas-chat-name")||"";
    setDisplayName(savedName);

    const inviteHash=window.location.hash;
    const parsed=parseChatHash(inviteHash);
    if(inviteHash.startsWith("#chat-")&&(!parsed||isChatRoomExpired(parsed))){
      setRoomExpired(true);
      setConnection("expired");
      return;
    }
    const room=parsed||createChatRoom();
    if(!parsed){
      localStorage.setItem(`atlas-chat-owner:${room.roomId}`,deviceId);
      history.replaceState(null,"",`${window.location.pathname}${window.location.search}${formatChatHash(room)}`);
    }
    setRoomId(room.roomId);
    setRoomSecret(room.secret);
    setRoomExpiresAt(room.expiresAt);
    setRemainingMs(room.expiresAt-Date.now());
    setIsOwner(localStorage.getItem(`atlas-chat-owner:${room.roomId}`)===deviceId);
  },[]);

  useEffect(()=>{
    nameRef.current=displayName.trim()||"Учасник";
    if(displayName.trim())localStorage.setItem("atlas-chat-name",displayName.trim());
  },[displayName]);

  useEffect(()=>{
    if(!roomSecret)return;
    let cancelled=false;
    setKeyReady(false);
    importChatKey(roomSecret).then(key=>{
      if(cancelled)return;
      roomKeyRef.current=key;
      setKeyReady(true);
    }).catch(()=>setError("Не вдалося відкрити ключ кімнати."));
    return()=>{cancelled=true};
  },[roomSecret]);

  const closeAudio=useCallback(()=>{
    clearCallTimers();
    stopCallTone();
    audioPeerRef.current?.close();
    audioPeerRef.current=null;
    localAudioRef.current?.getTracks().forEach(track=>track.stop());
    localAudioRef.current=null;
    if(remoteAudioRef.current)remoteAudioRef.current.srcObject=null;
    if(navigator.audioSession)navigator.audioSession.type="auto";
    outgoingCallRef.current="";
    activeCallRef.current=null;
    changeIncomingCall(null);
    setMuted(false);
    setAudioNeedsResume(false);
    changeCallState("idle");
  },[changeCallState,changeIncomingCall,clearCallTimers,stopCallTone]);

  const resumeRemoteAudio=useCallback(async()=>{
    const audio=remoteAudioRef.current;
    if(!audio?.srcObject){setAudioNeedsResume(false);return true}
    try{
      await audio.play();
      setAudioNeedsResume(false);
      return true;
    }catch{
      setAudioNeedsResume(true);
      return false;
    }
  },[]);

  const sendPacket=useCallback(async packet=>{
    const channel=channelRef.current;
    const key=roomKeyRef.current;
    if(!channel||!key)throw new Error("chat-not-ready");
    const encrypted=await encryptChatPacket(key,packet);
    const result=await channel.send({
      type:"broadcast",
      event:"packet",
      payload:{id:randomHex(8),senderId:deviceIdRef.current,...encrypted}
    });
    if(result!=="ok")throw new Error(`chat-send-${result}`);
  },[]);

  const createAudioPeer=useCallback(()=>{
    audioPeerRef.current?.close();
    const peer=new RTCPeerConnection(rtcConfig);
    audioPeerRef.current=peer;
    peer.ontrack=event=>{
      if(!remoteAudioRef.current)return;
      remoteAudioRef.current.srcObject=event.streams[0];
      resumeRemoteAudio();
    };
    peer.onconnectionstatechange=()=>{
      if(peer.connectionState==="connected"){
        clearCallTimers();stopCallTone();changeCallState("connected");setError("");
      }
      if(peer.connectionState==="failed"){
        clearCallTimers();stopCallTone();changeCallState("failed");
        setError("Голос не з’єднався. На деяких мобільних мережах потрібен TURN-сервер.");
      }
      if(peer.connectionState==="closed")changeCallState("idle");
    };
    return peer;
  },[changeCallState,clearCallTimers,resumeRemoteAudio,stopCallTone]);

  const processPacket=useCallback(async packet=>{
    if(!packet||typeof packet.type!=="string")return;
    if(packet.type==="hello"){
      setPeerName(String(packet.name||"Товариш").slice(0,40));
      lastPeerSeenRef.current=Date.now();
      setPeerOnline(true);
      if(packet.reply)sendPacket({type:"hello",name:nameRef.current,reply:false}).catch(()=>{});
      return;
    }
    if(packet.type==="message"&&String(packet.text||"").trim()){
      if(seenMessageIdsRef.current.has(packet.id))return;
      seenMessageIdsRef.current.add(packet.id);
      lastPeerSeenRef.current=Date.now();setPeerOnline(true);
      setPeerName(String(packet.name||"Товариш").slice(0,40));
      setMessages(current=>[...current,{id:packet.id,author:"friend",name:packet.name||"Товариш",text:String(packet.text).slice(0,2000),time:packet.time||timeNow(),status:"delivered"}]);
      sendPacket({type:"ack",messageId:packet.id}).catch(()=>{});
      return;
    }
    if(packet.type==="ack"){
      setMessages(current=>current.map(message=>message.id===packet.messageId?{...message,status:"delivered"}:message));
      return;
    }
    if(packet.type==="room-leave"){
      setPeerOnline(false);
      setParticipantCount(count=>Math.max(1,count-1));
      setMessages(current=>[...current,{id:randomHex(8),author:"system",text:`${packet.name||"Співрозмовник"} вийшов із кімнати.`,time:timeNow()}]);
      return;
    }
    if(packet.type==="room-expired"){
      closeAudio();
      setMessages([]);setPeerOnline(false);setParticipantCount(0);
      setConnection("expired");setRoomExpired(true);
      return;
    }
    if(packet.type==="call-invite"){
      const current=incomingCallRef.current;
      const active=activeCallRef.current;
      const canReceive=callStateRef.current==="idle"||callStateRef.current==="failed"||current?.sessionId===packet.sessionId||active?.sessionId===packet.sessionId;
      if(!canReceive){
        sendPacket({type:"call-busy",sessionId:packet.sessionId}).catch(()=>{});
        return;
      }
      lastPeerSeenRef.current=Date.now();setPeerOnline(true);
      setPeerName(String(packet.name||"Товариш").slice(0,40));
      if(current?.sessionId!==packet.sessionId){
        activeCallRef.current={sessionId:packet.sessionId,direction:"incoming",name:packet.name||"Товариш"};
        changeIncomingCall({sessionId:packet.sessionId,name:packet.name||"Товариш",description:null});
        changeCallState("incoming");
        startCallTone("incoming");
        window.clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current=window.setTimeout(()=>{
          if(incomingCallRef.current?.sessionId!==packet.sessionId)return;
          closeAudio();changeCallState("failed");setError("Пропущений голосовий дзвінок.");
        },35000);
      }
      sendPacket({type:"call-ringing",sessionId:packet.sessionId}).catch(()=>{});
      return;
    }
    if(packet.type==="call-ringing"&&packet.sessionId===outgoingCallRef.current){
      window.clearInterval(inviteRetryRef.current);inviteRetryRef.current=null;
      if(callStateRef.current!=="connected"&&callStateRef.current!=="connecting")changeCallState("ringing");
      startCallTone("outgoing");
      return;
    }
    if(packet.type==="rtc-offer"){
      const current=incomingCallRef.current;
      const active=activeCallRef.current;
      const reconnecting=Boolean(packet.reconnect&&active?.sessionId===packet.sessionId);
      const canReceive=callStateRef.current==="idle"||callStateRef.current==="failed"||current?.sessionId===packet.sessionId||reconnecting;
      if(!canReceive)return;
      lastPeerSeenRef.current=Date.now();setPeerOnline(true);
      setPeerName(String(packet.name||"Товариш").slice(0,40));
      if(reconnecting){
        try{
          stopCallTone();changeCallState("connecting");
          const stream=await getMicrophone();
          const peer=createAudioPeer();
          await peer.setRemoteDescription(packet.description);
          stream.getTracks().forEach(track=>peer.addTrack(track,stream));
          await peer.setLocalDescription(await peer.createAnswer());
          await waitForIce(peer);
          if(!peer.localDescription)throw new Error("answer-missing");
          await sendPacket({type:"rtc-answer",sessionId:packet.sessionId,description:peer.localDescription.toJSON(),reconnect:true});
          changeIncomingCall(null);
        }catch{
          changeCallState("failed");
          setError("Не вдалося відновити звук після сну телефона. Натисніть «Відновити звук».");
        }
        return;
      }
      changeIncomingCall({...current,...packet,name:packet.name||current?.name||"Товариш"});
      if(callStateRef.current==="idle"||callStateRef.current==="failed"){
        changeCallState("incoming");startCallTone("incoming");
      }
      sendPacket({type:"rtc-offer-received",sessionId:packet.sessionId}).catch(()=>{});
      return;
    }
    if(packet.type==="rtc-offer-received"&&packet.sessionId===outgoingCallRef.current){
      window.clearInterval(offerRetryRef.current);offerRetryRef.current=null;
      return;
    }
    if(packet.type==="call-accepted"&&packet.sessionId===outgoingCallRef.current){
      stopCallTone();changeCallState("connecting");
      return;
    }
    if(packet.type==="rtc-answer"&&packet.sessionId===outgoingCallRef.current){
      clearCallTimers();stopCallTone();changeCallState("connecting");
      const peer=audioPeerRef.current;
      if(peer&&!peer.remoteDescription)await peer.setRemoteDescription(packet.description);
      return;
    }
    if(packet.type==="call-reconnect-request"&&packet.sessionId===activeCallRef.current?.sessionId){
      recoverCallRef.current?.({force:true});
      return;
    }
    if(packet.type==="call-busy"&&packet.sessionId===outgoingCallRef.current){
      closeAudio();changeCallState("failed");setError("Співрозмовник зараз розмовляє.");return;
    }
    if(packet.type==="call-declined"&&(!packet.sessionId||packet.sessionId===outgoingCallRef.current)){
      closeAudio();setError("Співрозмовник відхилив дзвінок.");return;
    }
    if(packet.type==="call-end"){
      const activeSession=activeCallRef.current?.sessionId||outgoingCallRef.current||incomingCallRef.current?.sessionId;
      if(!packet.sessionId||packet.sessionId===activeSession)closeAudio();
    }
  },[changeCallState,changeIncomingCall,clearCallTimers,closeAudio,sendPacket,startCallTone,stopCallTone]);

  packetHandlerRef.current=processPacket;

  useEffect(()=>{
    if(!roomId||!keyReady)return;
    if(!supabase){setConnection("failed");setError("Чат не налаштовано на сервері.");return}

    let heartbeat;
    const channel=supabase.channel(`atlas-chat:${roomId}`,{
      config:{
        broadcast:{ack:true,self:false},
        presence:{key:deviceIdRef.current}
      }
    });
    channelRef.current=channel;
    setConnection("connecting");
    channel.on("presence",{event:"sync"},()=>{
      const count=Object.values(channel.presenceState()).flat().length;
      setParticipantCount(count);
      setPeerOnline(count>1);
    }).on("presence",{event:"leave"},()=>{
      window.setTimeout(()=>{
        const count=Object.values(channel.presenceState()).flat().length;
        setParticipantCount(count);
        setPeerOnline(count>1);
      },0);
    }).on("broadcast",{event:"packet"},async event=>{
      const envelope=event?.payload;
      if(!envelope||envelope.senderId===deviceIdRef.current)return;
      try{
        const packet=await decryptChatPacket(roomKeyRef.current,envelope);
        await packetHandlerRef.current?.(packet);
      }catch{/* Інший ключ не може прочитати пакет кімнати. */}
    }).subscribe((status,channelError)=>{
      if(status==="SUBSCRIBED"){
        setConnection("ready");setError("");
        channel.track({deviceId:deviceIdRef.current,name:nameRef.current,joinedAt:new Date().toISOString()}).catch(()=>{});
        sendPacket({type:"hello",name:nameRef.current,reply:true}).catch(()=>{});
        heartbeat=window.setInterval(()=>sendPacket({type:"hello",name:nameRef.current,reply:false}).catch(()=>{}),12000);
        if(recoveryPendingRef.current){
          recoveryPendingRef.current=false;
          window.setTimeout(()=>recoverCallRef.current?.(),0);
        }
      }else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED"){
        setConnection("failed");
        if(channelError)setError("З’єднання чату перервано. Спробуйте ще раз.");
      }
    });

    return()=>{
      window.clearInterval(heartbeat);
      channel.untrack().catch(()=>{});
      if(channelRef.current===channel)channelRef.current=null;
      setParticipantCount(0);
      supabase.removeChannel(channel);
    };
  },[keyReady,reconnectKey,roomId,sendPacket]);

  useEffect(()=>{
    if(!roomExpiresAt||roomExpired)return;
    expiryHandledRef.current=false;
    const update=()=>{
      const left=roomExpiresAt-Date.now();
      setRemainingMs(Math.max(0,left));
      if(left>0||expiryHandledRef.current)return;
      expiryHandledRef.current=true;
      sendPacket({type:"room-expired"}).catch(()=>{});
      closeAudio();
      channelRef.current?.untrack().catch(()=>{});
      if(channelRef.current&&supabase)supabase.removeChannel(channelRef.current);
      channelRef.current=null;
      roomKeyRef.current=null;
      setKeyReady(false);
      setMessages([]);
      setPeerOnline(false);
      setParticipantCount(0);
      setConnection("expired");
      setRoomExpired(true);
    };
    update();
    const timer=window.setInterval(update,1000);
    return()=>window.clearInterval(timer);
  },[closeAudio,roomExpired,roomExpiresAt,sendPacket]);

  useEffect(()=>()=>{
    closeAudio();
    audioContextRef.current?.close().catch(()=>{});
  },[closeAudio]);

  async function sendMessage(event){
    event.preventDefault();
    const text=messageText.trim();
    if(!text||connection!=="ready"||!keyReady)return;
    const message={id:randomHex(8),author:"me",text:text.slice(0,2000),time:timeNow(),status:"sending"};
    seenMessageIdsRef.current.add(message.id);
    setMessages(current=>[...current,message]);setMessageText("");setError("");
    try{
      await sendPacket({type:"message",id:message.id,name:nameRef.current,text:message.text,time:message.time});
      setMessages(current=>current.map(item=>item.id===message.id?{...item,status:peerOnline?"sent":"waiting"}:item));
    }catch{
      setMessages(current=>current.map(item=>item.id===message.id?{...item,status:"failed"}:item));
      setError("Повідомлення не відправлено. Перевірте мережу.");
    }
  }

  function inviteUrl(){return `${window.location.origin}/chat${formatChatHash({roomId,secret:roomSecret,expiresAt:roomExpiresAt})}`}

  async function copyInvite(){
    try{await navigator.clipboard.writeText(inviteUrl());setCopied(true);window.setTimeout(()=>setCopied(false),1800)}
    catch{setError("Не вдалося скопіювати. Скористайтеся кнопкою «Поділитися».")}
  }

  async function shareInvite(){
    if(navigator.share){
      try{await navigator.share({title:`Atlas Chat · ${roomId}`,text:"Приєднуйся до моєї приватної кімнати Atlas",url:inviteUrl()});return}catch{return}
    }
    await copyInvite();
  }

  async function getMicrophone(){
    if(!navigator.mediaDevices?.getUserMedia)throw new Error("microphone-unavailable");
    const current=localAudioRef.current;
    if(current?.getAudioTracks().some(track=>track.readyState==="live"))return current;
    if(navigator.audioSession)navigator.audioSession.type="play-and-record";
    const stream=await navigator.mediaDevices.getUserMedia({video:false,audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
    localAudioRef.current=stream;
    refreshAudioOutputs().catch(()=>{});
    return stream;
  }

  async function refreshAudioOutputs(){
    if(!navigator.mediaDevices?.enumerateDevices)return [];
    const devices=await navigator.mediaDevices.enumerateDevices();
    const outputs=devices.filter(device=>device.kind==="audiooutput");
    setAudioOutputs(outputs);
    return outputs;
  }

  async function chooseAudioOutput(){
    const audio=remoteAudioRef.current;
    if(!audio?.setSinkId){
      setError("Цей браузер сам керує розмовним і гучним динаміком.");
      return;
    }
    try{
      let selected;
      if(navigator.mediaDevices?.selectAudioOutput){
        selected=await navigator.mediaDevices.selectAudioOutput();
      }else{
        const outputs=audioOutputs.length?audioOutputs:await refreshAudioOutputs();
        if(!outputs.length)throw new Error("no-audio-output");
        const currentIndex=outputs.findIndex(device=>device.deviceId===audio.sinkId);
        selected=outputs[(currentIndex+1)%outputs.length];
      }
      await audio.setSinkId(selected.deviceId);
      setAudioOutputName(selected.label||"Вибраний пристрій");
      setError("");
    }catch(error){
      if(error?.name!=="NotAllowedError")setError("Не вдалося змінити аудіовихід на цьому телефоні.");
    }
  }

  async function startCall(){
    if(!peerOnline)return;
    const sessionId=randomHex(16);
    const invitePacket={type:"call-invite",sessionId,name:nameRef.current,createdAt:Date.now()};
    try{
      setError("");outgoingCallRef.current=sessionId;activeCallRef.current={sessionId,direction:"outgoing",name:peerName};changeCallState("calling");
      enableCallSound({preview:false}).catch(()=>{});
      await sendPacket(invitePacket);
      inviteRetryRef.current=window.setInterval(()=>sendPacket(invitePacket).catch(()=>{}),1400);
      callTimeoutRef.current=window.setTimeout(()=>{
        if(outgoingCallRef.current!==sessionId||callStateRef.current==="connected")return;
        sendPacket({type:"call-end",sessionId}).catch(()=>{});
        closeAudio();changeCallState("failed");setError("Товариш не відповів на дзвінок.");
      },35000);

      const stream=await getMicrophone();
      const peer=createAudioPeer();
      stream.getTracks().forEach(track=>peer.addTrack(track,stream));
      await peer.setLocalDescription(await peer.createOffer());
      await waitForIce(peer);
      if(!peer.localDescription)throw new Error("offer-missing");
      const offerPacket={type:"rtc-offer",sessionId,name:nameRef.current,description:peer.localDescription.toJSON()};
      await sendPacket(offerPacket);
      offerRetryRef.current=window.setInterval(()=>sendPacket(offerPacket).catch(()=>{}),1800);
    }catch{
      sendPacket({type:"call-end",sessionId}).catch(()=>{});
      closeAudio();changeCallState("failed");setError("Не вдалося відкрити мікрофон або почати дзвінок.");
    }
  }

  async function acceptCall(){
    const call=incomingCallRef.current;
    if(!call?.description)return;
    try{
      setError("");stopCallTone();window.clearTimeout(callTimeoutRef.current);callTimeoutRef.current=null;
      activeCallRef.current={sessionId:call.sessionId,direction:"incoming",name:call.name||peerName};
      changeCallState("connecting");
      await sendPacket({type:"call-accepted",sessionId:call.sessionId});
      const stream=await getMicrophone();
      const peer=createAudioPeer();
      await peer.setRemoteDescription(call.description);
      stream.getTracks().forEach(track=>peer.addTrack(track,stream));
      await peer.setLocalDescription(await peer.createAnswer());
      await waitForIce(peer);
      if(!peer.localDescription)throw new Error("answer-missing");
      await sendPacket({type:"rtc-answer",sessionId:call.sessionId,description:peer.localDescription.toJSON()});
      changeIncomingCall(null);
    }catch{
      sendPacket({type:"call-end",sessionId:call.sessionId}).catch(()=>{});
      closeAudio();changeCallState("failed");setError("Не вдалося прийняти дзвінок.");
    }
  }

  function declineCall(){
    const sessionId=incomingCallRef.current?.sessionId;
    sendPacket({type:"call-declined",sessionId}).catch(()=>{});closeAudio();
  }
  function endCall(){
    const sessionId=activeCallRef.current?.sessionId||outgoingCallRef.current||incomingCallRef.current?.sessionId;
    sendPacket({type:"call-end",sessionId}).catch(()=>{});closeAudio();
  }
  function toggleMute(){
    const next=!muted;
    localAudioRef.current?.getAudioTracks().forEach(track=>{track.enabled=!next});
    setMuted(next);
  }

  async function activateCallSound(){
    try{
      const ready=await enableCallSound();
      if(!ready)throw new Error("sound-blocked");
      setError("");
    }catch{
      setError("Браузер не дозволив звук. Перевірте беззвучний режим і дозвіл відтворення аудіо.");
    }
  }

  async function restoreConversationSound(){
    try{
      await enableCallSound({preview:false}).catch(()=>false);
      const restored=await resumeRemoteAudio();
      if(!restored)throw new Error("audio-play-blocked");
      setError("");
    }catch{
      setAudioNeedsResume(true);
      setError("Торкніться «Відновити звук» ще раз і перевірте гучність телефона.");
    }
  }

  async function recoverActiveCall({force=false}={}){
    const active=activeCallRef.current;
    if(!active||callStateRef.current==="idle")return resumeRemoteAudio();
    const peer=audioPeerRef.current;
    if(!force&&peer?.connectionState==="connected")return resumeRemoteAudio();
    if(active.direction==="incoming"){
      changeCallState("connecting");
      await sendPacket({type:"call-reconnect-request",sessionId:active.sessionId}).catch(()=>{});
      return;
    }
    try{
      changeCallState("connecting");setError("");
      const stream=await getMicrophone();
      const nextPeer=createAudioPeer();
      stream.getTracks().forEach(track=>nextPeer.addTrack(track,stream));
      await nextPeer.setLocalDescription(await nextPeer.createOffer({iceRestart:true}));
      await waitForIce(nextPeer);
      if(!nextPeer.localDescription)throw new Error("offer-missing");
      await sendPacket({type:"rtc-offer",sessionId:active.sessionId,name:nameRef.current,description:nextPeer.localDescription.toJSON(),reconnect:true});
    }catch{
      changeCallState("failed");
      setError("Звук не відновився автоматично. Натисніть «Відновити звук».");
      setAudioNeedsResume(true);
    }
  }

  recoverCallRef.current=recoverActiveCall;

  useEffect(()=>{
    if(!roomId||roomExpired||roomClosed)return;
    const recoverPage=({forceChannel=false}={})=>{
      if(document.visibilityState==="hidden")return;
      const sleptFor=hiddenAtRef.current?Date.now()-hiddenAtRef.current:0;
      hiddenAtRef.current=0;
      audioContextRef.current?.resume().catch(()=>{});
      resumeRemoteAudio();
      if(forceChannel||sleptFor>1500||connectionRef.current!=="ready"||!channelRef.current){
        recoveryPendingRef.current=true;
        setConnection("connecting");
        setReconnectKey(value=>value+1);
      }else{
        recoverCallRef.current?.();
      }
    };
    const onVisibility=()=>{
      if(document.visibilityState==="hidden"){hiddenAtRef.current=Date.now();return}
      recoverPage();
    };
    const onPageShow=event=>{if(event.persisted)recoverPage({forceChannel:true})};
    const onOnline=()=>recoverPage({forceChannel:true});
    document.addEventListener("visibilitychange",onVisibility);
    window.addEventListener("pageshow",onPageShow);
    window.addEventListener("online",onOnline);
    return()=>{
      document.removeEventListener("visibilitychange",onVisibility);
      window.removeEventListener("pageshow",onPageShow);
      window.removeEventListener("online",onOnline);
    };
  },[roomClosed,roomExpired,roomId,resumeRemoteAudio]);

  useEffect(()=>{
    if(callState!=="connected"||!navigator.wakeLock?.request)return;
    let cancelled=false;
    const acquire=async()=>{
      if(cancelled||document.visibilityState!=="visible"||wakeLockRef.current)return;
      try{
        const lock=await navigator.wakeLock.request("screen");
        if(cancelled){await lock.release();return}
        wakeLockRef.current=lock;
        lock.addEventListener("release",()=>{if(wakeLockRef.current===lock)wakeLockRef.current=null},{once:true});
      }catch{/* Телефон може не підтримувати блокування сну. */}
    };
    const onVisibility=()=>{if(document.visibilityState==="visible")acquire()};
    acquire();
    document.addEventListener("visibilitychange",onVisibility);
    return()=>{
      cancelled=true;
      document.removeEventListener("visibilitychange",onVisibility);
      const lock=wakeLockRef.current;wakeLockRef.current=null;
      lock?.release().catch(()=>{});
    };
  },[callState]);

  useEffect(()=>{messagesEndRef.current?.scrollIntoView({block:"end"})},[messages.length]);

  useEffect(()=>{
    const composer=composerRef.current;
    if(!composer)return;
    composer.style.height="auto";
    composer.style.height=`${Math.min(composer.scrollHeight,112)}px`;
  },[messageText]);

  function onComposerKeyDown(event){
    if(event.key!=="Enter"||event.shiftKey||event.nativeEvent?.isComposing)return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  function createNewRoom(){
    endCall();
    const room=createChatRoom();
    localStorage.setItem(`atlas-chat-owner:${room.roomId}`,deviceIdRef.current);
    history.replaceState(null,"",`${window.location.pathname}${window.location.search}${formatChatHash(room)}`);
    seenMessageIdsRef.current.clear();lastPeerSeenRef.current=0;
    expiryHandledRef.current=false;
    setRoomId(room.roomId);setRoomSecret(room.secret);setRoomExpiresAt(room.expiresAt);setRemainingMs(room.expiresAt-Date.now());setIsOwner(true);
    setMessages([]);setPeerName("Товариш");setPeerOnline(false);setParticipantCount(0);setRoomExpired(false);setRoomClosed(false);setConnection("preparing");setError("");
  }

  async function leaveRoom(){
    const channel=channelRef.current;
    try{await sendPacket({type:"room-leave",name:nameRef.current})}catch{/* Кімната могла вже закритися. */}
    try{await channel?.untrack()}catch{/* Presence закриється разом із каналом. */}
    if(channel&&supabase)await supabase.removeChannel(channel);
    if(channelRef.current===channel)channelRef.current=null;
    closeAudio();
    roomKeyRef.current=null;
    setKeyReady(false);setMessages([]);setPeerOnline(false);setParticipantCount(0);
    setConnection("closed");setRoomClosed(true);
    history.replaceState(null,"",`${window.location.pathname}${window.location.search}`);
  }

  const connectionText=connection==="ready"
    ?peerOnline?`У кімнаті: ${peerName}`:(isOwner?"Кімната готова · очікуємо товариша":"Кімната готова · товариш не в мережі")
    :connection==="expired"?"Час кімнати завершився":connection==="closed"?"Ви вийшли з кімнати":connection==="failed"?"З’єднання перервано":connection==="connecting"?"З’єднуємо…":"Готуємо кімнату…";

  if(roomExpired||roomClosed)return <main className="page appPage"><section className="profileShell chatPage">
    <div className="closedRoomCard">
      <div className="closedRoomIcon"><LockKeyhole size={34}/></div>
      <span>ATLAS CHAT</span>
      <h1>{roomExpired?"Час кімнати завершився":"Кімнату закрито"}</h1>
      <p>{roomExpired?"Приватне посилання працює не більше однієї години. Повідомлення та ключ кімнати видалені з цього пристрою.":"Ви вийшли з приватної кімнати. Повідомлення та ключ більше недоступні."}</p>
      <button className="primary" type="button" onClick={createNewRoom}>Створити нову кімнату</button>
    </div>
  </section></main>;

  return <main className="page appPage"><section className="profileShell chatPage">
    <header className="messengerTop">
      <div className="messengerIdentity">
        <div className={`messengerAvatar ${peerOnline?"online":""}`}>{peerName.slice(0,1).toUpperCase()}</div>
        <div><strong>{peerOnline?peerName:"Приватна кімната"}</strong><span>{connectionText}</span><small>{roomId||"Створюємо…"} · {participantCount}/2</small></div>
      </div>
      <div className="messengerRoomActions">
        <div className="roomTimer" title="Час до закриття кімнати"><Timer size={16}/><strong>{roomTimeLeft(remainingMs)}</strong></div>
        <button type="button" className="leaveRoomButton" onClick={leaveRoom} title="Вийти із кімнати"><LogOut size={19}/><span>Вийти</span></button>
      </div>
    </header>

    <div className="securityStrip compact"><ShieldCheck size={21}/><div><strong>Наскрізно зашифровано</strong><span>Кімната і посилання автоматично закриються через 1 годину.</span></div></div>

    <label className="chatName"><span>Ваше ім’я</span><input maxLength={40} value={displayName} onChange={event=>setDisplayName(event.target.value)} placeholder="Наприклад: Василь"/></label>

    <div className="chatInviteActions">
      <button className="primary" type="button" onClick={shareInvite}><Share2 size={18}/>Поділитися</button>
      <button className="secondary" type="button" onClick={copyInvite}><Copy size={18}/>{copied?"Скопійовано ✓":"Копіювати"}</button>
      {connection==="failed"&&<button className="secondary" type="button" onClick={()=>setReconnectKey(value=>value+1)}><RefreshCw size={17}/>Повторити</button>}
    </div>

    <section className="callPanel">
      {callState==="incoming"?<><div><strong>Вхідний дзвінок від {peerName}</strong><span>{incomingCall?.description?"Можна відповідати.":"Готуємо захищене аудіоз’єднання…"}</span></div><div>{!callSoundReady&&<button className="secondary" type="button" onClick={activateCallSound}><Volume2 size={17}/>Увімкнути звук</button>}</div></>
      :callState==="connected"?<><div><strong>Голосовий дзвінок триває</strong><span>Аудіовихід: {audioOutputName}</span></div><div>{audioNeedsResume&&<button className="secondary audioResumeButton" type="button" onClick={restoreConversationSound}><Volume2 size={17}/>Відновити звук</button>}<button className="secondary" type="button" onClick={chooseAudioOutput}><Headphones size={17}/>Аудіовихід</button><button className="secondary" type="button" onClick={toggleMute}>{muted?<><Mic size={17}/>Увімкнути</>:<><MicOff size={17}/>Вимкнути</>}</button><button className="dangerButton" type="button" onClick={endCall}><PhoneOff size={17}/>Завершити</button></div></>
      :callState==="calling"||callState==="ringing"||callState==="connecting"?<><div><strong>{callState==="ringing"?`${peerName} бачить виклик…`:callState==="calling"?`Надсилаємо виклик ${peerName}…`:"З’єднуємо голос…"}</strong><span>{callState==="ringing"?"Очікуємо відповіді.":"Зачекайте кілька секунд."}</span></div><button className="dangerButton" type="button" onClick={endCall}><PhoneOff size={17}/>Скасувати</button></>
      :<><div><strong>Голосовий дзвінок</strong><span>{peerOnline?`${peerName} у кімнаті`:`Зателефонувати можна, коли товариш онлайн`}</span></div><div>{!callSoundReady&&<button className="secondary soundReadyButton" type="button" onClick={activateCallSound}><Volume2 size={17}/>Звук викликів</button>}<button className="secondary" type="button" disabled={!peerOnline||connection!=="ready"} onClick={startCall}><Phone size={17}/>Подзвонити</button></div></>}
      <audio ref={remoteAudioRef} autoPlay playsInline/>
    </section>

    {callState==="incoming"&&<div className="incomingCallOverlay" role="dialog" aria-modal="true" aria-label={`Вхідний дзвінок від ${peerName}`}>
      <div className="incomingCallCard">
        <div className="incomingCallPulse"><PhoneIncoming size={38}/></div>
        <span>Вхідний голосовий дзвінок</span>
        <h2>{peerName}</h2>
        <p>Кімната <strong>{roomId}</strong></p>
        {!callSoundReady&&<button className="soundUnlock" type="button" onClick={activateCallSound}><Volume2 size={18}/>Увімкнути сигнал виклику</button>}
        <div className="incomingCallActions">
          <button className="dangerButton" type="button" onClick={declineCall}><PhoneOff size={19}/>Відхилити</button>
          <button className="primary" type="button" disabled={!incomingCall?.description} onClick={acceptCall}><Phone size={19}/>{incomingCall?.description?"Прийняти":"Готуємо…"}</button>
        </div>
        <small>Мікрофон увімкнеться тільки після вашої згоди.</small>
      </div>
    </div>}

    {error&&<div className="chatError">{error}</div>}

    <section className="chatWindow">
      <div className="messages" aria-live="polite">
        {messages.length===0&&<div className="chatEmpty"><LockKeyhole size={30}/><strong>{connection==="ready"?"Можна писати":"Готуємо захищений канал"}</strong><span>Повідомлення доставляються наживо, коли обидва учасники онлайн.</span></div>}
        {messages.map(message=><div className={`chatMessage ${message.author==="me"?"mine":message.author==="system"?"system":""}`} key={message.id}>{message.author==="friend"&&<b>{message.name}</b>}<p>{message.text}</p><span>{message.time}{message.author==="me"&&` · ${message.status==="delivered"?"доставлено":message.status==="failed"?"помилка":message.status==="waiting"?"товариш офлайн":"надіслано"}`}</span></div>)}
        <div ref={messagesEndRef}/>
      </div>
      <div className="messageComposer">
        <div className="emojiRow"><span>Швидка реакція</span>{["🙂","👍","❤️","😂","🙏"].map(emoji=><button type="button" aria-label={`Додати ${emoji}`} key={emoji} onClick={()=>setMessageText(value=>value+emoji)}>{emoji}</button>)}</div>
        <form className="messageForm" onSubmit={sendMessage}>
          <label className="messageInputShell"><span>Повідомлення</span><textarea ref={composerRef} rows={1} maxLength={2000} disabled={connection!=="ready"||!keyReady} value={messageText} onKeyDown={onComposerKeyDown} onChange={event=>setMessageText(event.target.value)} placeholder={connection==="ready"?"Напишіть повідомлення…":"Готуємо захищений канал…"}/></label>
          <button className="messageSend" aria-label="Надіслати повідомлення" disabled={!messageText.trim()||connection!=="ready"||!keyReady}><Send size={20}/><span>Надіслати</span></button>
        </form>
        <small className="messageComposerHint">Enter — надіслати · Shift + Enter — новий рядок</small>
      </div>
    </section>

    <button className="newRoomButton" type="button" onClick={createNewRoom}>Створити іншу кімнату</button>
  </section></main>;
}
