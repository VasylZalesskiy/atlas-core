import supabase from "./supabase";

function normalize(value){
  return String(value||"").toLowerCase().replace(/[.,!?;:()]/g," ").replace(/\s+/g," ").trim();
}

function termsFromPlan(plan){
  const explicit=Array.isArray(plan?.passport_search?.terms)?plan.passport_search.terms:[];
  const capability=normalize(plan?.passport_search?.capability_description||"");
  const fallback=normalize(plan?.goal||plan?.originalGoal||plan?.normalizedGoal||"").split(" ").filter(word=>word.length>2);
  return [...new Set([...explicit,capability,...fallback].map(normalize).filter(Boolean))].slice(0,24);
}

function scoreText(text,plan){
  const haystack=normalize(text);
  const terms=termsFromPlan(plan);
  let score=0;
  const matched=[];

  for(const term of terms){
    if(!term)continue;
    if(haystack.includes(term)){
      score+=term.includes(" ")?14:7;
      matched.push(term);
      continue;
    }
    const termWords=term.split(" ").filter(word=>word.length>2);
    const partial=termWords.filter(word=>haystack.includes(word));
    if(partial.length){
      score+=Math.min(8,partial.length*2);
      matched.push(...partial);
    }
  }

  return {score,matched:[...new Set(matched)]};
}

async function searchNewPassports(plan,{limit}){
  const {data:opportunities,error:opportunityError}=await supabase
    .from("atlas_opportunities")
    .select("id,passport_id,kind,text,created_at")
    .eq("is_active",true)
    .limit(1000);

  if(opportunityError)throw opportunityError;
  if(!opportunities?.length)return [];

  const passportIds=[...new Set(opportunities.map(item=>item.passport_id).filter(Boolean))];
  const {data:passports,error:passportError}=await supabase
    .from("atlas_passports")
    .select("id,slug,display_name,city")
    .in("id",passportIds);
  if(passportError)throw passportError;

  const byId=new Map((passports||[]).map(item=>[item.id,item]));
  const ranked=(opportunities||[])
    .map(opportunity=>{
      const passport=byId.get(opportunity.passport_id);
      if(!passport)return null;
      const scored=scoreText([
        opportunity.text,
        opportunity.kind,
        passport.display_name,
        passport.city
      ].filter(Boolean).join(" "),plan);
      return {...opportunity,passport,...scored};
    })
    .filter(Boolean)
    .filter(item=>item.score>0)
    .sort((a,b)=>b.score-a.score);

  // One card per person in the first result set. If one person has several
  // matching opportunities, keep the strongest match and let the public
  // Passport page show the rest.
  const seen=new Set();
  const matches=[];
  for(const item of ranked){
    if(seen.has(item.passport.id))continue;
    seen.add(item.passport.id);
    matches.push({
      slug:item.passport.slug,
      name:item.passport.display_name,
      city:item.passport.city||"",
      headline:item.text,
      can_help:item.text,
      can_share:item.kind,
      needs:"",
      opportunity_id:item.id,
      opportunity_kind:item.kind,
      score:item.score,
      matched:item.matched
    });
    if(matches.length>=limit)break;
  }
  return matches;
}

async function searchLegacyProfiles(plan,{limit}){
  const {data,error}=await supabase
    .from("profiles")
    .select("slug,name,city,headline,can_help,can_share,needs")
    .limit(300);
  if(error)return [];

  return (data||[])
    .map(profile=>({...profile,...scoreText([
      profile.headline,
      profile.can_help,
      profile.can_share,
      profile.needs,
      profile.name,
      profile.city
    ].filter(Boolean).join(" "),plan)}))
    .filter(profile=>profile.score>0)
    .sort((a,b)=>b.score-a.score)
    .slice(0,limit);
}

/**
 * First-stage Atlas retrieval: real Opportunity Passports.
 * Private contact data lives in atlas_private_contacts and is never selected here.
 */
export async function searchPassportProfiles(plan,{limit=5}={}){
  if(!supabase)return {matches:[],error:"supabase-unavailable"};

  try{
    const matches=await searchNewPassports(plan,{limit});
    return {matches,error:null};
  }catch(error){
    // Transitional fallback only while the new production Passport schema has
    // not yet been applied. Once atlas_* tables exist, Atlas uses them exclusively.
    if(/atlas_opportunities|atlas_passports|relation .* does not exist/i.test(String(error?.message||""))){
      const matches=await searchLegacyProfiles(plan,{limit});
      return {matches,error:"production-passports-not-initialized"};
    }
    return {matches:[],error:error?.message||"passport-search-failed"};
  }
}
