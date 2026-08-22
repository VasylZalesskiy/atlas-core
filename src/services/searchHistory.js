const STORAGE_KEY="atlas.search-history.v1";
const MAX_ITEMS=12;

function clean(value){
  return String(value||"").replace(/\s+/g," ").trim();
}

function readStored(){
  if(typeof window==="undefined")return [];
  try{
    const parsed=JSON.parse(window.localStorage.getItem(STORAGE_KEY)||"[]");
    return Array.isArray(parsed)?parsed:[];
  }catch{
    return [];
  }
}

function publish(){
  if(typeof window!=="undefined")window.dispatchEvent(new Event("atlas-search-history"));
}

export function listSearchHistory(){
  return readStored()
    .filter(item=>item&&clean(item.task))
    .slice(0,MAX_ITEMS);
}

export function saveSearchHistory({task,where=""}){
  if(typeof window==="undefined")return [];
  const cleanTask=clean(task);
  const cleanWhere=clean(where);
  if(!cleanTask)return listSearchHistory();

  const key=`${cleanTask.toLocaleLowerCase("uk-UA")}|${cleanWhere.toLocaleLowerCase("uk-UA")}`;
  const next=[
    {id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`,task:cleanTask,where:cleanWhere,createdAt:new Date().toISOString()},
    ...readStored().filter(item=>`${clean(item.task).toLocaleLowerCase("uk-UA")}|${clean(item.where).toLocaleLowerCase("uk-UA")}`!==key)
  ].slice(0,MAX_ITEMS);
  window.localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
  publish();
  return next;
}

export function clearSearchHistory(){
  if(typeof window!=="undefined")window.localStorage.removeItem(STORAGE_KEY);
  publish();
}

export function solutionUrl(task,where=""){
  const params=new URLSearchParams({q:clean(task)});
  const cleanWhere=clean(where);
  if(cleanWhere)params.set("where",cleanWhere);
  return `/solution?${params.toString()}`;
}
