import {CheckCircle2,LoaderCircle} from "lucide-react";

export default function ThinkingState({steps,activeStep}){
  return <main className="thinking"><section className="thinkingCard"><div className="thinkingMark"><LoaderCircle size={32}/></div><h1>Atlas</h1><div className="thinkingSteps">{steps.map((step,index)=><div className={index===activeStep?"active":index<activeStep?"done":""} key={step}>{index<activeStep?<CheckCircle2 size={19}/>:<span>{index+1}</span>}<strong>{step}</strong></div>)}</div></section></main>;
}
