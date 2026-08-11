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
