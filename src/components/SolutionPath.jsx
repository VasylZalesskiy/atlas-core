import {CheckCircle2} from "lucide-react";

export default function SolutionPath({solution,t}){
  const atlasSteps=solution.atlasResult?.chain;
  return <section className="solutionPath"><div className="sectionHeading"><span>{t.optimalPath}</span><h2>{t.pathToSolution}</h2></div><div className="pathSteps">{solution.steps.map((step,index)=>{const atlasStep=atlasSteps?.[index];return <article key={`${index}-${typeof step==="string"?step:step.title}`}><div className="pathIndex">{index+1}</div><div><h3>{typeof step==="string"?step:step.title}</h3>{atlasStep?.selected&&<p>{atlasStep.selected.title} · {atlasStep.selected.city}</p>}</div><CheckCircle2/></article>})}</div></section>;
}
