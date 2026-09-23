import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteRepository, loadFixtures } from "../lib/server/database";
import { initialPlan, focusTarget, planSchema, type Plan } from "../lib/career/planning";
import { development } from "../lib/career/skills";

const data = loadFixtures();
const employee = data.employees[0];
const actor = { accessRole: "employee" as const, employeeId: employee.employee_id };
const freePlan: Plan = { goals: [{ id: "own", wording: "Lead a community project", target: null, origin: "employee" }], focusId: "own", milestones: [{ id: "m1", goalId: "own", outcome: "First workshop", criterion: "Five participants give feedback", actions: "Prepare workshop", evidence: "", state: "planned", origin: "employee" }] };

test("free-form goals persist across reopen, stale edits fail and source skills stay untouched", () => {
  const dir = mkdtempSync(join(tmpdir(), "planning-"));
  let store = new SqliteRepository(join(dir, "db.sqlite"));
  try {
    const before = store.read();
    store.savePlanning(actor, employee.employee_id, 1, 0, freePlan);
    store.close(); store = new SqliteRepository(join(dir, "db.sqlite"));
    assert.deepEqual(store.planning(employee.employee_id).plan, freePlan);
    assert.equal(focusTarget(freePlan), null);
    assert.throws(() => store.savePlanning(actor, employee.employee_id, 1, 0, freePlan), /Plan changed/);
    assert.throws(() => store.savePlanning(actor, employee.employee_id, 2, 1, freePlan), /Dataset changed/);
    const reached = structuredClone(freePlan); reached.milestones[0].state = "reached";
    store.savePlanning(actor, employee.employee_id, 1, 1, reached);
    assert.deepEqual(store.read(), before);
    store.reset(1);
    assert.equal(store.planning(employee.employee_id).revision, 0);
    assert.deepEqual(store.planning(employee.employee_id).plan, initialPlan(employee));
  } finally { store.close(); rmSync(dir, { recursive: true }); }
});

test("planning enforces ownership, attribution, references and nonblank criteria", () => {
  const store = new SqliteRepository(":memory:");
  try {
    assert.throws(() => store.savePlanning({ accessRole: "hr", employeeId: null }, employee.employee_id, 1, 0, freePlan), /Forbidden/);
    assert.throws(() => store.savePlanning(actor, "E0002", 1, 0, freePlan), /Forbidden/);
    const forged = structuredClone(freePlan); forged.goals[0].origin = "imported";
    assert.throws(() => store.savePlanning(actor, employee.employee_id, 1, 0, forged), /origin/);
    const bad = structuredClone(freePlan); bad.milestones[0].criterion = "   ";
    assert.equal(planSchema.safeParse(bad).success, false);
    bad.milestones[0].criterion = "done"; bad.milestones[0].goalId = "unknown";
    assert.equal(planSchema.safeParse(bad).success, false);
    assert.equal(store.planning(employee.employee_id).revision, 0);
  } finally { store.close(); }
});

test("course gains can meet a threshold without closing an assessment module", () => {
  const profile = { ...employee, skills: { SK_PYTHON: 2 }, last_review_date: "2026-01-01", career_goal: { target_role: employee.role, target_grade: employee.grade } };
  const fixture = { ...data, role_profiles: [{ role: employee.role, grade: employee.grade, required_skills: { SK_PYTHON: 3 }, critical_skills: ["SK_PYTHON"] }], events: [{ ...data.events[0], develops_skills: [{ skill_id: "SK_PYTHON", gain: 1, max_level: 5 }] }], history: [{ ...data.history[0], employee_id: employee.employee_id, event_id: data.events[0].event_id, date: "2026-02-01", status: "completed" as const }] };
  const result = development(profile, fixture);
  assert.equal(result.gaps[0].level, 3); assert.equal(result.gaps[0].gap, 0);
  assert.equal(result.gaps[0].closed, false); assert.equal(result.coverage, 0);
  assert.equal(development({ ...profile, career_goal: null }, fixture).coverage, null);
});


test("linked activities persist without changing assessment facts and reject unknown references", () => {
  const store = new SqliteRepository(":memory:");
  try {
    const before = store.read();
    const plan = structuredClone(freePlan);
    plan.milestones[0].activityIds = [data.events[0].event_id];
    store.savePlanning(actor, employee.employee_id, 1, 0, plan);
    assert.deepEqual(store.planning(employee.employee_id).plan.milestones[0].activityIds, [data.events[0].event_id]);
    assert.deepEqual(store.read(), before);
    plan.milestones[0].activityIds = ["unknown-event"];
    assert.throws(() => store.savePlanning(actor, employee.employee_id, 1, 1, plan), /Unknown activity reference/);
    assert.equal(store.planning(employee.employee_id).revision, 1);
  } finally { store.close(); }
});
