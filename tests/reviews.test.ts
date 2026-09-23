import test from "node:test";
import assert from "node:assert/strict";
import { SqliteRepository, loadFixtures } from "../lib/server/database";
import { canReadReview, previousQuarter } from "../lib/career/reviews";
import type { Actor } from "../lib/server/access";

const data = loadFixtures();
const employee = data.employees.find(e => e.career_goal && e.manager_id)!;
const owner: Actor = { accessRole: "employee", employeeId: employee.employee_id };
const manager: Actor = { accessRole: "employee", employeeId: employee.manager_id };
const peer: Actor = { accessRole: "employee", employeeId: data.employees.find(e => e.employee_id !== employee.employee_id && e.employee_id !== employee.manager_id)!.employee_id };
const hr: Actor = { accessRole: "hr", employeeId: null };

test("reviews derive manager access from current direct reports, preserving own employee scope", () => {
  const repo = new SqliteRepository(":memory:");
  try {
    const review = repo.createReview(owner, "2026-Q3", 1, 0);
    assert.equal(repo.createReview(owner, "2026-Q3", 1, 0).id, review.id);
    assert.equal(repo.reviews(manager, employee.employee_id).length, 1);
    assert.equal(repo.reviews(hr, employee.employee_id).length, 1);
    assert.throws(() => repo.reviews(peer, employee.employee_id), /Forbidden/);
    assert.throws(() => repo.updateReview(manager, review.id, 1, 1, "save", review.items), /Forbidden/);
    assert.throws(() => repo.updateReview(hr, review.id, 1, 1, "save", review.items), /Forbidden/);
    assert.equal(canReadReview(manager, { ...employee, manager_id: peer.employeeId }), false);
    assert.equal(canReadReview({ accessRole: "employee", employeeId: null }, { ...employee, manager_id: null }), false);
    assert.equal(canReadReview(owner, employee), true);
    assert.equal(review.target.proficiencyScale?.["5"], data.proficiency_scale?.["5"]);
  } finally { repo.close(); }
});

test("submission requires every target rating and justification, freezes evidence and supports an editable new revision", () => {
  const repo = new SqliteRepository(":memory:");
  try {
    const review = repo.createReview(owner, "2026-Q3", 1, 0);
    assert.throws(() => repo.updateReview(owner, review.id, 1, 1, "submit", review.items), /Every skill/);
    const whitespace = review.items.map(i => ({ ...i, selfRating: 3, justification: " \n " }));
    assert.throws(() => repo.updateReview(owner, review.id, 1, 1, "submit", whitespace), /Every skill/);
    assert.throws(() => repo.updateReview(owner, review.id, 1, 1, "save", review.items.slice(1)), /frozen target/);
    assert.throws(() => repo.updateReview(owner, review.id, 1, 1, "save", [review.items[0], ...review.items.slice(0, -1)]), /frozen target/);
    const items = review.items.map(i => ({ ...i, selfRating: 3, justification: "I delivered a documented change and measured its result." }));
    const submitted = repo.updateReview(owner, review.id, 1, 1, "submit", items);
    assert.equal(submitted.status, "submitted");
    assert.ok(submitted.evidence?.history.every(h => h.employee_id === owner.employeeId));
    assert.deepEqual(submitted.evidence?.assessment.skills, employee.skills);
    assert.equal(repo.updateReview(owner, review.id, 1, 1, "submit", items).revision, 2);
    assert.throws(() => repo.updateReview(owner, review.id, 2, 1, "save", items), /Invalid review transition/);
    const reopened = repo.updateReview(owner, review.id, 2, 1, "reopen", []);
    assert.equal(reopened.status, "draft"); assert.equal(reopened.evidence, null);
    assert.equal(repo.updateReview(owner, review.id, 2, 1, "reopen", []).revision, 3);
    assert.throws(() => repo.updateReview(owner, review.id, 1, 1, "save", items), /Context changed/);
    const changed = items.map(i => ({ ...i, justification: "Additional self-reported evidence" }));
    repo.updateReview(owner, review.id, 3, 1, "save", changed);
    assert.equal(repo.reviews(owner, employee.employee_id).find(r => r.revision === 2)?.items[0].justification, items[0].justification);
    assert.deepEqual(repo.read().data.employees.find(e => e.employee_id === owner.employeeId), employee);
  } finally { repo.close(); }
});

test("review history survives ordinary dataset revisions but reset isolates old cycles", () => {
  const repo = new SqliteRepository(":memory:");
  try {
    const review = repo.createReview(owner, "2026-Q3", 1, 0);
    repo.import({ employees: JSON.stringify({ meta: data.meta, employees: [employee] }) }, 1);
    assert.equal(repo.reviews(owner, employee.employee_id).length, 1);
    assert.throws(() => repo.updateReview(owner, review.id, 1, 1, "save", review.items), /Context changed/);
    repo.updateReview(owner, review.id, 1, 2, "save", review.items);
    repo.reset(2);
    assert.deepEqual(repo.reviews(owner, employee.employee_id), []);
    assert.throws(() => repo.updateReview(owner, review.id, 2, 3, "save", review.items), /Forbidden/);
    assert.notEqual(repo.createReview(owner, "2026-Q3", 3, 0).id, review.id);
  } finally { repo.close(); }
});

test("review periods use the dataset clock, no next-grade target or reviewer is invented", () => {
  const repo = new SqliteRepository(":memory:");
  try {
    assert.equal(previousQuarter("2026-10-01"), "2026-Q3");
    assert.equal(previousQuarter("2026-01-01"), "2025-Q4");
    assert.throws(() => repo.createReview(owner, "2026-Q4", 1, 0), /Quarter has not ended/);
    assert.throws(() => repo.createReview(owner, "2026-Q5", 1, 0), /Invalid quarter/);
    assert.throws(() => repo.createReview({ accessRole: "employee", employeeId: "E0137" }, "2026-Q3", 1, 0), /role-linked/);
    const head = data.employees.find(e => !e.manager_id)!;
    const actor: Actor = { accessRole: "employee", employeeId: head.employee_id };
    repo.savePlanning(actor, head.employee_id, 1, 0, { goals: [{ id: "own", wording: "Maintain my role skills", origin: "employee", target: { target_role: head.role, target_grade: head.grade } }], focusId: "own", milestones: [] });
    assert.equal(repo.createReview(actor, "2026-Q3", 1, 1).reviewerId, null);
  } finally { repo.close(); }
});
