export const SOLUTION_CONTEXT_KEY="atlas:solution-context:v1";
export const EXTERNAL_TARGET="_blank";
export const EXTERNAL_FEATURES="noopener,noreferrer";

export function isInternalAtlasUrl(url){try{const parsed=new URL(url,"https://atlas.local");return parsed.origin==="https://atlas.local"&&parsed.pathname.startsWith("/")}catch{return false}}
export function saveSolutionContext(context,storage=globalThis.sessionStorage){try{storage?.setItem(SOLUTION_CONTEXT_KEY,JSON.stringify({...context,lastInternalPage:context.lastInternalPage||"/solution",savedAt:new Date().toISOString()}));return true}catch{return false}}
export function readSolutionContext(storage=globalThis.sessionStorage){try{return JSON.parse(storage?.getItem(SOLUTION_CONTEXT_KEY)||"null")}catch{return null}}
export function openExternalResource(url,{context=null,open=globalThis.window?.open,storage=globalThis.sessionStorage}={}){if(isInternalAtlasUrl(url))throw new Error("internal-url-must-use-router");if(context)saveSolutionContext(context,storage);const opened=open?.(url,EXTERNAL_TARGET,EXTERNAL_FEATURES);if(opened)try{opened.opener=null}catch{}return {url,target:EXTERNAL_TARGET,rel:"noopener noreferrer"}}
