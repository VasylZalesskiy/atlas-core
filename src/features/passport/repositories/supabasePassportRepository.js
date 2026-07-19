import {normalizePassportEntry,toPassportRow} from "../passportNormalizer.js";

function unwrap(response){if(response.error)throw response.error;return response.data}
export function createSupabasePassportRepository(client,ownerId){return {
  mode:"supabase",
  async listEntries(){return (unwrap(await client.from("passport_entries").select("*").eq("owner_id",ownerId).order("created_at",{ascending:false}))||[]).map(normalizePassportEntry)},
  async getEntry(id){return normalizePassportEntry(unwrap(await client.from("passport_entries").select("*").eq("id",id).eq("owner_id",ownerId).single()))},
  async createEntry(payload){return normalizePassportEntry(unwrap(await client.from("passport_entries").insert({...toPassportRow(payload),owner_id:ownerId}).select().single()))},
  async updateEntry(id,payload){const row=toPassportRow({...payload,ownerId});delete row.owner_id;return normalizePassportEntry(unwrap(await client.from("passport_entries").update(row).eq("id",id).eq("owner_id",ownerId).select().single()))},
  async setEntryStatus(id,status){return normalizePassportEntry(unwrap(await client.from("passport_entries").update({status}).eq("id",id).eq("owner_id",ownerId).select().single()))},
  async deleteEntry(id){unwrap(await client.from("passport_entries").delete().eq("id",id).eq("owner_id",ownerId));return true}
}}
