import {AVAILABILITY_MODES,CATEGORIES,ENTRY_TYPES,TERRITORY_MODES,VISIBILITY_SCOPES} from "./passportModel.js";

export function validatePassportEntry(entry){
  const errors={};
  if(!ENTRY_TYPES.includes(entry.type))errors.type="required";
  const title=entry.title?.trim()||"";
  if(title.length<3||title.length>120)errors.title="titleLength";
  if((entry.description||"").length>1000)errors.description="descriptionLength";
  if(!CATEGORIES.includes(entry.category))errors.category="required";
  if(entry.category==="other"&&(entry.customCategory||"").length>80)errors.customCategory="customCategoryLength";
  if(!VISIBILITY_SCOPES.includes(entry.visibility?.scope))errors.visibility="required";
  if(!TERRITORY_MODES.includes(entry.territory?.mode))errors.territory="required";
  if(entry.territory?.mode==="radius"&&(!Number.isFinite(Number(entry.territory.radiusKm))||Number(entry.territory.radiusKm)<1||Number(entry.territory.radiusKm)>500))errors.radiusKm="radiusRange";
  if(!AVAILABILITY_MODES.includes(entry.availability?.mode))errors.availability="required";
  if(entry.availability?.mode==="custom"&&(entry.availability.customText||"").length>120)errors.customText="availabilityLength";
  return errors;
}

export function isPassportEntryValid(entry){return Object.keys(validatePassportEntry(entry)).length===0}
