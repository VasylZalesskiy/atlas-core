export default function SolutionSummary({result,t}){
  const {metrics}=result;
  return <section className="solutionSummary"><div><span>{t.completeness}</span><strong>{metrics.completeness}%</strong></div><div><span>{t.people}</span><strong>{metrics.foundCount}</strong></div><div><span>{t.distance}</span><strong>{metrics.totalDistanceKm} km</strong></div><div><span>{t.estimatedTime}</span><strong>{metrics.estimatedDays} {t.days}</strong></div><div><span>{t.trust}</span><strong>{metrics.averageTrustScore}%</strong></div></section>;
}
