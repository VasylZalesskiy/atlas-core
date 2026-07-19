const marketplaceConfigs={general:{id:"general",title:"Marketplace",domain:"prom.ua"},wholesale:{id:"wholesale",title:"Wholesale",domain:"all.biz"},agriculture:{id:"agriculture",title:"Agriculture",domain:"agroserver.ua"},retail:{id:"retail",title:"Retail",domain:"bigl.ua"}};
const classifiedsConfigs={general:{id:"general",title:"Classifieds",domain:"olx.ua"},local:{id:"local",title:"Local classifieds",domain:"besplatka.ua"},agriculture:{id:"agriculture",title:"Agricultural classifieds",domain:"agrotorg.net"}};
function safeHttps(url){const parsed=new URL(url);if(parsed.protocol!=="https:")throw new Error("https-required");return parsed.toString()}
function terms(query,location){return [query,location].filter(Boolean).join(" ").trim()}
function google(query){return safeHttps(`https://www.google.com/search?${new URLSearchParams({q:query})}`)}
export function buildMapsSearchUrl(query,location=""){return safeHttps(`https://www.google.com/maps/search/?${new URLSearchParams({api:"1",query:terms(query,location)})}`)}
export function buildWebSearchUrl(query,location=""){return google(terms(query,location))}
export function buildMarketplaceSearchUrl(providerId,query,location=""){const config=marketplaceConfigs[providerId];if(!config)throw new Error("unknown-marketplace-provider");return google(`site:${config.domain} ${terms(query,location)}`)}
export function buildClassifiedsSearchUrl(providerId,query,location=""){const config=classifiedsConfigs[providerId];if(!config)throw new Error("unknown-classifieds-provider");return google(`site:${config.domain} ${terms(query,location)}`)}
export {marketplaceConfigs,classifiedsConfigs,safeHttps};
