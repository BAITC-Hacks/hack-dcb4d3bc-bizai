import test from "node:test";
import assert from "node:assert/strict";
import { SqliteRepository, loadFixtures } from "../lib/server/database";
import { effectiveSkills, development, skillAssessments } from "../lib/career/skills";
import type { Actor } from "../lib/server/access";
import type { ReviewCycle, ReviewDecisionCommand } from "../lib/career/reviews";

const owner: Actor = { accessRole: "employee", employeeId: "E0137" };
const manager: Actor = { accessRole: "employee", employeeId: "E0050" };
const hr: Actor = { accessRole: "hr", employeeId: null };
function seed() {
  const data = loadFixtures();
  const employee = data.employees.find(e => e.employee_id === owner.employeeId)!;
  Object.assign(employee, { manager_id: manager.employeeId, skills: { SK_SYSTEM_DESIGN: 2, SK_PYTHON: 2 }, last_review_date: "2026-06-01", career_goal: { target_role: "Backend Engineer", target_grade: "Senior" } });
  const target = data.role_profiles.find(p => p.role === "Backend Engineer" && p.grade === "Senior")!;
  target.required_skills = { SK_SYSTEM_DESIGN: 4 }; target.critical_skills = ["SK_SYSTEM_DESIGN"];
  data.events = ["HISTORY", "BEFORE", "AFTER"].map(id => ({ ...data.events[0], event_id: id, mandatory: false, format: "self_paced" as const, prerequisites: {}, target_roles: [employee.role], target_grades: [employee.grade], develops_skills: [{ skill_id: "SK_SYSTEM_DESIGN", gain: 1, max_level: 5 }, { skill_id: "SK_PYTHON", gain: 1, max_level: 5 }] }));
  data.history = [{ record_id: "H1", employee_id: employee.employee_id, event_id: "HISTORY", date: "2026-06-20", status: "completed", due_date: null, completion_pct: 100, score: null, feedback_rating: null, assigned_by: "self" }];
  return data;
}
function submit(repo: SqliteRepository, quarter = "2026-Q3") {
  const current = repo.read();
  const draft = repo.createReview(owner, quarter, current.revision, 0);
  return repo.updateReview(owner, draft.id, draft.revision, current.revision, "submit", draft.items.map(i => ({ ...i, selfRating: 4, justification: "Designed and delivered an independently reviewed service." })));
}
function decision(repo: SqliteRepository, review: ReviewCycle, action: "approve" | "return" = "approve"): ReviewDecisionCommand {
  return { action, employeeId: owner.employeeId!, id: review.id, revision: review.revision, datasetRevision: repo.read().revision, commandId: crypto.randomUUID(), ratings: action === "approve" ? [{ skillId: "SK_SYSTEM_DESIGN", finalRating: 3 }] : [], comment: "Reviewed the documented outcome and ownership." };
}

test("HR approval updates only reviewed skills, absorbs included gains and replays later completions once", () => {
  const repo = new SqliteRepository(":memory:", seed);
  try {
    const original = repo.read().data.employees.find(e => e.employee_id === owner.employeeId)!;
    repo.completeActivity(owner, "BEFORE", 1, 0);
    const review = submit(repo);
    repo.completeActivity(owner, "AFTER", repo.read().revision, 0);
    const command = decision(repo, review);
    const approved = repo.decideReview(hr, command);
    assert.equal(approved.status, "approved"); assert.equal(approved.decision?.calibration, "not_run");
    const snapshot = repo.read(), employee = snapshot.data.employees.find(e => e.employee_id === owner.employeeId)!;
    assert.deepEqual(employee, original); // Raw assessment and grade never change.
    assert.deepEqual(effectiveSkills(employee, snapshot.data), { SK_SYSTEM_DESIGN: 4, SK_PYTHON: 5 });
    assert.equal(skillAssessments(employee, snapshot.data).values.SK_SYSTEM_DESIGN, 3);
    assert.equal(development(employee, snapshot.data).closed, 0); // Effective 4 is not approved 4.
    assert.equal(repo.decideReview(hr, command).revision, approved.revision);
    assert.equal(repo.read().revision, snapshot.revision);
    assert.equal(repo.read().data.approved_assessments?.length, 1);
    assert.throws(() => repo.decideReview(hr, { ...command, comment: "Different retry" }), /Context changed/);
    assert.throws(() => repo.updateReview(owner, review.id, approved.revision, snapshot.revision, "reopen", []), /Invalid review transition/);
  } finally { repo.close(); }
});

test("return records a comment without applying ratings and employee resubmission preserves every opinion", () => {
  const repo = new SqliteRepository(":memory:", seed);
  try {
    const review = submit(repo), version = repo.read().revision;
    const returned = repo.decideReview(manager, decision(repo, review, "return"));
    assert.equal(returned.status, "returned");
    assert.equal(repo.read().revision, version); assert.deepEqual(repo.read().data.approved_assessments, []);
    const reopened = repo.updateReview(owner, review.id, returned.revision, version, "reopen", []);
    assert.equal(reopened.decision, null);
    const resubmitted = repo.updateReview(owner, review.id, reopened.revision, version, "submit", reopened.items);
    const command = decision(repo, resubmitted); command.ratings[0].finalRating = 4;
    repo.decideReview(manager, command);
    const snapshot = repo.read(), employee = snapshot.data.employees.find(e => e.employee_id === owner.employeeId)!;
    assert.equal(development(employee, snapshot.data).coverage, 100);
    assert.equal(employee.grade, "Middle");
    assert.ok(repo.reviews(hr, employee.employee_id).some(r => r.decision?.type === "return"));
    assert.ok(repo.reviews(hr, employee.employee_id).some(r => r.status === "submitted" && !r.decision));
  } finally { repo.close(); }
});

test("decisions reject unauthorized actors, incomplete ratings, stale submissions and conflicting approvals", () => {
  const repo = new SqliteRepository(":memory:", seed);
  try {
    const review = submit(repo), command = decision(repo, review);
    assert.throws(() => repo.decideReview(owner, command), /Forbidden/);
    assert.throws(() => repo.decideReview({ accessRole: "employee", employeeId: "E0001" }, command), /Forbidden/);
    assert.throws(() => repo.decideReview(hr, { ...command, ratings: [] }), /frozen target/);
    assert.throws(() => repo.decideReview(hr, { ...command, ratings: [command.ratings[0], command.ratings[0]] }), /frozen target/);
    assert.throws(() => repo.decideReview(hr, { ...command, comment: " \n " }));
    assert.throws(() => repo.decideReview(hr, { ...command, revision: 1 }), /Context changed/);
    assert.throws(() => repo.decideReview(hr, { ...command, action: "return" }), /Return must not/);
    repo.decideReview(manager, command);
    assert.throws(() => repo.decideReview(hr, { ...command, commandId: crypto.randomUUID() }), /Context changed/);
  } finally { repo.close(); }
});

test("older submissions cannot overwrite a newer accepted assessment, and reset hides decision overlays", () => {
  const repo = new SqliteRepository(":memory:", seed);
  try {
    const old = submit(repo, "2026-Q2"), recent = submit(repo, "2026-Q3");
    repo.decideReview(hr, decision(repo, recent));
    assert.throws(() => repo.decideReview(hr, decision(repo, old)), /Assessment changed/);
    repo.decideReview(hr, decision(repo, old, "return")); // Can still request a correction.
    repo.reset(repo.read().revision);
    assert.deepEqual(repo.read().data.approved_assessments, []);
    assert.deepEqual(repo.reviews(hr, owner.employeeId!), []);
  } finally { repo.close(); }
});
