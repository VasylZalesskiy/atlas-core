import test from "node:test";
import assert from "node:assert/strict";
import {createFallbackPlan} from "../src/services/atlasBrain.js";

test("fallback planner sends a bare 100 kg product need to stores and marketplaces",()=>{
  const plan=createFallbackPlan("100 кг гороху",{lang:"uk"});
  assert.equal(plan.intent,"buy");
  assert.equal(plan.solution_scope,"transaction");
  assert.equal(plan.needs_location,true);
  assert.match(plan.solution_steps[0].nearby_query,/горох магазин/);
  assert.equal(plan.external_searches.find(item=>item.source==="marketplace")?.query,"купити 100 кг гороху");
  assert.equal(plan.external_searches.find(item=>item.source==="maps")?.mode,"nearby");
});

test("fallback planner triages a bodily symptom before searching",()=>{
  const plan=createFallbackPlan("болить живіт",{lang:"uk"});
  assert.equal(plan.domain,"health");
  assert.equal(plan.clarification.required,true);
  assert.match(plan.clarification.question,/небезпечна ознака/i);
  assert.equal(plan.external_searches.length,0);
  assert.equal(plan.direct_action,undefined);
});

test("health warning signs lead to one emergency action instead of web search",()=>{
  const plan=createFallbackPlan("болить живіт, Так, є хоча б одна",{lang:"uk"});
  assert.equal(plan.clarification.required,false);
  assert.equal(plan.direct_action.type,"emergency");
  assert.equal(plan.direct_action.primary_href,"tel:103");
  assert.equal(plan.direct_action.secondary_href,"tel:112");
  assert.equal(plan.external_searches.length,0);
});

test("strong or worsening pain leads to care today and nearby medical search only",()=>{
  const plan=createFallbackPlan("болить живіт, Ні, але біль сильний або посилюється",{lang:"uk"});
  assert.equal(plan.direct_action.type,"find_care");
  assert.match(plan.direct_action.title,/сьогодні/i);
  assert.deepEqual(plan.external_searches.map(item=>item.source),["maps"]);
  assert.equal(plan.solution_steps[0].internet_relevant,false);
});

test("mild non-worsening pain leads to a family doctor rather than Google Search",()=>{
  const plan=createFallbackPlan("болить живіт, Ні, біль легкий і не посилюється",{lang:"uk"});
  assert.match(plan.direct_action.title,/сімейним лікарем/i);
  assert.deepEqual(plan.external_searches.map(item=>item.source),["maps"]);
  assert.equal(plan.solution_steps[0].internet_query,"");
});
