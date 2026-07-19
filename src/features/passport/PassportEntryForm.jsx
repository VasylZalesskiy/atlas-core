import {useEffect,useState} from "react";
import {X} from "lucide-react";
import {CATEGORIES,ENTRY_TYPES,FORMATS_BY_TYPE,TERRITORY_MODES,AVAILABILITY_MODES,VISIBILITY_SCOPES,emptyPassportEntry} from "./passportModel";
import {validatePassportEntry} from "./passportValidation";
import {getPassportSubmitLabel,isAdvancedSettingsInitiallyOpen} from "./passportUx";

export default function PassportEntryForm({initialEntry,t,saving,onSave,onClose}){
  const p=t.passport2;const [entry,setEntry]=useState(()=>initialEntry||emptyPassportEntry());const [errors,setErrors]=useState({});const [advanced,setAdvanced]=useState(isAdvancedSettingsInitiallyOpen);
  useEffect(()=>setEntry(initialEntry||emptyPassportEntry()),[initialEntry]);
  const set=(key,value)=>setEntry(current=>({...current,[key]:value}));
  function submit(event){event.preventDefault();const next=validatePassportEntry(entry);setErrors(next);if(!Object.keys(next).length)onSave(entry)}
  return <div className="passportModalBackdrop" role="presentation" onMouseDown={event=>event.target===event.currentTarget&&onClose()}><section className="passportModal" role="dialog" aria-modal="true" aria-labelledby="passport-form-title"><header><h2 id="passport-form-title">{initialEntry?.id?p.editEntry:p.addEntry}</h2><button className="iconButton" onClick={onClose} aria-label={p.close}><X/></button></header><form onSubmit={submit} className="passportEntryForm">
    <label><span>{p.type} *</span><select value={entry.type} onChange={e=>setEntry(current=>({...current,type:e.target.value,provisionFormats:[]}))}>{ENTRY_TYPES.map(value=><option key={value} value={value}>{p.types[value]}</option>)}</select></label>
    <label><span>{p.title} *</span><input value={entry.title} maxLength="120" onChange={e=>set("title",e.target.value)}/>{errors.title&&<small>{p.errors[errors.title]}</small>}</label>
    <label><span>{p.category} *</span><select value={entry.category} onChange={e=>set("category",e.target.value)}><option value="">{p.select}</option>{CATEGORIES.map(value=><option key={value} value={value}>{p.categories[value]}</option>)}</select>{errors.category&&<small>{p.errors[errors.category]}</small>}</label>
    {entry.category==="other"&&<label><span>{p.customCategory}</span><input value={entry.customCategory||""} maxLength="80" onChange={e=>set("customCategory",e.target.value)}/>{errors.customCategory&&<small>{p.errors[errors.customCategory]}</small>}</label>}
    <button type="button" className="advancedToggle wide" aria-expanded={advanced} onClick={()=>setAdvanced(value=>!value)}>{advanced?p.hideAdvanced:p.showAdvanced}</button>
    {advanced&&<div className="advancedFields wide"><label className="wide"><span>{p.description}</span><textarea value={entry.description} maxLength="1000" onChange={e=>set("description",e.target.value)}/>{errors.description&&<small>{p.errors[errors.description]}</small>}</label>
    <fieldset className="wide"><legend>{p.formats}</legend><div className="checkboxGrid">{FORMATS_BY_TYPE[entry.type].map(value=><label key={value}><input type="checkbox" checked={entry.provisionFormats.includes(value)} onChange={e=>set("provisionFormats",e.target.checked?[...entry.provisionFormats,value]:entry.provisionFormats.filter(item=>item!==value))}/>{p.provisionFormats[value]}</label>)}</div></fieldset>
    <label><span>{p.territory}</span><select value={entry.territory.mode} onChange={e=>set("territory",{...entry.territory,mode:e.target.value})}>{TERRITORY_MODES.map(value=><option key={value} value={value}>{p.territories[value]}</option>)}</select></label>
    {entry.territory.mode==="radius"&&<label><span>{p.radiusKm}</span><input type="number" min="1" max="500" value={entry.territory.radiusKm||""} onChange={e=>set("territory",{...entry.territory,radiusKm:e.target.value===""?null:Number(e.target.value)})}/>{errors.radiusKm&&<small>{p.errors[errors.radiusKm]}</small>}</label>}
    {entry.territory.mode==="city"&&<label><span>{p.city}</span><input value={entry.territory.city||""} onChange={e=>set("territory",{...entry.territory,city:e.target.value})}/></label>}
    {entry.territory.mode==="region"&&<label><span>{p.region}</span><input value={entry.territory.region||""} onChange={e=>set("territory",{...entry.territory,region:e.target.value})}/></label>}
    <label><span>{p.availability}</span><select value={entry.availability.mode} onChange={e=>set("availability",{...entry.availability,mode:e.target.value})}>{AVAILABILITY_MODES.map(value=><option key={value} value={value}>{p.availabilities[value]}</option>)}</select></label>
    {entry.availability.mode==="custom"&&<label><span>{p.customAvailability}</span><input value={entry.availability.customText||""} maxLength="120" onChange={e=>set("availability",{...entry.availability,customText:e.target.value})}/>{errors.customText&&<small>{p.errors[errors.customText]}</small>}</label>}
    <label><span>{p.visibility} *</span><select value={entry.visibility.scope} onChange={e=>set("visibility",{scope:e.target.value,communityId:null})}>{VISIBILITY_SCOPES.map(value=><option key={value} value={value} disabled={["community","all_communities"].includes(value)}>{p.visibilities[value]}{["community","all_communities"].includes(value)?` — ${p.communitiesUnavailable}`:""}</option>)}</select></label>
    </div>}
    <div className="formActions wide"><button type="button" onClick={onClose}>{p.cancel}</button><button className="passportSubmit" disabled={saving}>{getPassportSubmitLabel({editing:Boolean(initialEntry?.id),saving,labels:p})}</button></div>
  </form></section></div>;
}
