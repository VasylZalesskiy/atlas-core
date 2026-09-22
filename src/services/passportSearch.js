import supabase from "./supabase";
import {decodeOpportunityText} from "./opportunityCodec";

function normalize(value){
  return String(value||"").toLowerCase().replace(/[.,!?;:()]/g," ").replace(/\s+/g," ").trim();
}

function isMedicalPlan(plan){
  const text=normalize([
    plan?.goal,
    plan?.originalGoal,
    plan?.normalizedGoal,
    plan?.passport_search?.capability_description,
    ...(Array.isArray(plan?.passport_search?.terms)?plan.passport_search.terms:[])
  ].filter(Boolean).join(" "));
  return /медич|лікар|медик|фельдшер|парамедик|doctor|medical|medic|paramedic|family doctor/.test(text);
}

function termsFromPlan(plan){
  const explicit=Array.isArray(plan?.passport_search?.terms)?plan.passport_search.terms:[];
  const capability=normalize(plan?.passport_search?.capability_description||"");
  const fallback=normalize(plan?.goal||plan?.originalGoal||plan?.normalizedGoal||"").split(" ").filter(word=>word.length>2);
  return [...new Set([...explicit,capability,...fallback].map(normalize).filter(Boolean))].slice(0,24);
}

function searchWords(plan){
  const words=[];
  for(const term of termsFromPlan(plan)){
    for(const word of normalize(term).split(" ")){
      const clean=word.replace(/[^\p{L}\p{N}_-]/gu,"");
      if(clean.length>2&&!words.includes(clean))words.push(clean);
      if(words.length>=12)return words;
    }
  }
  return words;
}

function fullTextQuery(plan){
  return searchWords(plan).map(word=>`"${word}"`).join(" OR ");
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
  const query=fullTextQuery(plan);
  if(!query)return [];
  const candidateLimit=Math.max(20,Math.min(100,limit*12));

  const [{data:directPassports,error:passportError},{data:rawOpportunities,error:opportunityError}]=await Promise.all([
    supabase
      .from("atlas_passports")
      .select("id,slug,display_name,profession,skills,city")
      .textSearch("search_fts",query,{type:"websearch",config:"simple"})
      .limit(candidateLimit),
    supabase
      .from("atlas_opportunities")
      .select("id,passport_id,kind,text,created_at")
      .eq("is_active",true)
      .textSearch("search_fts",query,{type:"websearch",config:"simple"})
      .limit(candidateLimit*2)
  ]);
  if(passportError)throw passportError;
  if(opportunityError)throw opportunityError;

  const passportMap=new Map((directPassports||[]).map(item=>[item.id,item]));
  const missingPassportIds=[...new Set((rawOpportunities||[]).map(item=>item.passport_id).filter(id=>id&&!passportMap.has(id)))];
  if(missingPassportIds.length){
    const {data:linkedPassports,error:linkedError}=await supabase
      .from("atlas_passports")
      .select("id,slug,display_name,profession,skills,city")
      .in("id",missingPassportIds.slice(0,candidateLimit));
    if(linkedError)throw linkedError;
    for(const passport of linkedPassports||[])passportMap.set(passport.id,passport);
  }

  const opportunitiesByPassport=new Map();
  for(const rawItem of rawOpportunities||[]){
    const item={...rawItem,...decodeOpportunityText(rawItem.text,rawItem.kind)};
    if(!opportunitiesByPassport.has(item.passport_id))opportunitiesByPassport.set(item.passport_id,[]);
    opportunitiesByPassport.get(item.passport_id).push(item);
  }

  const ranked=[...passportMap.values()].map(passport=>{
    const profileScore=scoreText([
      passport.profession,
      passport.skills,
    ].filter(Boolean).join(" "),plan);

    let bestOpportunity=null;
    let bestOpportunityScore={score:0,matched:[]};
    for(const opportunity of opportunitiesByPassport.get(passport.id)||[]){
      const scored=scoreText([opportunity.text,opportunity.kind].filter(Boolean).join(" "),plan);
      if(scored.score>bestOpportunityScore.score){
        bestOpportunity=opportunity;
        bestOpportunityScore=scored;
      }
    }

    const score=profileScore.score+bestOpportunityScore.score;
    const matched=[...new Set([...profileScore.matched,...bestOpportunityScore.matched])];
    const profileWins=profileScore.score>=bestOpportunityScore.score&&profileScore.score>0;
    const headline=profileWins
      ?(passport.profession||passport.skills||bestOpportunity?.text||passport.display_name)
      :(bestOpportunity?.text||passport.profession||passport.skills||passport.display_name);

    return {
      slug:passport.slug,
      name:passport.display_name,
      city:passport.city||"",
      profession:passport.profession||"",
      skills:passport.skills||"",
      headline,
      can_help:[passport.profession,passport.skills,bestOpportunity?.text].filter(Boolean).join(" · "),
      can_share:bestOpportunity?.kind||"",
      needs:"",
      opportunity_id:bestOpportunity?.id||null,
      opportunity_kind:bestOpportunity?.kind||"",
      payment_type:bestOpportunity?.paymentType||"free",
      price_value:bestOpportunity?.priceValue||"",
      price_unit:bestOpportunity?.priceUnit||"",
      currency:bestOpportunity?.currency||"UAH",
      minimum_quantity:bestOpportunity?.minimumQuantity||"",
      delivery_included:Boolean(bestOpportunity?.deliveryIncluded),
      score,
      matched
    };
  })
    .filter(item=>item.score>0)
    .sort((a,b)=>b.score-a.score)
    .slice(0,limit);

  return ranked;
}

async function searchLegacyProfiles(plan,{limit}){
  const query=fullTextQuery(plan);
  if(!query)return [];
  const {data,error}=await supabase
    .from("profiles")
    .select("slug,name,city,headline,can_help,can_share,needs")
    .textSearch("profiles_search_idx",query,{type:"websearch",config:"simple"})
    .limit(Math.max(20,limit*10));
  if(error){
    const {data:fallbackData,error:fallbackError}=await supabase
      .from("profiles")
      .select("slug,name,city,headline,can_help,can_share,needs")
      .limit(300);
    if(fallbackError)return [];
    return rankLegacy(fallbackData,plan,limit);
  }
  return rankLegacy(data,plan,limit);
}

function rankLegacy(data,plan,limit){
  return (data||[])
    .map(profile=>({...profile,...scoreText([
      profile.headline,
      profile.can_help,
      profile.can_share,
      profile.name,
      profile.city
    ].filter(Boolean).join(" "),plan)}))
    .filter(profile=>profile.score>0)
    .sort((a,b)=>b.score-a.score)
    .slice(0,limit);
}

/**
 * First-stage Atlas retrieval: real Opportunity Passports.
 * PostgreSQL full-text indexes reduce the candidate set before browser-side ranking.
 * Private contact data lives in atlas_private_contacts and is never selected here.
 *
 * Medical exception: Atlas currently has no credential-verification field for
 * passports. Until verified professional status exists, medical queries MUST
 * NOT recommend an unverified self-declared profile as a care provider.
 */
export async function searchPassportProfiles(plan,{limit=5}={}){
  if(isMedicalPlan(plan))return {matches:[],error:"unverified-medical-passports-disabled"};
  if(!supabase)return {matches:[],error:"supabase-unavailable"};

  try{
    const matches=await searchNewPassports(plan,{limit});
    return {matches,error:null};
  }catch(error){
    if(/atlas_opportunities|atlas_passports|search_fts|profession|skills|relation .* does not exist/i.test(String(error?.message||""))){
      const matches=await searchLegacyProfiles(plan,{limit});
      return {matches,error:"production-passports-not-initialized"};
    }
    return {matches:[],error:error?.message||"passport-search-failed"};
  }
}
