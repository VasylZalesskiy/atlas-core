import test from "node:test";
import assert from "node:assert/strict";
import {evaluatePilotStatus} from "../src/services/pilotStatus.js";

test("building pilot can be stopped immediately",()=>{
  const status=evaluatePilotStatus({enabled:false,starts_at:null,ends_at:null},new Date("2026-08-22T12:00:00Z"));
  assert.equal(status.active,false);
  assert.equal(status.beforeStart,false);
  assert.equal(status.afterEnd,false);
});

test("building pilot respects a server-controlled time window",()=>{
  const row={enabled:true,starts_at:"2026-08-22T10:00:00Z",ends_at:"2026-08-22T14:00:00Z"};
  assert.equal(evaluatePilotStatus(row,new Date("2026-08-22T09:00:00Z")).beforeStart,true);
  assert.equal(evaluatePilotStatus(row,new Date("2026-08-22T12:00:00Z")).active,true);
  assert.equal(evaluatePilotStatus(row,new Date("2026-08-22T15:00:00Z")).afterEnd,true);
});
