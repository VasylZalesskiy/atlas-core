import {useRef} from "react";
import {Mic,MicOff,X} from "lucide-react";
import useSpeechInput from "../hooks/useSpeechInput";

function joinParts(...parts){
  return parts.map(part=>String(part||"").trim()).filter(Boolean).join(" ").replace(/\s+/g," ").trim();
}

export default function VoiceTaskInput({value,onChange,lang="uk",placeholder,className="",autoFocus=false,multiline=true}){
  const baseRef=useRef("");
  const committedRef=useRef("");

  const speech=useSpeechInput({
    lang,
    onResult:({finalText,interimText})=>{
      if(finalText)committedRef.current=joinParts(committedRef.current,finalText);
      onChange(joinParts(baseRef.current,committedRef.current,interimText));
    }
  });

  const Input=multiline?"textarea":"input";
  const label=speech.listening
    ?(lang==="uk"?"Зупинити голосовий ввід":"Stop voice input")
    :(lang==="uk"?"Говорити":"Speak");

  function startVoice(){
    baseRef.current=value.trim();
    committedRef.current="";
    speech.start();
  }

  function stopVoice(){
    speech.stop();
  }

  function clearValue(){
    if(speech.listening)speech.stop();
    baseRef.current="";
    committedRef.current="";
    onChange("");
  }

  function manualChange(event){
    if(speech.listening)speech.stop();
    onChange(event.target.value);
  }

  const status=speech.listening
    ?(lang==="uk"?"● Слухаю — говоріть. Текст з’являється одразу.":"● Listening — speak now. Text appears live.")
    :(speech.supported
      ?(lang==="uk"?"Натисніть мікрофон і говоріть":"Tap the microphone and speak")
      :(lang==="uk"?"Використайте мікрофон на клавіатурі":"Use the microphone on your keyboard"));

  return <div className={`voiceTaskInput ${className}`.trim()}>
    <Input
      autoFocus={autoFocus}
      required
      value={value}
      onChange={manualChange}
      placeholder={placeholder}
      aria-label={lang==="uk"?"Опишіть вашу задачу":"Describe your task"}
      style={{paddingRight:value?104:58}}
    />
    {value&&<button
      type="button"
      onClick={clearValue}
      aria-label={lang==="uk"?"Очистити поле":"Clear field"}
      title={lang==="uk"?"Очистити":"Clear"}
      style={{position:"absolute",right:58,top:10,width:38,height:42,border:0,borderRadius:12,background:"transparent",color:"#7b877f",display:"grid",placeItems:"center",cursor:"pointer"}}
    ><X size={21}/></button>}
    <button
      className={`voiceButton ${speech.listening?"listening":""}`}
      type="button"
      onClick={speech.listening?stopVoice:startVoice}
      aria-label={label}
      title={speech.supported?label:(lang==="uk"?"На цьому телефоні скористайтеся диктуванням клавіатури":"Use keyboard dictation on this phone")}
    >{speech.listening?<MicOff size={21}/>:<Mic size={21}/>}</button>
    <small className={`voiceStatus ${speech.listening?"listening":""}`}>{status}</small>
    {speech.error&&<small className="voiceError">{speech.error}</small>}
  </div>;
}
