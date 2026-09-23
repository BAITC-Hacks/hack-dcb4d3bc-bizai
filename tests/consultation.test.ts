import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { consultationAnswersSchema, type Consultation } from "../lib/ai/consultation";
import { buildAssistantContext, validateAdvice } from "../lib/ai/context";
import { initialPlan } from "../lib/career/planning";
import { loadFixtures, SqliteRepository } from "../lib/server/database";
import { AssistantStore } from "../lib/server/assistant-store";
import type { Advice, AssistantResult } from "../lib/ai/contracts";

const data = loadFixtures();
const employee = { ...data.employees.find(e => e.employee_id === "E0137")!, career_goal: { target_role: "Backend Engineer", target_grade: "Senior" as const } };
const planning = { revision: 0, plan: initialPlan(employee) };
const answers = { maxHours: null, formats: [], notes: "I prefer short activities after work." };
const confirmed: Consultation = { revision: 1, answers };
const build = (consultation?: Consultation) => buildAssistantContext({ revision: 1, data }, employee, planning, "coach", null, consultation);
const base: Advice = { summary: "Facts", questions: [], insights: [], recommendations: [], goal_draft: null };

test("recommendations require explicit confirmation even when a target and eligible candidates exist", () => {
  const unknown = build();
  const ready = build(confirmed);
  assert.deepEqual(unknown.readiness, { state: "awaiting_answer", reason: "constraints" });
  assert.equal(ready.readiness.state, "ready");
  const candidate = ready.candidates[0];
  const advice = { ...base, recommendations: [{ event_id: candidate.event_id, skill_id: candidate.contributions[0].skill_id, reason: "Helpful", evidence_ids: [] }] };
  assert.throws(() => validateAdvice(advice, unknown), /Consultation is not ready/);
  assert.ok(validateAdvice(advice, ready).recommendations[0].evidence_ids.includes("consultation"));
});

test("duration and formats filter the full catalog before shortlisting, without inventing a match", () => {
  const limited = build({ revision: 2, answers: { maxHours: 12, formats: ["self_paced"], notes: "" } });
  for (const candidate of limited.candidates) {
    assert.ok(candidate.duration_hours <= 12); assert.equal(candidate.format, "self_paced");
  }
  const excluded = limited.facts.filter(f => f.id.startsWith("event:")).map(f => f.value as { reasons: string[] });
  assert.ok(excluded.some(e => e.reasons.includes("consultationDuration") || e.reasons.includes("consultationFormat")));
  const none = build({ revision: 3, answers: { maxHours: 0.1, formats: [], notes: "" } });
  assert.deepEqual(none.candidates, []);
  assert.deepEqual(none.readiness, { state: "blocked", reason: "catalog" });
  assert.throws(() => consultationAnswersSchema.parse({ ...answers, maxHours: 0 }));
  assert.throws(() => consultationAnswersSchema.parse({ ...answers, formats: ["online", "online"] }));
});

test("consultation edits are attributed, retryable and versioned; stale answers cannot publish", () => {
  const directory = mkdtempSync(join(tmpdir(), "consultation-test-"));
  const path = join(directory, "test.sqlite");
  const repo = new SqliteRepository(path);
  const audit = new AssistantStore(path);
  const id = employee.employee_id;
  const turn: AssistantResult = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), message: "Help", advice: base, engine: "rules", reason: "not_configured", state: "needs_input", evidence: [], activities: [], datasetRevision: 1, planRevision: 0, consultationRevision: 0, locale: "en", mode: "coach", eventId: null, model: null, latencyMs: 1 };
  try {
    audit.save(`employee:${id}`, id, turn, "test");
    assert.equal(audit.saveConsultation(id, 1, 0, 0, answers).revision, 1);
    assert.equal(audit.saveConsultation(id, 1, 0, 0, answers).revision, 1);
    assert.equal(audit.latestEmployeeDecisions().get(id)?.consultationStale, true);
    assert.throws(() => audit.saveConsultation(id, 1, 0, 0, { ...answers, maxHours: 10 }), /Context changed/);
    assert.throws(() => audit.save(`employee:${id}`, id, { ...turn, id: crypto.randomUUID() }, "test"), /Context changed/);
    assert.deepEqual(audit.history(`employee:${id}`, id, 1, 0, "coach", null, 1), []);
    assert.deepEqual(audit.consultation("E0001", 1, 0), { revision: 0, answers: null });
    assert.deepEqual(audit.consultation(id, 1, 1), { revision: 0, answers: null });
    const next = { ...turn, id: crypto.randomUUID(), consultationRevision: 1 };
    audit.save(`employee:${id}`, id, next, "test");
    assert.equal(audit.history(`employee:${id}`, id, 1, 0, "coach", null, 1).length, 1);
    assert.equal(audit.latestEmployeeDecisions().get(id)?.consultationStale, false);
    repo.reset(1);
    assert.deepEqual(audit.consultation(id, 2, 0), { revision: 0, answers: null });
    assert.throws(() => audit.saveConsultation(id, 1, 0, 1, answers), /Context changed/);
  } finally { audit.close(); repo.close(); rmSync(directory, { recursive: true }); }
});
