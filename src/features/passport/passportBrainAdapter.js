const TYPE_MAP={can:"service",have:"resource",share:"resource",need:"request",ready:"service"};

export function passportEntryToOpportunity(entry){
  if(entry.status!=="active")return null;
  return {id:entry.id,type:TYPE_MAP[entry.type],passportType:entry.type,category:entry.category,title:entry.title,description:entry.description,capabilities:[entry.title,entry.description,entry.category].filter(Boolean),resources:entry.type==="have"||entry.type==="share"?[entry.title]:[],city:entry.territory?.city||entry.territory?.region||entry.territory?.country||"",distanceKm:0,availability:["now","today","this_week","always"].includes(entry.availability?.mode)?"available":"unknown",trustScore:50,sourceType:"passport_entry",visibility:entry.visibility?.scope};
}

export function passportEntriesToOpportunities(entries,{ownerId=null,publicSearch=false}={}){
  return entries.filter(entry=>entry.status==="active"&&(publicSearch?entry.visibility?.scope!=="private":!entry.ownerId||entry.ownerId===ownerId)).map(passportEntryToOpportunity).filter(Boolean);
}
