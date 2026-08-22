import {Mic,MicOff} from "lucide-react";
import useSpeechInput from "../hooks/useSpeechInput";

export default function VoiceTaskInput({value,onChange,lang="uk",placeholder,className="",autoFocus=false,multiline=true}){
  const speech=useSpeechInput({
    lang,
    onTranscript:transcript=>onChange([value.trim(),transcript].filter(Boolean).join(" "))
  });
  const Input=multiline?"textarea":"input";
  const label=speech.listening
    ?(lang==="uk"?"Зупинити запис":"Stop listening")
    :(lang==="uk"?"Ввести голосом":"Enter by voice");

  return <div className={`voiceTaskInput ${className}`.trim()}>
    <Input
      autoFocus={autoFocus}
      required
      value={value}
      onChange={event=>onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={lang==="uk"?"Опишіть вашу задачу":"Describe your task"}
    />
    <button
      className={`voiceButton ${speech.listening?"listening":""}`}
      type="button"
      onClick={speech.listening?speech.stop:speech.start}
      aria-label={label}
      title={speech.supported?label:(lang==="uk"?"На цьому телефоні скористайтеся диктуванням клавіатури":"Use keyboard dictation on this phone")}
    >{speech.listening?<MicOff size={21}/>:<Mic size={21}/>}</button>
    {speech.error&&<small className="voiceError">{speech.error}</small>}
  </div>;
}
