const LOCATION_WORDS=["аптек","лікар","лікарн","поруч","найближ","маршрут","перевез","достав","евакуатор","шиномонтаж","pharmacy","hospital","nearby","nearest","route","transport","deliver","tow","tire"];
export function shouldShowSolutionMap(goal,location="",mode="planned"){const text=`${typeof goal==="string"?goal:goal?.originalGoal||goal?.normalizedGoal||""} ${location}`.toLowerCase();return mode==="emergency"||Boolean(location.trim())||LOCATION_WORDS.some(word=>text.includes(word))}
export function buildClarifiedQuery(choice,original){return `${String(choice||"").trim()}: ${String(original||"").trim()}`.trim()}
export function resolveSolutionRequest(routeState,storedContext){const routeTask=routeState?.task?.trim();return {task:routeTask||storedContext?.task||"",location:routeTask?(routeState?.where||""):(storedContext?.location||""),mode:routeTask?null:storedContext?.mode||null,expanded:routeTask?{other:false,chain:false,external:false}:storedContext?.expanded||{other:false,chain:false,external:false}}}
export function isActionableResult(result){return Boolean(result&&(result.internalRoute||result.externalUrl||result.mapsUrl||result.phone||result.passportEntryId||result.taskId||result.verifiedContact))}
export function actionableResults(results=[]){return results.filter(isActionableResult)}
export function hasActionableChain(nodes=[]){return nodes.length>0&&nodes.every(isActionableResult)}
export function hasRealRoute(result){return Boolean(result?.destination&&result?.mapsUrl)}
export function hasEntityDetails(result){return Boolean(result&&(result.passportEntryId||result.taskId||result.verifiedContact||result.entityId))}
export function getSolutionVisibility({chain=[],route=null,details=null}={}){return {showChain:hasActionableChain(chain),showRoute:hasRealRoute(route),showDetails:hasEntityDetails(details),showMetrics:false,showDemoRoute:false}}
