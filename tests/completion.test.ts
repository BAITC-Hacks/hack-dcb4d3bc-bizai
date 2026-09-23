import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteRepository } from "../lib/server/database";
import { effectiveSkills, development } from "../lib/career/skills";
const actor = { accessRole: "employee" as const, employeeId: "E0001" };

test("completion persists exact gains once across retries and repository instances without rewriting assessments", () => {
  const dir = mkdtempSync(join(tmpdir(), "completion-"));
  const store = new SqliteRepository(join(dir, "db.sqlite"));
  const other = new SqliteRepository(join(dir, "db.sqlite"));
  try {
    const original = store.read(); const employee = original.data.employees[0];
    const result = store.completeActivity(actor, "EV_005", original.revision, 0);
    assert.deepEqual(result.completion.before, { SK_SYSTEM_DESIGN: 1, SK_API_DESIGN: 2 });
    assert.deepEqual(result.completion.after, { SK_SYSTEM_DESIGN: 2, SK_API_DESIGN: 3 });
    assert.ok(result.completion.completed_at.endsWith("Z"));
    assert.equal(result.completion.business_date, original.data.meta.as_of_date);
    assert.equal(other.completeActivity(actor, "EV_005", original.revision, 0).repeated, true);
    const next = other.read();
    assert.equal(next.revision, original.revision + 1);
    assert.equal(next.data.history.length, original.data.history.length + 1);
    assert.deepEqual(next.data.employees, original.data.employees);
    assert.equal(effectiveSkills(employee, next.data).SK_API_DESIGN, 3);
    assert.equal(development(employee, next.data).closed, development(employee, original.data).closed);
    const api = development(employee, next.data).gaps.find(g => g.id === "SK_API_DESIGN")!;
    assert.equal(api.gap, 0); assert.equal(api.closed, false);
    // A no-op source merge must not persist the materialized completion into raw history.
    store.import({ employees: JSON.stringify({ meta: original.data.meta, employees: [employee] }) }, next.revision);
    assert.equal(store.read().data.history.length, original.data.history.length + 1);
    assert.equal(effectiveSkills(employee, store.read().data).SK_API_DESIGN, 3);
    store.reset(store.read().revision);
    assert.equal(store.read().data.demo_completions?.length, 0);
  } finally { other.close(); store.close(); rmSync(dir, { recursive: true }); }
});

test("completion enforces role, eligibility and context revisions atomically", () => {
  const store = new SqliteRepository(":memory:");
  try {
    assert.throws(() => store.completeActivity({ accessRole: "hr", employeeId: null }, "EV_005", 1, 0), /Forbidden/);
    assert.throws(() => store.completeActivity(actor, "EV_005", 99, 0), /Context changed/);
    assert.throws(() => store.completeActivity(actor, "EV_005", 1, 99), /Context changed/);
    assert.throws(() => store.completeActivity(actor, "EV_001", 1, 0), /not eligible/);
    assert.throws(() => store.completeActivity(actor, "UNKNOWN", 1, 0), /not found/);
    assert.equal(store.read().revision, 1);
    assert.equal(store.read().data.demo_completions?.length, 0);
  } finally { store.close(); }
});
