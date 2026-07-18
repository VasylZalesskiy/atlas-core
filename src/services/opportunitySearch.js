import supabase from "./supabase.js";

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
      return {sourceType:"atlas_passports",sourceLabel:"Atlas",isVerified:false,title:profile.headline||profile.name||"Opportunity Passport",description:profile.can_help||profile.can_share||"",location:profile.city||"",distance:null,availability:"unknown",actionType:"view_profile",actionUrl:profile.slug?`/profile?slug=${encodeURIComponent(profile.slug)}`:"/profile",score};
    }).filter(result=>result.score>=20).sort((a,b)=>b.score-a.score).slice(0,5);
    return {status:results.length?"matches":"empty",results,error:null};
  }catch(error){return {status:"unavailable",results:[],error:error?.message||"request-failed"}}
}
