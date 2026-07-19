import supabase from "./supabase.js";
import {passportEntriesToOpportunities} from "../features/passport/passportBrainAdapter.js";

const fields="slug,name,city,headline,can_help,can_share,needs";

function words(value){return String(value||"").toLowerCase().split(/[^a-zа-яіїєґ0-9']+/i).filter(word=>word.length>2)}

/**
 * Шукає збіги у Паспортах можливостей без читання закритих контактних даних.
 * @param {string|Object} goal Текст або результат GoalParser.
 * @param {string} location Текстова локація користувача.
 * @param {Object|null} client Supabase client; параметр дозволяє ізольоване тестування.
 */
export async function searchAtlasPassports(goal,location="",client=supabase){
  if(!client)return {status:"unavailable",results:[],error:"not-configured"};
  try{
    const response=await client.from("profiles").select(fields).limit(100);
    if(response.error)return {status:"unavailable",results:[],error:response.error.message};
    const goalText=typeof goal==="string"?goal:[goal.originalGoal,goal.normalizedGoal,goal.keywords?.join(" ")].filter(Boolean).join(" ");
    const goalWords=new Set(words(goalText));if([...goalWords].some(word=>word.startsWith("перевіз")))["перевезення","транспорт","доставка"].forEach(word=>goalWords.add(word));const locationWords=new Set(words(location));
    const results=(response.data||[]).map(profile=>{
      const searchable=words([profile.headline,profile.can_help,profile.can_share,profile.needs,profile.city].join(" "));
      const keywordMatches=searchable.filter(word=>[...goalWords].some(goalWord=>word===goalWord||(word.length>5&&goalWord.length>5&&word.slice(0,5)===goalWord.slice(0,5)))).length;
      const cityMatches=words(profile.city).filter(word=>locationWords.has(word)).length;
      const score=keywordMatches*20+cityMatches*10;
      const internalRoute=profile.slug?`/profile?slug=${encodeURIComponent(profile.slug)}`:"/profile";return {sourceType:"atlas_passports",sourceLabel:"Atlas",isVerified:false,title:profile.headline||profile.name||"Opportunity Passport",description:profile.can_help||profile.can_share||"",location:profile.city||"",distance:null,availability:"unknown",actionType:"view_profile",actionUrl:internalRoute,internalRoute,score};
    }).filter(result=>result.score>=20).sort((a,b)=>b.score-a.score).slice(0,5);
    return {status:results.length?"matches":"empty",results,error:null};
  }catch(error){return {status:"unavailable",results:[],error:error?.message||"request-failed"}}
}

/** Rule-based matching over already loaded own/demo Passport entries. */
export function searchNormalizedPassportEntries(goal,location="",entries=[],ownerId=null){
  const goalText=typeof goal==="string"?goal:[goal.originalGoal,goal.normalizedGoal,goal.keywords?.join(" ")].filter(Boolean).join(" ");
  const goalWords=new Set(words(goalText));const locationWords=new Set(words(location));
  const results=passportEntriesToOpportunities(entries,{ownerId}).map(entry=>{
    const searchable=words([entry.title,entry.description,entry.category,entry.city].join(" "));
    const keywordMatches=searchable.filter(word=>[...goalWords].some(goalWord=>word===goalWord||(word.length>5&&goalWord.length>5&&word.slice(0,5)===goalWord.slice(0,5)))).length;
    const cityMatches=words(entry.city).filter(word=>locationWords.has(word)).length;const score=keywordMatches*20+cityMatches*10;
    return {sourceType:"passport_entries",sourceLabel:"Atlas",isVerified:false,title:entry.title,description:entry.description,location:entry.city,distance:null,availability:entry.availability,actionType:"view_passport",actionUrl:"/passport",internalRoute:"/passport",passportEntryId:entry.id,score,entry};
  }).filter(result=>result.score>=20).sort((a,b)=>b.score-a.score).slice(0,5);
  return {status:results.length?"matches":"empty",results,error:null};
}
