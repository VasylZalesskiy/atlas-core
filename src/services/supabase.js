import {createClient} from "@supabase/supabase-js";

const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY;
const onAdminRoute=typeof window!=="undefined"&&window.location.pathname.startsWith("/admin/");
const supabase=url&&key?createClient(url,key,{auth:{detectSessionInUrl:!onAdminRoute}}):null;

export default supabase;
