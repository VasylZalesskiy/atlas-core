import {track} from "@vercel/analytics";

/**
 * Product analytics only. Never pass task text, contacts, or coordinates here.
 * Search text is handled server-side with explicit redaction and retention in
 * Vercel runtime logs so daily reports remain possible without exposing it to
 * client-side analytics dimensions.
 */
export function trackAtlas(event,properties={}){
  try{
    track(event,properties);
  }catch{
    // Analytics must never interrupt a user's task.
  }
}
