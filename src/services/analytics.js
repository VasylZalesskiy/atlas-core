import {track} from "@vercel/analytics";
import {recordAtlasActivity} from "./activityStore";

/**
 * Public product analytics only. Never pass task text, contacts, message bodies,
 * or coordinates to Vercel Analytics.
 */
export function trackAtlas(event,properties={}){
  try{
    track(event,properties);
  }catch{
    // Analytics must never interrupt a user's task.
  }
  recordAtlasActivity(event,{meta:properties});
}

/**
 * Private owner-only activity log. Use this for useful product context such as
 * search text. Never store private chat bodies, contacts, passwords or precise coordinates.
 */
export function trackAtlasActivity(event,{label="",path="",meta={}}={}){
  recordAtlasActivity(event,{label,path,meta});
}
