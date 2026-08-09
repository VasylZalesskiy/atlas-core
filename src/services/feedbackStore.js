import supabase from "./supabase";
import {ensureAtlasSession} from "./passportStore";

export async function saveAtlasFeedback(message,lang="uk"){
  const clean=String(message||"").trim();
  if(clean.length<2)throw new Error("feedback-required");
  if(clean.length>2000)throw new Error("feedback-too-long");

  const user=await ensureAtlasSession();
  const {error}=await supabase
    .from("atlas_feedback")
    .insert({
      user_id:user.id,
      message:clean,
      lang:String(lang||"uk").slice(0,8),
      page_url:window.location.href
    });
  if(error)throw error;
}
