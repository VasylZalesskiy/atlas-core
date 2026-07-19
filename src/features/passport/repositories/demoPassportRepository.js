import {normalizePassportEntry} from "../passportNormalizer.js";

const STORAGE_KEY="atlas.passport.entries.v1";
function read(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]").map(normalizePassportEntry)}catch{return []}}
function write(entries){localStorage.setItem(STORAGE_KEY,JSON.stringify(entries));return entries}
function id(){return globalThis.crypto?.randomUUID?.()||`local-${Date.now()}-${Math.random().toString(16).slice(2)}`}

export function createDemoPassportRepository(){return {
  mode:"demo",
  async listEntries(ownerId=null){return read().filter(entry=>!ownerId||entry.ownerId===ownerId||entry.ownerId===null)},
  async getEntry(entryId){return read().find(entry=>entry.id===entryId)||null},
  async createEntry(payload){const now=new Date().toISOString();const entry=normalizePassportEntry({...payload,id:id(),ownerId:null,createdAt:now,updatedAt:now});write([...read(),entry]);return entry},
  async updateEntry(entryId,payload){let updated=null;write(read().map(entry=>entry.id===entryId?(updated=normalizePassportEntry({...entry,...payload,id:entry.id,ownerId:entry.ownerId,createdAt:entry.createdAt,updatedAt:new Date().toISOString()})):entry));if(!updated)throw new Error("entry-not-found");return updated},
  async setEntryStatus(entryId,status){return this.updateEntry(entryId,{status})},
  async deleteEntry(entryId){const entries=read();const next=entries.filter(entry=>entry.id!==entryId);if(next.length===entries.length)throw new Error("entry-not-found");write(next);return true}
}}

export {STORAGE_KEY};
