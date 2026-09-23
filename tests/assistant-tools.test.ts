import test from "node:test";
import assert from "node:assert/strict";
import { buildAssistantContext, validateAdvice } from "../lib/ai/context";
import { executeAssistantTool } from "../lib/ai/tools";
import { requestAdvice, ProviderError } from "../lib/ai/provider";
import { loadFixtures, SqliteRepository } from "../lib/server/database";
import { initialPlan } from "../lib/career/planning";
import { AssistantStore } from "../lib/server/assistant-store";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
const data = loadFixtures();
const employee = data.employees.find(e => e.employee_id === "E0001")!;
const context = buildAssistantContext({ revision: 1, data }, employee, { revision: 0, plan: initialPlan(employee) }, "coach", null, { revision: 1, answers: { maxHours: null, formats: [], notes: "" } });
const reply = { summary: "Let’s compare the options that fit your goal.", summary_evidence_ids: ["goal"], consultation_draft: null, questions: [], insights: [], recommendations: [], goal_draft: null };
const completed = (value = reply) => Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }] });

test("tools only return scoped evidence and cannot execute writes or select another employee", () => {
  const before = JSON.stringify(context);
  assert.equal(executeAssistantTool(context, "inspect_evidence", { ids: ["profile"] }).output.facts.length, 1);
  const candidate = context.candidates[0];
  assert.equal(executeAssistantTool(context, "compare_activities", { event_ids: [candidate.event_id] }).output.facts.length, 2);
  assert.throws(() => executeAssistantTool(context, "inspect_evidence", { ids: ["employees:E9999"] }), /authorized/);
  assert.throws(() => executeAssistantTool(context, "inspect_evidence", { ids: ["profile"], employeeId: "E9999" }));
  assert.throws(() => executeAssistantTool(context, "approve_review", {}), /Unknown/);
  assert.equal(JSON.stringify(context), before);
});

test("Responses tool round uses a shared deadline, returns results and records an auditable trace", async () => {
  const sent: Record<string, unknown>[] = [];
  const signals: unknown[] = [];
  const fetcher: typeof fetch = async (_url, init) => {
    sent.push(JSON.parse(init!.body as string)); signals.push(init!.signal);
    if (sent.length === 1) return Response.json({ status: "completed", output: [{ type: "function_call", call_id: "call_1", name: "inspect_evidence", arguments: JSON.stringify({ ids: ["profile", "goal"] }) }] });
    return completed();
  };
  const result = await requestAdvice(context, [{ role: "user", content: "What is my current goal?" }], "en", { key: "test", fetcher });
  assert.equal(sent.length, 2); assert.equal(sent[1].tool_choice, "none"); assert.equal(signals[0], signals[1]);
  assert.ok((sent[1].input as { type?: string }[]).some(i => i.type === "function_call_output"));
  assert.deepEqual(result.toolCalls[0].evidenceIds, ["profile", "goal"]);
  assert.equal(result.advice.summary, reply.summary);
});

test("tool loop rejects unknown tools and extra rounds instead of executing arbitrary calls", async () => {
  for (const name of ["delete_employee", "inspect_evidence"]) {
    let calls = 0;
    await assert.rejects(requestAdvice(context, [], "en", { key: "test", fetcher: async () => {
      calls++; return Response.json({ status: "completed", output: [{ type: "function_call", name, call_id: `call_${calls}`, arguments: '{"ids":["profile"]}' }] });
    } }), (e: unknown) => e instanceof ProviderError && e.reason === "invalid_output");
    assert.equal(calls, name === "delete_employee" ? 1 : 2);
  }
});

test("preference proposals cannot bypass confirmation or HR authority", () => {
  const draft = { maxHours: 12, formats: ["self_paced"], notes: "Prefer evenings" };
  assert.deepEqual(validateAdvice({ ...reply, consultation_draft: draft }, context).consultation_draft, draft);
  const candidate = context.candidates[0];
  assert.throws(() => validateAdvice({ ...reply, consultation_draft: draft, recommendations: [{ event_id: candidate.event_id, skill_id: candidate.contributions[0].skill_id, evidence_ids: [], reason: "Fits" }] }, context), /Confirm proposed/);
  assert.throws(() => validateAdvice({ ...reply, consultation_draft: draft }, { ...context, mode: "hr" }), /HR briefs/);
  assert.throws(() => validateAdvice({ ...reply, summary_evidence_ids: ["invented"] }, context), /Unsupported evidence/);
});

test("conversation survives preference changes without making old advice current or crossing reset scope", () => {
  const dir = mkdtempSync(join(tmpdir(), "chat-continuity-")), path = join(dir, "db.sqlite");
  const repo = new SqliteRepository(path), audit = new AssistantStore(path);
  try {
    const turn = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), message: "I prefer short courses", advice: reply, engine: "openai" as const, reason: null, state: "explained" as const, evidence: [], activities: [], datasetRevision: 1, planRevision: 0, consultationRevision: 0, locale: "en" as const, mode: "coach" as const, eventId: null, model: "test", latencyMs: 1 };
    const scope = `employee:${employee.employee_id}`;
    audit.save(scope, employee.employee_id, turn, "test");
    audit.save(scope, employee.employee_id, { ...turn, id: crypto.randomUUID(), advice: { ...reply, intent: "conversation", summary: "You're welcome." } }, "test");
    assert.equal(audit.latestEmployeeDecisions().get(employee.employee_id)?.id, turn.id);
    audit.saveConsultation(employee.employee_id, 1, 0, 0, { maxHours: 12, formats: [], notes: "" });
    assert.equal(audit.conversation(scope, employee.employee_id, 1, 0, "coach", null).length, 2);
    assert.deepEqual(audit.history(scope, employee.employee_id, 1, 0, "coach", null, 1), []);
    assert.deepEqual(audit.conversation("hr", employee.employee_id, 1, 0, "coach", null), []);
    repo.reset(1);
    assert.deepEqual(audit.conversation(scope, employee.employee_id, 2, 0, "coach", null), []);
  } finally { audit.close(); repo.close(); rmSync(dir, { recursive: true, force: true }); }
});


test("fast replies preload candidate participation and keep a bounded output budget", async () => {
  let calls = 0;
  await requestAdvice(context, [{ role: "user", content: "Compare my options" }], "en", { key: "test", fetcher: async (_url, init) => {
    calls++;
    const body = JSON.parse(init!.body as string);
    assert.equal(body.max_output_tokens, 1200);
    const reference = JSON.parse(body.input[0].content.split("\n").slice(1).join("\n"));
    for (const id of context.candidates.flatMap(candidate => [`event:${candidate.event_id}`, `participation:${candidate.event_id}`])) {
      assert.deepEqual(reference.evidence.find((fact: { id: string }) => fact.id === id), context.facts.find(fact => fact.id === id));
    }
    assert.ok(body.tools.length > 0, "missing evidence can still be retrieved");
    return completed();
  } });
  assert.equal(calls, 1);
});

test("employee evidence remains complete without a focus goal and excludes other employees", () => {
  const ownHistory = Array.from({ length: 25 }, (_, i) => ({ ...data.history.find(h => h.employee_id === employee.employee_id)!, record_id: `own-${i}` }));
  const withoutGoal = buildAssistantContext({ revision: 1, data: { ...data, history: [...data.history, ...ownHistory] } }, employee, { revision: 0, plan: { goals: [], focusId: null, milestones: [] } }, "coach", null);
  const read = (id: string) => executeAssistantTool(withoutGoal, "inspect_evidence", { ids: [id] }).output.facts[0].value;
  const profile = read("profile") as Record<string, unknown>;
  for (const [key, value] of Object.entries(employee)) assert.deepEqual(profile[key], value);
  for (const row of ownHistory) assert.equal((read(`history:${row.record_id}`) as { employee_id: string }).employee_id, employee.employee_id);
  for (const row of data.history.filter(h => h.employee_id !== employee.employee_id)) assert.ok(!withoutGoal.facts.some(f => f.id === `history:${row.record_id}`));
  for (const skill of data.skills) assert.ok(read(`skill:${skill.skill_id}`));
  for (const event of data.events) assert.ok(withoutGoal.facts.some(f => f.id === `catalog:${event.event_id}` || f.id === `event:${event.event_id}`));
  const topGrade = buildAssistantContext({ revision: 1, data }, { ...employee, grade: "Lead" }, { revision: 0, plan: initialPlan(employee) }, "coach", null);
  assert.equal((topGrade.facts.find(f => f.id === "career_path")!.value as { next_target: unknown }).next_target, null);
});
