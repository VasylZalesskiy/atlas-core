function words(value){
  if(Array.isArray(value))return value.flatMap(words);
  if(value&&typeof value==="object")return Object.values(value).flatMap(words);
  return String(value||"").toLowerCase().split(/[^a-zа-яіїєґ0-9']+/i).filter(Boolean);
}

function scoreCandidate(requirement,candidate){
  let score=0;
  const reasons=[];
  const requirementWords=new Set(words([requirement.title,requirement.keywords]));
  const candidateWords=new Set(words([candidate.title,candidate.description,candidate.capabilities,candidate.resources]));
  const overlap=[...requirementWords].filter(word=>word.length>2&&candidateWords.has(word));
  if(requirement.category===candidate.category){score+=40;reasons.push("category")}
  if(requirement.type===candidate.type){score+=20;reasons.push("type")}
  if(overlap.length){score+=Math.min(20,overlap.length*5);reasons.push("keywords")}
  if(candidate.availability==="available"){score+=10;reasons.push("availability")}
  score+=Math.round(candidate.trustScore/10);
  score-=Math.min(18,Math.round(candidate.distanceKm/15));
  return {score:Math.max(0,score),reasons};
}

/**
 * Підбирає до кожної необхідної ланки до трьох релевантних можливостей.
 * @param {Array} requiredOpportunities Необхідні можливості зі структурованої мети.
 * @param {Array} opportunities Каталог доступних можливостей.
 * @returns {Array<{requirement:Object,candidates:Array}>}
 */
export function matchOpportunities(requiredOpportunities,opportunities){
  return requiredOpportunities.map(requirement=>{
    const candidates=opportunities.map(opportunity=>({...opportunity,...scoreCandidate(requirement,opportunity)}))
      .filter(candidate=>candidate.reasons.includes("category")||candidate.reasons.includes("type")||candidate.reasons.includes("keywords"))
      .sort((a,b)=>b.score-a.score||b.trustScore-a.trustScore||a.distanceKm-b.distanceKm)
      .slice(0,3);
    return {requirement,candidates};
  });
}
