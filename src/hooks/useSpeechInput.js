import {useEffect,useRef,useState} from "react";

function recognitionConstructor(){
  if(typeof window==="undefined")return null;
  return window.SpeechRecognition||window.webkitSpeechRecognition||null;
}

export default function useSpeechInput({lang="uk",onResult}){
  const recognitionRef=useRef(null);
  const restartTimerRef=useRef(null);
  const keepListeningRef=useRef(false);
  const onResultRef=useRef(onResult);
  const [listening,setListening]=useState(false);
  const [error,setError]=useState("");
  const supported=Boolean(recognitionConstructor());

  useEffect(()=>{onResultRef.current=onResult},[onResult]);
  useEffect(()=>()=>{
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

  function scheduleRestart(recognition){
    if(!keepListeningRef.current)return;
    if(restartTimerRef.current)window.clearTimeout(restartTimerRef.current);
    restartTimerRef.current=window.setTimeout(()=>{
      if(!keepListeningRef.current)return;
      try{recognition.start()}catch{}
    },180);
  }

  function start(){
    const Recognition=recognitionConstructor();
    if(!Recognition){
      setError(lang==="uk"?"У цьому браузері використайте мікрофон на клавіатурі.":"Use the microphone on your keyboard in this browser.");
      return;
    }

    if(restartTimerRef.current)window.clearTimeout(restartTimerRef.current);
    keepListeningRef.current=true;
    recognitionRef.current?.abort();

    const recognition=new Recognition();
    recognition.lang=lang==="uk"?"uk-UA":"en-US";
    recognition.continuous=true;
    recognition.interimResults=true;
    recognition.maxAlternatives=1;

    recognition.onstart=()=>{
      setListening(true);
      setError("");
    };

    recognition.onresult=event=>{
      let finalText="";
      let interimText="";
      for(let i=event.resultIndex;i<event.results.length;i+=1){
        const text=String(event.results[i]?.[0]?.transcript||"").trim();
        if(!text)continue;
        if(event.results[i].isFinal)finalText=[finalText,text].filter(Boolean).join(" ");
        else interimText=[interimText,text].filter(Boolean).join(" ");
      }
      if(finalText||interimText)onResultRef.current?.({finalText,interimText});
    };

    recognition.onerror=event=>{
      if(event.error==="aborted")return;
      if(event.error==="no-speech"){
        if(keepListeningRef.current)setError(lang==="uk"?"Слухаю… говоріть ближче до мікрофона.":"Listening… speak closer to the microphone.");
        return;
      }
      keepListeningRef.current=false;
      setListening(false);
      setError(errorText(event.error));
    };

    recognition.onend=()=>{
      if(keepListeningRef.current){
        setListening(true);
        scheduleRestart(recognition);
      }else{
        setListening(false);
      }
    };

    recognitionRef.current=recognition;
    try{recognition.start()}catch{
      keepListeningRef.current=false;
      setListening(false);
    }
  }

  function stop(){
    keepListeningRef.current=false;
    if(restartTimerRef.current)window.clearTimeout(restartTimerRef.current);
    recognitionRef.current?.stop();
    setListening(false);
  }

  return {supported,listening,error,start,stop};
}
