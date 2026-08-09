import supabase from "./supabase";

function normalize(value){
  return String(value||"").toLowerCase().replace(/[.,!?;:()]/g," ").replace(/\s+/g," ").trim();
}

const healthRoles=[
  "лікар","фельдшер","медсест","медбрат","медик","парамедик","терапевт","сімейний лікар","невролог","педіатр",
  "doctor","physician","nurse","paramedic","medic","therapist"
];

const foodTerms=[
  "готую","готує","кухар","кухарка","домашні обіди","домашня їжа","обіди","їжа","готова їжа","доставка їжі",
  "продукти","овочі","зелень","випічка","пекар","cook","chef","homemade food","meals","food delivery","groceries"
];

const vehicleTerms=[
  "авто","автомобіль","машина","продам авто","продаю авто","продам машину","продаю машину","авто на продаж",
  "автоексперт","підбір авто","діагностика авто","car","vehicle","sell car","car for sale","vehicle inspection"
];

function goalTerms(goal){
  const text=normalize(goal?.originalGoal||goal?.normalizedGoal||"");
  const words=text.split(" ").filter(word=>word.length>2);
  if(goal?.category==="health")return [...new Set([...healthRoles,...words])];
  if(goal?.category==="food")return [...new Set([...foodTerms,...words])];
  if(goal?.category==="vehicle")return [...new Set([...vehicleTerms,...words])];
  return [...new Set(words)];
}

function scoreProfile(profile,goal){
  const text=normalize([profile.headline,profile.can_help,profile.can_share].filter(Boolean).join(" "));
  const terms=goalTerms(goal);
  let score=0;
  const matched=[];

  for(const term of terms){
    if(text.includes(term)){
      const strongMatch=healthRoles.includes(term)||foodTerms.includes(term)||vehicleTerms.includes(term);
      score+=strongMatch?12:3;
      matched.push(term);
    }
  }

  if(goal?.category==="health"&&healthRoles.some(role=>text.includes(role)))score+=25;
  if(goal?.category==="food"&&foodTerms.some(term=>text.includes(term)))score+=25;
  if(goal?.category==="vehicle"&&vehicleTerms.some(term=>text.includes(term)))score+=25;
  if(profile.city)score+=1;
  return {score,matched:[...new Set(matched)]};
}

/** Пошук реальних можливостей у таблиці profiles без розкриття контактів. */
export async function searchPassportProfiles(goal,{limit=5}={}){
  if(!supabase)return {matches:[],error:"supabase-unavailable"};

  const {data,error}=await supabase
    .from("profiles")
    .select("slug,name,city,headline,can_help,can_share")
    .limit(200);

  if(error)return {matches:[],error:error.message};

  const matches=(data||[])
    .map(profile=>({...profile,...scoreProfile(profile,goal)}))
    .filter(profile=>profile.score>0)
    .sort((a,b)=>b.score-a.score)
    .slice(0,limit);

  return {matches,error:null};
}
