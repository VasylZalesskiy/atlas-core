import test from "node:test";
import assert from "node:assert/strict";
import {solutionUrl} from "../src/services/searchHistory.js";

test("solution URL keeps the task and location for navigation and refresh",()=>{
  const url=solutionUrl("  Потрібні 20 кг томатів "," Тернопіль ");
  assert.equal(url,"/solution?q=%D0%9F%D0%BE%D1%82%D1%80%D1%96%D0%B1%D0%BD%D1%96+20+%D0%BA%D0%B3+%D1%82%D0%BE%D0%BC%D0%B0%D1%82%D1%96%D0%B2&where=%D0%A2%D0%B5%D1%80%D0%BD%D0%BE%D0%BF%D1%96%D0%BB%D1%8C");
});
