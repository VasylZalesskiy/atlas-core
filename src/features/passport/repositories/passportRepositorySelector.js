import {createDemoPassportRepository} from "./demoPassportRepository.js";
import {createSupabasePassportRepository} from "./supabasePassportRepository.js";

export function isSchemaUnavailable(error){const code=error?.code;return ["42P01","PGRST204","PGRST205"].includes(code)||/passport_entries.*(not find|does not exist|schema cache)/i.test(error?.message||"")}

export async function selectPassportRepository({client,user,demo=false}={}){
  if(demo)return {repository:createDemoPassportRepository(),mode:"demo",reason:"explicit-demo"};
  if(!client)return {repository:createDemoPassportRepository(),mode:"demo",reason:"supabase-not-configured"};
  if(!user?.id)return {repository:createDemoPassportRepository(),mode:"demo",reason:"anonymous-user"};
  const probe=await client.from("passport_entries").select("id").eq("owner_id",user.id).limit(1);
  if(!probe.error)return {repository:createSupabasePassportRepository(client,user.id),mode:"supabase",reason:null};
  if(isSchemaUnavailable(probe.error)){console.warn("Atlas Passport demo fallback:",probe.error.message);return {repository:createDemoPassportRepository(),mode:"demo",reason:"table-unavailable"}}
  throw probe.error;
}
