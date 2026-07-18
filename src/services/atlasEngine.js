import {parseGoal} from "../brain/GoalParser.js";
import {matchOpportunities} from "../brain/OpportunityMatcher.js";
import {buildChain} from "../brain/ChainBuilder.js";
import demoOpportunities from "../data/demoOpportunities.js";

function localized(value,lang){return typeof value==="object"&&!Array.isArray(value)?value[lang]||value.uk:value}
function localizeOpportunity(item,lang){return {...item,title:localized(item.title,lang),description:localized(item.description,lang),ownerDisplayName:localized(item.ownerDisplayName,lang),capabilities:item.capabilities.map(value=>localized(value,lang)),resources:item.resources.map(value=>localized(value,lang))}}

/** Створює повний результат Atlas Brain для заданої мети. */
export function buildAtlasSolution(goal,location="",lang="uk"){
  const parsedGoal=parseGoal(goal,lang);
  const catalog=demoOpportunities.map(item=>localizeOpportunity(item,lang));
  const matches=matchOpportunities(parsedGoal.requiredOpportunities,catalog);
  return {...buildChain(matches),goal:parsedGoal,location};
}
