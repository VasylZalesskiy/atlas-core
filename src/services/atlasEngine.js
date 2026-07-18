import {parseGoal} from "../brain/GoalParser.js";
import {matchOpportunities} from "../brain/OpportunityMatcher.js";
import {buildChain} from "../brain/ChainBuilder.js";
import demoOpportunities from "../data/demoOpportunities.js";
import demoScenarios from "../data/demoScenarios.js";

function localized(value,lang){return typeof value==="object"&&!Array.isArray(value)?value[lang]||value.uk:value}
function localizeOpportunity(item,lang){return {...item,title:localized(item.title,lang),description:localized(item.description,lang),ownerDisplayName:localized(item.ownerDisplayName,lang),capabilities:item.capabilities.map(value=>localized(value,lang)),resources:item.resources.map(value=>localized(value,lang))}}

/** Створює повний результат Atlas Brain для заданої мети. */
export function buildAtlasSolution(goal,location="",lang="uk"){
  const parsedGoal=parseGoal(goal,lang);
  const catalog=demoOpportunities.map(item=>localizeOpportunity(item,lang));
  const matches=matchOpportunities(parsedGoal.requiredOpportunities,catalog);
  return {...buildChain(matches),goal:parsedGoal,location};
}

function localizeScenario(value,lang){
  if(Array.isArray(value))return value.map(item=>localizeScenario(item,lang));
  if(value&&typeof value==="object"){
    if(Object.prototype.hasOwnProperty.call(value,"uk"))return value[lang]||value.uk;
    return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,localizeScenario(item,lang)]));
  }
  return value;
}

/** Створює рішення для інтерфейсу найшвидшого шляху, не замінюючи planned-ланцюг Atlas 2.1. */
export function buildDecisionSolution(goal,location="",lang="uk",forcedMode=null){
  const atlasResult=buildAtlasSolution(goal,location,lang);
  const parsedGoal=atlasResult.goal;
  if(forcedMode==="emergency"&&parsedGoal.urgencyLevel!=="emergency")return {...localizeScenario(demoScenarios["medical-emergency"],lang),goal:parsedGoal,location,mode:"emergency",atlasResult};
  const demo=demoScenarios[parsedGoal.scenario];
  if(demo&&["emergency","quick"].includes(demo.mode))return {...localizeScenario(demo,lang),goal:parsedGoal,location,mode:forcedMode||demo.mode,atlasResult};
  const selected=atlasResult.chain.find(step=>step.selected)?.selected;
  const planned={mode:"planned",title:lang==="uk"?"Планове рішення":"Planned solution",warning:"",bestAction:lang==="uk"?"Почніть із першої знайденої можливості та рухайтеся ланцюгом.":"Start with the first matched opportunity and follow the chain.",primaryOption:{title:selected?.title||atlasResult.chain[0]?.requirement.title,subtitle:selected?.description||"",status:lang==="uk"?"Демонстраційний збіг Atlas":"Atlas demo match"},alternatives:atlasResult.alternatives.slice(0,3).map(({candidate})=>({title:candidate.title,meta:`${candidate.city} · ${candidate.distanceKm} km · ${candidate.trustScore}%`})),metrics:{firstActionMinutes:Math.max(10,atlasResult.metrics.estimatedDays*15),distanceKm:atlasResult.metrics.totalDistanceKm,totalMinutes:atlasResult.metrics.estimatedDays*24*60,trustScore:atlasResult.metrics.averageTrustScore/10,completeness:atlasResult.metrics.completeness},steps:atlasResult.chain.map(step=>step.requirement.title),route:{distanceKm:atlasResult.metrics.totalDistanceKm,minutes:Math.max(10,atlasResult.metrics.estimatedDays*15)},contactPolicy:lang==="uk"?"Контакти демонстраційні та доступні після підтвердження участі.":"Contacts are demonstrational and available after participation confirmation."};
  return {...planned,mode:forcedMode||parsedGoal.urgencyLevel,goal:parsedGoal,location,atlasResult};
}
