import test from "node:test";
import assert from "node:assert/strict";
import { mapReturnPath } from "../lib/career/navigation";

test("activity return preserves map context and rejects external or unrelated destinations", () => {
  assert.equal(mapReturnPath("/employee/dashboard?view=skills&mapQuery=Cloud&mapSkill=SK_CLOUD&mapDetails=open"), "/employee/dashboard?view=skills&mapQuery=Cloud&mapSkill=SK_CLOUD&mapDetails=open#trajectory");
  for (const url of [undefined, "https://example.com", "//example.com", "/hr/employees/E0001", "/employee/dashboard?view=plan", "/employee/dashboard/../learning?view=skills"]) assert.equal(mapReturnPath(url), null);
  assert.equal(mapReturnPath("/employee/dashboard?mapFilter=critical&unrelated=value"), "/employee/dashboard?mapFilter=critical#trajectory");
});
