import {useEffect,useState} from "react";
import {ShieldCheck,ShieldOff} from "lucide-react";

const STORAGE_KEY="atlas-chat-voice-privacy";
let installed=false;
let enabled=false;
let originalGetUserMedia=null;
const audioContexts=new Set();

function readEnabled(){
  try{return localStorage.getItem(STORAGE_KEY)==="on"}catch{return false}
}

function makeCurve(amount=32){
  const samples=1024;
  const curve=new Float32Array(samples);
  const deg=Math.PI/180;
  for(let i=0;i<samples;i+=1){
    const x=(i*2)/(samples-1)-1;
    curve[i]=((3+amount)*x*20*deg)/(Math.PI+amount*Math.abs(x));
  }
  return curve;
}

function protectAudioStream(stream){
  const audioTrack=stream.getAudioTracks()[0];
  if(!audioTrack)return stream;
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;
  if(!AudioContextClass)return stream;

  const context=new AudioContextClass();
  audioContexts.add(context);
  const source=context.createMediaStreamSource(new MediaStream([audioTrack]));
  const highpass=context.createBiquadFilter();
  highpass.type="highpass";
  highpass.frequency.value=115;
  const lowpass=context.createBiquadFilter();
  lowpass.type="lowpass";
  lowpass.frequency.value=3100;
  const shaper=context.createWaveShaper();
  shaper.curve=makeCurve(18);
  shaper.oversample="2x";
  const compressor=context.createDynamicsCompressor();
  compressor.threshold.value=-28;
  compressor.knee.value=18;
  compressor.ratio.value=5;
  compressor.attack.value=.006;
  compressor.release.value=.18;
  const destination=context.createMediaStreamDestination();
  source.connect(highpass).connect(lowpass).connect(shaper).connect(compressor).connect(destination);

  const processed=destination.stream.getAudioTracks()[0];
  const output=new MediaStream([processed,...stream.getVideoTracks()]);
  const stopOriginal=()=>{
    stream.getTracks().forEach(track=>track.stop());
    context.close().catch(()=>{});
    audioContexts.delete(context);
  };
  processed.addEventListener("ended",stopOriginal,{once:true});
  const nativeStop=processed.stop.bind(processed);
  processed.stop=()=>{nativeStop();stopOriginal()};
  context.resume().catch(()=>{});
  return output;
}

function installVoicePrivacy(){
  if(installed||!navigator.mediaDevices?.getUserMedia)return;
  installed=true;
  enabled=readEnabled();
  originalGetUserMedia=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia=async constraints=>{
    const stream=await originalGetUserMedia(constraints);
    const wantsAudio=Boolean(constraints?.audio);
    return enabled&&wantsAudio?protectAudioStream(stream):stream;
  };
}

export default function VoicePrivacyControl(){
  const [active,setActive]=useState(readEnabled);

  useEffect(()=>{
    installVoicePrivacy();
    enabled=active;
    try{localStorage.setItem(STORAGE_KEY,active?"on":"off")}catch{}
    return()=>{};
  },[active]);

  function toggle(){
    const next=!active;
    enabled=next;
    setActive(next);
  }

  return <div style={{position:"fixed",right:16,bottom:86,zIndex:60,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
    <button type="button" onClick={toggle} aria-pressed={active} title="Локально змінює тембр голосу перед передачею" style={{display:"inline-flex",alignItems:"center",gap:8,border:"1px solid rgba(15,23,42,.18)",borderRadius:999,padding:"10px 14px",fontWeight:800,background:active?"#0f172a":"#fff",color:active?"#fff":"#0f172a",boxShadow:"0 8px 24px rgba(15,23,42,.16)",cursor:"pointer"}}>
      {active?<ShieldCheck size={18}/>:<ShieldOff size={18}/>} {active?"Захист голосу: ON":"Захист голосу"}
    </button>
    {active&&<small style={{maxWidth:230,padding:"6px 9px",borderRadius:10,background:"rgba(15,23,42,.9)",color:"#fff",fontSize:11,lineHeight:1.25}}>Тембр змінюється локально до WebRTC. Новий дзвінок використовує захищений режим.</small>}
  </div>;
}
