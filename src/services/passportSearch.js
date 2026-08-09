import supabase from "./supabase";

function normalize(value){
  return String(value||"").toLowerCase().replace(/[.,!?;:()]/g," ").replace(/\s+/g," ").trim();
}

function termsFromPlan(plan){
  const explicit=Array.isArray(plan?.passport_search?.terms)?plan.passport_search.terms:[];
  const fallback=normalize(plan?.goal||plan?.originalGoal||plan?.normalizedGoal||"").split(" ").filter(word=>word.length>2);
  return [...new Set([...explicit,...fallback].map(normalize).filter(Boolean))].slice(0,20);
}

function scoreProfile(profile,plan){
  const text=normalize([
    profile.headline,
    profile.can_help,
    profile.can_share,
    profile.needs,
    profile.name,
    profile.city
  ].filter(Boolean).join(" "));
  const terms=termsFromPlan(plan);
  let score=0;
  const matched=[];

  for(const term of terms){
    if(!term)continue;
    if(text.includes(term)){
      score+=term.includes(" ")?12:6;
      matched.push(term);
      continue;
    }
    const termWords=term.split(" ").filter(word=>word.length>2);
    const partial=termWords.filter(word=>text.includes(word));
    if(partial.length){
      score+=Math.min(5,partial.length*2);
      matched.push(...partial);
    }
  }

  if(profile.city)score+=1;
  return {score,matched:[...new Set(matched)]};
}

/**
 * Пошук реальних можливостей у таблиці profiles без розкриття контактів.
 * Джерело термінів — універсальний план Atlas Brain, а не список сценаріїв у коді.
 */
export async function searchPassportProfiles(plan,{limit=5}={}){
  if(!supabase)return {matches:[],error:"supabase-unavailable"};

  const {data,error}=await supabase
    .from("profiles")
    .select("slug,name,city,headline,can_help,can_share,needs")
    .limit(300);

  if(error)return {matches:[],error:error.message};

  const matches=(data||[])
    .map(profile=>({...profile,...scoreProfile(profile,plan)}))
    .filter(profile=>profile.score>0)
    .sort((a,b)=>b.score-a.score)
    .slice(0,limit);

  return {matches,error:null};
}
