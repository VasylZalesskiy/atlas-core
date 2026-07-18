export default function AlternativeOptions({alternatives,t}){
  return <section className="decisionAlternatives"><h2>{t.alternatives}</h2>{alternatives.length?alternatives.map((option,index)=><article key={`${option.title}-${index}`}><span>{index+2}</span><div><h3>{option.title}</h3><p>{option.meta}</p></div></article>):<p>{t.noAlternatives}</p>}</section>;
}
