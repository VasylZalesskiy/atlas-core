import {buildGoogleMapsSearchUrl} from "./maps.js";

function option(sourceType,title,description,actionLabel,actionQuery,t,actionType="search",actionUrl=null){
  const url=actionUrl||buildGoogleMapsSearchUrl(actionQuery);return {sourceType,sourceLabel:sourceType,isVerified:false,title,description,location:"",actionType,actionUrl:url,mapsUrl:url.startsWith("https://www.google.com/maps")?url:null,phone:url.startsWith("tel:")?url.slice(4):null,actionLabel,actionQuery};
}

/** Формує 3–5 чесно позначених зовнішніх напрямків пошуку. */
export function buildExternalOptions(solution,t){
  const scenario=solution.goal.scenario;
  if(scenario==="medical-emergency")return [
    option("external_web",t.externalOptionTitles.emergencyDepartments,t.externalOptionDescriptions.emergencyDepartments,t.showOnMap,t.externalQueries.emergencyDepartments,t),
    option("external_web",t.externalOptionTitles.hospitals24,t.externalOptionDescriptions.hospitals24,t.find,t.externalQueries.hospitals24,t),
    option("external_web",t.externalOptionTitles.pharmaciesNow,t.externalOptionDescriptions.medicalPharmacies,t.showPharmacies,t.externalQueries.pharmaciesNow,t),
    option("emergency_service",t.externalOptionTitles.emergency103,t.externalOptionDescriptions.emergency103,t.call103,"",t,"call","tel:103")
  ];
  if(scenario==="pharmacy")return [
    option("external_web",t.externalOptionTitles.pharmaciesNow,t.externalOptionDescriptions.pharmaciesNow,t.find,t.externalQueries.pharmaciesNow,t),
    option("external_web",t.externalOptionTitles.pharmacies24,t.externalOptionDescriptions.pharmacies24,t.find,t.externalQueries.pharmacies24,t),
    option("external_web",t.externalOptionTitles.pharmaciesNearby,t.externalOptionDescriptions.pharmaciesNearby,t.showOnMap,t.externalQueries.pharmaciesNearby,t),
    option("external_web",t.externalOptionTitles.pharmacyRoute,t.externalOptionDescriptions.pharmacyRoute,t.openRoute,t.externalQueries.pharmaciesNow,t,"directions")
  ];
  if(scenario==="roadside")return [
    option("external_web",t.externalOptionTitles.tireNearby,t.externalOptionDescriptions.tireNearby,t.showOnMap,t.externalQueries.tireNearby,t),
    option("external_web",t.externalOptionTitles.mobileTire,t.externalOptionDescriptions.mobileTire,t.find,t.externalQueries.mobileTire,t),
    option("external_web",t.externalOptionTitles.towTrucks,t.externalOptionDescriptions.towTrucks,t.find,t.externalQueries.towTrucks,t),
    option("external_web",t.externalOptionTitles.gasStations,t.externalOptionDescriptions.gasStations,t.showOnMap,t.externalQueries.gasStations,t)
  ];
  const query=solution.goal.keywords.join(" ")||solution.goal.originalGoal;
  return [option("external_web",t.externalOptionTitles.webSearch,t.externalOptionDescriptions.webSearch,t.find,query,t),option("external_web",t.externalOptionTitles.mapSearch,t.externalOptionDescriptions.mapSearch,t.showOnMap,query,t)];
}
