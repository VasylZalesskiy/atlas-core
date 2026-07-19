import {emptyPassportEntry} from "./passportModel.js";

export function normalizePassportEntry(value={}){
  const base=emptyPassportEntry(value.type||value.entry_type);
  const now=new Date().toISOString();
  return {...base,...value,id:String(value.id||""),ownerId:value.ownerId??value.owner_id??null,type:value.type||value.entry_type||base.type,title:String(value.title||"").trim(),description:String(value.description||"").trim(),category:value.category||"",customCategory:value.customCategory??value.custom_category??null,provisionFormats:Array.isArray(value.provisionFormats)?value.provisionFormats:Array.isArray(value.provision_formats)?value.provision_formats:[],territory:{...base.territory,...(value.territory||{})},availability:{...base.availability,...(value.availability||{})},visibility:{...base.visibility,...(value.visibility||{})},status:value.status||"active",createdAt:value.createdAt||value.created_at||now,updatedAt:value.updatedAt||value.updated_at||now};
}

export function toPassportRow(value){
  const entry=normalizePassportEntry(value);
  return {owner_id:entry.ownerId,entry_type:entry.type,title:entry.title,description:entry.description,category:entry.category,custom_category:entry.customCategory,provision_formats:entry.provisionFormats,territory:entry.territory,availability:entry.availability,visibility:entry.visibility,status:entry.status};
}
