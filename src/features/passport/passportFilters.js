export function filterPassportEntries(entries,{status="all",category="all",query=""}={}){
  const needle=query.trim().toLocaleLowerCase();
  return entries.filter(entry=>(status==="all"||entry.status===status)&&(category==="all"||entry.category===category)&&(!needle||[entry.title,entry.description,entry.category,entry.customCategory].some(value=>String(value||"").toLocaleLowerCase().includes(needle))));
}
