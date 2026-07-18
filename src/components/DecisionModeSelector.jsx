import {AlertTriangle,Clock3,CalendarDays} from "lucide-react";

const options=[{id:"emergency",Icon:AlertTriangle},{id:"quick",Icon:Clock3},{id:"planned",Icon:CalendarDays}];

export default function DecisionModeSelector({value,onChange,t}){
  return <div className="modeSelector"><span>{t.decisionMode}</span>{options.map(({id,Icon})=><button type="button" className={value===id?"active":""} key={id} onClick={()=>onChange(id)}><Icon size={17}/>{t.modeTitles[id]}</button>)}</div>;
}
