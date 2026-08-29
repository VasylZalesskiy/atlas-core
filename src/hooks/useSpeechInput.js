import {useEffect,useRef,useState} from "react";

function recognitionConstructor(){
  if(typeof window==="undefined")return null;
  return window.SpeechRecognition||window.webkitSpeechRecognition||null;
}

function isMobileBrowser(){
  if(typeof navigator==="undefined")return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||"")
    || Boolean(window.matchMedia?.("(pointer: coarse)").matches);
}

export default function useSpeechInput({lang="uk",onResult}){
  const recognitionRef=useRef(null);
  const restartTimerRef=useRef(null);
  const keepListeningRef=useRef(false);
  const heardSpeechRef=useRef(false);
  const failedRef=useRef(false);
  const stoppedByUserRef=useRef(false);
  const sessionRef=useRef(0);
  const onResultRef=useRef(onResult);
  const [listening,setListening]=useState(false);
  const [phase,setPhase]=useState("idle");
  const [error,setError]=useState("");
  const supported=Boolean(recognitionConstructor());
  const mobileSafe=typeof window!=="undefined"&&isMobileBrowser();

  useEffect(()=>{onResultRef.current=onResult},[onResult]);
  useEffect(()=>()=>{
    sessionRef.current+=1;
    keepListeningRef.current=false;
    if(restartTimerRef.current)window.clearTimeout(restartTimerRef.current);
    recognitionRef.current?.abort();
  },[]);

  function errorText(code){
    if(code==="not-allowed"||code==="service-not-allowed")return lang==="uk"?"Дозвольте Atlas доступ до мікрофона.":"Allow Atlas to use the microphone.";
    if(code==="audio-capture")return lang==="uk"?"Мікрофон недоступний. Перевірте доступ до нього.":"The microphone is unavailable. Check microphone access.";
    if(code==="network")return lang==="uk"?"Немає зв’язку із сервісом розпізнавання голосу.":"Voice recognition service is unavailable.";
    return lang==="uk"?"Не вдалося розпізнати голос. Спробуйте ще раз.":"Voice recognition failed. Please try again.";
  }

  function scheduleRestart(recognition,session){
    if(mobileSafe||!keepListeningRef.current)return;
    if(restartTimerRef.current)window.clearTimeout(restartTimerRef.current);
    restartTimerRef.current=window.setTimeout(()=>{
      if(!keepListeningRef.current||session!==sessionRef.current)return;
      setPhase("starting");
      try{recognition.start()}catch{
        keepListeningRef.current=false;
        setListening(false);
        setPhase("idle");
      }
    },450);
  }

  function start(){
    const Recognition=recognitionConstructor();
    if(!Recognition){
      setError(lang==="uk"?"У цьому браузері використайте мікрофон на клавіатурі.":"Use the microphone on your keyboard in this browser.");
      return false;
    }

    if(restartTimerRef.current)window.clearTimeout(restartTimerRef.current);
    sessionRef.current+=1;
    const session=sessionRef.current;
    keepListeningRef.current=true;
    heardSpeechRef.current=false;
    failedRef.current=false;
    stoppedByUserRef.current=false;
    recognitionRef.current?.abort();
    setError("");
    setPhase("starting");

    const recognition=new Recognition();
    recognition.lang=lang==="uk"?"uk-UA":"en-US";
    // Mobile Safari/older mobile browsers can freeze when continuous recognition
    // is combined with rapid automatic restarts. Use a single safe session there.
    recognition.continuous=!mobileSafe;
    // Interim text gives immediate visual confirmation that the phone can hear
    // the user. It is supported by current Chrome and Safari speech engines.
    recognition.interimResults=true;
    recognition.maxAlternatives=1;

    recognition.onstart=()=>{
      if(session!==sessionRef.current)return;
      setListening(true);
      setPhase("listening");
      setError("");
    };

    recognition.onaudiostart=()=>{
      if(session===sessionRef.current)setPhase("listening");
    };

    recognition.onspeechstart=()=>{
      if(session===sessionRef.current)setPhase("hearing");
    };

    recognition.onresult=event=>{
      if(session!==sessionRef.current)return;
      let finalText="";
      let interimText="";
      for(let i=event.resultIndex;i<event.results.length;i+=1){
        const text=String(event.results[i]?.[0]?.transcript||"").trim();
        if(!text)continue;
        if(event.results[i].isFinal)finalText=[finalText,text].filter(Boolean).join(" ");
        else interimText=[interimText,text].filter(Boolean).join(" ");
      }
      if(finalText||interimText){
        heardSpeechRef.current=true;
        setPhase(finalText?"processing":"hearing");
        onResultRef.current?.({finalText,interimText});
      }
    };

    recognition.onerror=event=>{
      if(session!==sessionRef.current)return;
      if(event.error==="aborted")return;
      failedRef.current=true;
      if(event.error==="no-speech"){
        if(keepListeningRef.current)setError(lang==="uk"?"Не почув голос. Натисніть мікрофон і скажіть фразу ще раз.":"No speech detected. Tap the microphone and try again.");
        keepListeningRef.current=false;
        setListening(false);
        setPhase("idle");
        return;
      }
      keepListeningRef.current=false;
      setListening(false);
      setPhase("idle");
      setError(errorText(event.error));
    };

    recognition.onend=()=>{
      if(session!==sessionRef.current)return;
      if(mobileSafe){
        keepListeningRef.current=false;
        setListening(false);
        setPhase("idle");
        if(!heardSpeechRef.current&&!failedRef.current&&!stoppedByUserRef.current){
          setError(lang==="uk"?"Не почув голос. Натисніть мікрофон і скажіть фразу ще раз.":"No speech detected. Tap the microphone and try again.");
        }
        return;
      }
      if(keepListeningRef.current){
        setListening(true);
        setPhase("starting");
        scheduleRestart(recognition,session);
      }else{
        setListening(false);
        setPhase("idle");
      }
    };

    recognitionRef.current=recognition;
    try{
      recognition.start();
      return true;
    }catch{
      keepListeningRef.current=false;
      setListening(false);
      setPhase("idle");
      setError(lang==="uk"?"Не вдалося запустити мікрофон. Спробуйте ще раз.":"Could not start the microphone. Please try again.");
      return false;
    }
  }

  function stop(){
    stoppedByUserRef.current=true;
    keepListeningRef.current=false;
    if(restartTimerRef.current)window.clearTimeout(restartTimerRef.current);
    recognitionRef.current?.stop();
    setListening(false);
    setPhase("processing");
  }

  return {supported,listening,starting:phase==="starting",phase,error,start,stop,mobileSafe};
}
