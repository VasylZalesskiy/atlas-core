import supabase from "./supabase";

function fail(message){
  const error=new Error(message);
  error.code=message;
  return error;
}

export async function ensureAtlasSession(){
  if(!supabase)throw fail("supabase-unavailable");
  const {data:sessionData,error:sessionError}=await supabase.auth.getSession();
  if(sessionError)throw sessionError;
  if(sessionData?.session?.user)return sessionData.session.user;

  const {data,error}=await supabase.auth.signInAnonymously();
  if(error)throw error;
  if(!data?.user)throw fail("anonymous-auth-unavailable");
  return data.user;
}

function slugBase(value){
  return String(value||"atlas")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9а-яіїєґ]+/gi,"-")
    .replace(/^-+|-+$/g,"")
    .slice(0,48)||"atlas";
}

function createSlug(displayName,userId){
  const suffix=String(userId||crypto.randomUUID()).replace(/-/g,"").slice(0,8);
  return `${slugBase(displayName)}-${suffix}`;
}

export async function loadMyPassport(){
  const user=await ensureAtlasSession();

  const {data:passport,error:passportError}=await supabase
    .from("atlas_passports")
    .select("id,slug,display_name,city,created_at,updated_at")
    .eq("owner_id",user.id)
    .maybeSingle();
  if(passportError)throw passportError;

  const {data:privateRow,error:privateError}=await supabase
    .from("atlas_private_contacts")
    .select("contact")
    .eq("owner_id",user.id)
    .maybeSingle();
  if(privateError)throw privateError;

  let opportunities=[];
  if(passport?.id){
    const {data,error}=await supabase
      .from("atlas_opportunities")
      .select("id,kind,text,is_active,created_at")
      .eq("passport_id",passport.id)
      .eq("owner_id",user.id)
      .order("created_at",{ascending:false});
    if(error)throw error;
    opportunities=data||[];
  }

  return {user,passport:passport||null,contact:privateRow?.contact||"",opportunities};
}

export async function saveMyPassport({displayName,city,contact}){
  const user=await ensureAtlasSession();
  const cleanName=String(displayName||"").trim();
  const cleanCity=String(city||"").trim();
  const cleanContact=String(contact||"").trim();
  if(!cleanName)throw fail("display-name-required");
  if(!cleanContact)throw fail("contact-required");

  const {data:existing,error:existingError}=await supabase
    .from("atlas_passports")
    .select("id,slug")
    .eq("owner_id",user.id)
    .maybeSingle();
  if(existingError)throw existingError;

  let passport;
  if(existing?.id){
    const {data,error}=await supabase
      .from("atlas_passports")
      .update({display_name:cleanName,city:cleanCity,updated_at:new Date().toISOString()})
      .eq("id",existing.id)
      .eq("owner_id",user.id)
      .select("id,slug,display_name,city,created_at,updated_at")
      .single();
    if(error)throw error;
    passport=data;
  }else{
    const {data,error}=await supabase
      .from("atlas_passports")
      .insert({
        owner_id:user.id,
        slug:createSlug(cleanName,user.id),
        display_name:cleanName,
        city:cleanCity
      })
      .select("id,slug,display_name,city,created_at,updated_at")
      .single();
    if(error)throw error;
    passport=data;
  }

  const {error:contactError}=await supabase
    .from("atlas_private_contacts")
    .upsert({owner_id:user.id,contact:cleanContact,updated_at:new Date().toISOString()},{onConflict:"owner_id"});
  if(contactError)throw contactError;

  return passport;
}

export async function addMyOpportunity(passportId,{kind,text}){
  const user=await ensureAtlasSession();
  const cleanText=String(text||"").trim();
  if(!passportId)throw fail("passport-required");
  if(!cleanText)throw fail("opportunity-required");

  const {data,error}=await supabase
    .from("atlas_opportunities")
    .insert({
      passport_id:passportId,
      owner_id:user.id,
      kind:String(kind||"other"),
      text:cleanText,
      is_active:true
    })
    .select("id,kind,text,is_active,created_at")
    .single();
  if(error)throw error;
  return data;
}

export async function deleteMyOpportunity(id){
  const user=await ensureAtlasSession();
  const {error}=await supabase
    .from("atlas_opportunities")
    .delete()
    .eq("id",id)
    .eq("owner_id",user.id);
  if(error)throw error;
}

export async function loadPublicPassport(slug){
  if(!supabase)throw fail("supabase-unavailable");
  const {data:passport,error:passportError}=await supabase
    .from("atlas_passports")
    .select("id,slug,display_name,city,created_at")
    .eq("slug",slug)
    .maybeSingle();
  if(passportError)throw passportError;
  if(!passport)return {passport:null,opportunities:[]};

  const {data,error}=await supabase
    .from("atlas_opportunities")
    .select("id,kind,text,created_at")
    .eq("passport_id",passport.id)
    .eq("is_active",true)
    .order("created_at",{ascending:false});
  if(error)throw error;
  return {passport,opportunities:data||[]};
}
