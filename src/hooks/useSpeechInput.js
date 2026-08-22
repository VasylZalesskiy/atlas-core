import {useEffect,useRef,useState} from "react";

function recognitionConstructor(){
  if(typeof window==="undefined")return null;
  return window.SpeechRecognition||window.webkitSpeechRecognition||null;
}

export default function useSpeechInput({lang="uk",onTranscript}){
  const recognitionRef=useRef(null);
  const onTranscriptRef=useRef(onTranscript);
  const [listening,setListening]=useState(false);
  const [error,setError]=useState("");
  const supported=Boolean(recognitionConstructor());

  useEffect(()=>{onTranscriptRef.current=onTranscript},[onTranscript]);
  useEffect(()=>()=>recognitionRef.current?.abort(),[]);

  function start(){
    const Recognition=recognitionConstructor();
    if(!Recognition){
      setError(lang==="uk"?"У цьому браузері використайте мікрофон на клавіатурі.":"Use the microphone on your keyboard in this browser.");
      return;
    }
    recognitionRef.current?.abort();
    const recognition=new Recognition();
    recognition.lang=lang==="uk"?"uk-UA":"en-US";
    recognition.continuous=false;
    recognition.interimResults=false;
    recognition.maxAlternatives=1;
    recognition.onstart=()=>{setListening(true);setError("")};
    recognition.onresult=event=>{
      const transcript=String(event.results?.[0]?.[0]?.transcript||"").trim();
      if(transcript)onTranscriptRef.current?.(transcript);
    };
    recognition.onerror=event=>{
      if(event.error==="aborted")return;
      setError(event.error==="not-allowed"
        ?(lang==="uk"?"Дозвольте Atlas доступ до мікрофона.":"Allow Atlas to use the microphone.")
        :(lang==="uk"?"Не вдалося розпізнати голос. Спробуйте ще раз.":"Voice recognition failed. Please try again."));
    };
    recognition.onend=()=>setListening(false);
    recognitionRef.current=recognition;
    try{recognition.start()}catch{setListening(false)}
  }

  function stop(){recognitionRef.current?.stop()}

  return {supported,listening,error,start,stop};
}
