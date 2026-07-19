export function getPassportSubmitLabel({editing=false,saving=false,labels}){return saving?labels.saving:editing?labels.saveChanges:labels.save}
export function isAdvancedSettingsInitiallyOpen(){return false}
export function filterEntriesByTypeTab(entries,tab="all"){return tab==="all"?entries:entries.filter(entry=>entry.type===tab)}
export function getPassportEntryView(entry,labels){const chips=[entry.category==="other"?entry.customCategory:labels.categories[entry.category],entry.territory?.mode==="radius"&&entry.territory.radiusKm?`${entry.territory.radiusKm} km`:labels.territories[entry.territory?.mode],labels.availabilities[entry.availability?.mode],labels.visibilities[entry.visibility?.scope]].filter(Boolean).slice(0,4);return {description:entry.description?.trim()||null,chips}}
export function getRepositoryMessageKey({mode,reason,hasEntries=false}){
  if(mode==="demo")return hasEntries?"demoChecked":reason==="table-unavailable"?"onlineUnavailable":"demoEmpty";
  return hasEntries?"ownChecked":"ownEmpty";
}
