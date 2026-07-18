/**
 * Формує основний ланцюг, альтернативи та агреговані показники рішення.
 * @param {Array<{requirement:Object,candidates:Array}>} matches Результати зіставлення.
 * @returns {{chain:Array,alternatives:Array,metrics:Object}}
 */
export function buildChain(matches){
  const chain=matches.map(({requirement,candidates},index)=>({index:index+1,requirement,selected:candidates[0]||null,missing:candidates.length===0}));
  const selected=chain.filter(step=>step.selected);
  const alternatives=matches.flatMap(({requirement,candidates})=>candidates.slice(1).map(candidate=>({requirement,candidate})));
  const foundCount=selected.length;
  const totalSteps=chain.length;
  const totalDistanceKm=selected.reduce((sum,step)=>sum+step.selected.distanceKm,0);
  const averageTrustScore=foundCount?Math.round(selected.reduce((sum,step)=>sum+step.selected.trustScore,0)/foundCount):0;
  const completeness=totalSteps?Math.round(foundCount/totalSteps*100):0;
  const estimatedDays=Math.max(1,totalSteps+chain.filter(step=>step.selected?.availability!=="available").length);
  return {chain,alternatives,metrics:{foundCount,totalSteps,totalDistanceKm,averageTrustScore,completeness,estimatedDays}};
}
