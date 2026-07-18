import {AlertTriangle,Clock3,CalendarDays} from "lucide-react";

const icons={emergency:AlertTriangle,quick:Clock3,planned:CalendarDays};

export default function UrgencyBanner({mode,t}){
  const Icon=icons[mode]||CalendarDays;
  return <section className={`urgencyBanner ${mode}`}><Icon/><div><span>{t.detectedMode}</span><h1>{t.modeTitles[mode]}</h1><p>{t.modeDescriptions[mode]}</p></div></section>;
}
