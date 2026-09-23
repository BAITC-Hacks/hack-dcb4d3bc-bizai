import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadFixtures, SqliteRepository } from "../lib/server/database";
import { mergeImport, parseHistory } from "../lib/career/import";
import { development, effectiveSkills } from "../lib/career/skills";
import { eligibility } from "../lib/career/eligibility";
import { canReadEmployee, isHr } from "../lib/server/access";

const data = loadFixtures();

test("supplied dataset loads and all 200 profiles have a target calculation", () => {
  assert.deepEqual([data.employees.length, data.events.length, data.skills.length, data.history.length], [200, 40, 60, 2743]);
  for (const employee of data.employees) {
    const result = development(employee, data);
    assert.ok(result.coverage >= 0 && result.coverage <= 100);
    assert.ok(result.gaps.length);
    assert.deepEqual(employee.skills, data.employees.find(e => e.employee_id === employee.employee_id)!.skills);
  }
});

test("replay honors review cutoff, missing skills, caps and immutable assessment", () => {
  const employee = { ...data.employees[0], last_review_date: "2026-09-01", skills: { SK_PYTHON: 4 } };
  const event = { ...data.events[0], develops_skills: [{ skill_id: "SK_PYTHON", gain: 1, max_level: 2 }, { skill_id: "SK_SQL", gain: 1, max_level: 5 }] };
  const row = { ...data.history[0], employee_id: employee.employee_id, event_id: event.event_id, status: "completed" as const, completion_pct: 100 };
  const fixture = { ...data, events: [event], history: [{ ...row, record_id: "before", date: "2026-09-01" }, { ...row, record_id: "after", date: "2026-09-02" }] };
  assert.deepEqual(effectiveSkills(employee, fixture), { SK_PYTHON: 4, SK_SQL: 1 });
  assert.deepEqual(employee.skills, { SK_PYTHON: 4 });
});

test("explicit cross-role goals, default next grade, and Lead without a goal", () => {
  const cross = data.employees.find(e => e.career_goal && e.career_goal.target_role !== e.role)!;
  assert.equal(development(cross, data).target.target_role, cross.career_goal!.target_role);
  assert.equal(development({ ...data.employees[0], grade: "Junior", career_goal: null }, data).target.target_grade, "Middle");
  const lead = data.employees.find(e => e.grade === "Lead")!;
  assert.equal(development({ ...lead, career_goal: null }, data).targetSource, "goal_unset");
});

test("CSV handles optional blanks, quoted cells, invalid dates and status mismatch", () => {
  const header = "record_id,employee_id,event_id,date,due_date,status,completion_pct,score,feedback_rating,assigned_by\n";
  const row = '"test,1",E0001,EV_001,2026-09-01,,completed,100,,,self';
  const parsed = parseHistory(header + row)[0];
  assert.equal(parsed.record_id, "test,1");
  assert.equal(parsed.score, null); assert.equal(parsed.feedback_rating, null); assert.equal(parsed.due_date, null);
  assert.throws(() => parseHistory(header + row.replace("2026-09-01", "2026-02-30")), /Invalid calendar date/);
  assert.throws(() => parseHistory(header + row.replace("completed,100", "completed,95")), /completion_pct/);
  assert.throws(() => parseHistory(header + row.replace("completed,100", "completed,")), /completion_pct/);
});

test("imports are idempotent, reject conflicts, and validate merged references", () => {
  const envelope = (employees: typeof data.employees) => JSON.stringify({ meta: data.meta, employees });
  const unchanged = mergeImport(data, { employees: envelope(data.employees) });
  assert.equal(unchanged.summary.employeesAdded, 0);
  assert.equal(unchanged.summary.employeesUnchanged, 200);
  const reordered = { ...data.employees[0], skills: Object.fromEntries(Object.entries(data.employees[0].skills).reverse()) };
  assert.equal(mergeImport(data, { employees: envelope([reordered]) }).summary.employeesUnchanged, 1);
  assert.throws(() => mergeImport(data, { employees: envelope([{ ...data.employees[0], full_name: "Changed" }]) }), /Conflicting duplicate/);
  assert.throws(() => mergeImport(data, { employees: envelope([{ ...data.employees[0], employee_id: "NEW", manager_id: "MISSING" }]) }), /manager/);
  const result = mergeImport(data, { employees: envelope([{ ...data.employees[0], employee_id: "NEW" }]) });
  assert.equal(result.data.employees.length, 201);
});

test("eligibility excludes mandatory, completed and active events but allows repeated club attendance", () => {
  const employee = data.employees[0];
  const event = { ...data.events[0], mandatory: false, target_roles: [employee.role], target_grades: [employee.grade], prerequisites: {}, format: "self_paced" as const };
  const row = { ...data.history[0], employee_id: employee.employee_id, event_id: event.event_id, status: "completed" as const };
  const fixture = { ...data, history: [row] };
  assert.ok(eligibility(employee, event, fixture).includes("Already completed"));
  assert.deepEqual(eligibility(employee, { ...event, event_id: "EV_036" }, { ...fixture, history: [{ ...row, event_id: "EV_036" }] }), []);
  assert.ok(eligibility(employee, event, { ...fixture, history: [{ ...row, status: "in_progress" }] }).includes("Already in progress"));
  assert.ok(eligibility(employee, { ...event, mandatory: true }, fixture).some(reason => reason.startsWith("Mandatory")));
});

test("employee access is scoped independently of job role", () => {
  const actor = { accessRole: "employee" as const, employeeId: "E0001" };
  assert.equal(canReadEmployee(actor, "E0001"), true);
  assert.equal(canReadEmployee(actor, "E0002"), false);
  assert.equal(canReadEmployee(null, "E0001"), false);
  assert.equal(isHr(actor), false);
  assert.equal(canReadEmployee({ accessRole: "hr", employeeId: null }, "E0002"), true);
});

test("SQLite persists imports, rolls back invalid writes and rejects stale previews", () => {
  const directory = mkdtempSync(join(tmpdir(), "career-quest-test-"));
  const path = join(directory, "test.sqlite");
  const first = new SqliteRepository(path);
  const second = new SqliteRepository(path);
  const input = { employees: JSON.stringify({ meta: data.meta, employees: [{ ...data.employees[0], employee_id: "NEW" }] }) };
  try {
    assert.equal(first.import(input, 1).revision, 2);
    assert.equal(second.read().data.employees.length, 201);
    assert.throws(() => second.import(input, 1), /Dataset changed/);
    assert.throws(() => first.import({ employees: JSON.stringify({ meta: data.meta, employees: [{ ...data.employees[0], full_name: "Conflict" }] }) }, 2), /Conflicting duplicate/);
    assert.equal(first.read().revision, 2);
    first.createSession("token", "employee", "NEW");
    assert.equal(second.session("token")?.employeeId, "NEW");
    first.deleteSession("token"); assert.equal(second.session("token"), undefined);
  } finally { first.close(); second.close(); rmSync(directory, { recursive: true }); }
});
