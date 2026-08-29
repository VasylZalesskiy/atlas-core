import {useRef} from "react";
import {Mic,MicOff,X} from "lucide-react";
import useSpeechInput from "../hooks/useSpeechInput";

function joinParts(...parts){
  return parts.map(part=>String(part||"").trim()).filter(Boolean).join(" ").replace(/\s+/g," ").trim();
}

export default function VoiceTaskInput({value,onChange,lang="uk",placeholder,className="",autoFocus=false,multiline=true,controlsBelow=false,extraAction=null}){
  const baseRef=useRef("");
  const committedRef=useRef("");
  const fieldRef=useRef(null);

  const speech=useSpeechInput({
    lang,
    onResult:({finalText,interimText})=>{
      if(finalText)committedRef.current=joinParts(committedRef.current,finalText);
      onChange(joinParts(baseRef.current,committedRef.current,interimText));
    }
  });

  const Input=multiline?"textarea":"input";
  const showToolbar=controlsBelow||!multiline;
  const label=speech.listening
    ?(lang==="uk"?"Зупинити голосовий ввід":"Stop voice input")
    :(lang==="uk"?"Говорити":"Speak");

  function startVoice(){
    baseRef.current=value.trim();
    committedRef.current="";
    const started=speech.start();
    if(!started)fieldRef.current?.focus();
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
    ?(speech.phase==="hearing"
      ?(lang==="uk"?"● Чую вас — продовжуйте говорити":"● I can hear you — keep speaking")
      :(lang==="uk"?"● Слухаю — скажіть фразу":"● Listening — say your phrase"))
    :speech.starting
      ?(lang==="uk"?"Підключаю мікрофон…":"Starting the microphone…")
      :speech.phase==="processing"
        ?(lang==="uk"?"Розпізнаю сказане…":"Recognizing speech…")
    :(speech.supported
      ?(lang==="uk"?"Натисніть мікрофон і скажіть фразу":"Tap the microphone and say your phrase")
      :(lang==="uk"?"Використайте мікрофон на клавіатурі":"Use the microphone on your keyboard"));

  const clearButton=<button
    type="button"
    onClick={clearValue}
    aria-label={lang==="uk"?"Очистити поле":"Clear field"}
    title={lang==="uk"?"Очистити":"Clear"}
    className="voiceClearButton"
    style={showToolbar
      ?{position:"static",width:44,height:42,border:"1px solid #dce6df",borderRadius:12,background:"#fff",color:"#65736b",display:"grid",placeItems:"center",cursor:"pointer",flex:"0 0 auto"}
      :{position:"absolute",right:58,top:10,width:38,height:42,border:0,borderRadius:12,background:"transparent",color:"#7b877f",display:"grid",placeItems:"center",cursor:"pointer"}}
  ><X size={21}/></button>;

  const micButton=<button
    className={`voiceButton ${speech.listening?"listening":""} ${speech.starting?"starting":""}`}
    type="button"
    onClick={speech.listening?stopVoice:startVoice}
    disabled={speech.starting}
    aria-pressed={speech.listening}
    aria-label={label}
    title={speech.supported?label:(lang==="uk"?"На цьому телефоні скористайтеся диктуванням клавіатури":"Use keyboard dictation on this phone")}
    style={showToolbar?{position:"static",width:44,height:42,flex:"0 0 auto"}:undefined}
  >{speech.listening?<MicOff size={21}/>:<Mic size={21}/>}</button>;

  return <div className={`voiceTaskInput ${showToolbar?"controlsBelow":""} ${className}`.trim()}>
    <Input
      ref={fieldRef}
      autoFocus={autoFocus}
      required
      value={value}
      onChange={manualChange}
      placeholder={placeholder}
      aria-label={lang==="uk"?"Опишіть вашу задачу":"Describe your task"}
      autoComplete="off"
      enterKeyHint="search"
      spellCheck
      style={showToolbar?{paddingRight:16}: {paddingRight:value?104:58}}
    />

    {showToolbar?<div className="voiceTaskToolbar">
      <small className={`voiceStatus ${speech.listening?"listening":""}`} aria-live="polite">{status}</small>
      <div style={{display:"flex",alignItems:"center",gap:8,flex:"0 0 auto"}}>
        {value&&clearButton}
        {extraAction}
        {micButton}
      </div>
    </div>:<>
      {value&&clearButton}
      {micButton}
      <small className={`voiceStatus ${speech.listening?"listening":""}`} aria-live="polite">{status}</small>
    </>}

    {speech.error&&<small className="voiceError">{speech.error}</small>}
  </div>;
}
