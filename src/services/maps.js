const mapsBase="https://www.google.com/maps";

/** Формує Google Maps universal URL для пошуку без API-ключа. */
export function buildGoogleMapsSearchUrl(query){
  const params=new URLSearchParams({api:"1",query:String(query||"").trim()});
  return `${mapsBase}/search/?${params.toString()}`;
}

/** Формує Google Maps universal URL маршруту з реальним origin. */
export function buildGoogleMapsDirectionsUrl(location,destination){
  if(!location)throw new Error("location-required");
  const origin=`${location.latitude},${location.longitude}`;
  const params=new URLSearchParams({api:"1",origin,destination:String(destination||"").trim(),travelmode:"driving"});
  return `${mapsBase}/dir/?${params.toString()}`;
}

function openExternal(url){
  if(typeof window!=="undefined")window.location.assign(url);
  return url;
}

export function openGoogleMapsSearch(query){return openExternal(buildGoogleMapsSearchUrl(query))}
export function openGoogleMapsDirections(location,destination){return openExternal(buildGoogleMapsDirectionsUrl(location,destination))}

/** Повертає безпечний пошуковий запит для поточного сценарію. */
export function getScenarioSearchQuery(solution,lang="uk"){
  const queries={
    "medical-emergency":{uk:"найближче приймальне відділення лікарні",en:"nearest hospital emergency department"},
    pharmacy:{uk:"аптека відкрита зараз",en:"pharmacy open now"},
    roadside:{uk:solution.goal.normalizedGoal.includes("евакуатор")?"евакуатор":"шиномонтаж",en:solution.goal.normalizedGoal.includes("tow")?"tow truck":"tire service"},
    transport:{uk:"вантажні перевезення",en:"freight transport"}
  };
  return queries[solution.goal.scenario]?.[lang]||solution.goal.keywords.join(" ")||solution.goal.originalGoal;
}
