import {createClient} from "@supabase/supabase-js";

const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY;
const onCatalogAdminRoute=typeof window!=="undefined"&&window.location.pathname.startsWith("/admin/catalog");

const adminSupabase=url&&key?createClient(url,key,{
  auth:{
    storageKey:"atlas-catalog-admin-auth",
    persistSession:true,
    autoRefreshToken:true,
    detectSessionInUrl:onCatalogAdminRoute
  }
}):null;

export default adminSupabase;
