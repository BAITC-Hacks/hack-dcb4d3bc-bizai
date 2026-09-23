import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildAssistantContext, validateAdvice } from "../lib/ai/context";
import { requestAdvice, ProviderError } from "../lib/ai/provider";
import type { Advice, AssistantResult } from "../lib/ai/contracts";
import { loadFixtures, SqliteRepository } from "../lib/server/database";
import { initialPlan } from "../lib/career/planning";
import { AssistantStore } from "../lib/server/assistant-store";
import { presentAdvice } from "../lib/ai/presentation";

const data = loadFixtures();
const employee = data.employees.find(e => e.employee_id === "E0137")!;
const target = { target_role: "Backend Engineer", target_grade: "Senior" as const };
const withGoal = { ...employee, career_goal: target };
const planning = { revision: 0, plan: initialPlan(withGoal) };
const confirmed = { revision: 1, answers: { maxHours: null, formats: [], notes: "" } };
const context = buildAssistantContext({ revision: 1, data }, withGoal, planning, "coach", null, confirmed);
const base: Advice = { summary: "Let's use your saved goal.", questions: [], insights: [], recommendations: [], goal_draft: null };

test("assistant context only exposes subject evidence and useful eligible candidates", () => {
  assert.ok(context.candidates.length > 0);
  for (const c of context.candidates) {
    assert.equal(c.mandatory, false); assert.deepEqual(c.reasons, []); assert.ok(c.score > 0);
    for (const effect of c.contributions) assert.ok(effect.after > effect.before);
  }
  const serialized = JSON.stringify(context);
  assert.equal(serialized.includes(data.employees.find(e => e.employee_id !== employee.employee_id)!.full_name), false);
  assert.ok(context.facts.some(f => f.id === "history:R002489"));
  assert.equal(context.facts.some(f => f.source.includes("employees.json:") && !f.source.endsWith(employee.employee_id)), false);
});

test("missing and unmapped goals cannot receive invented catalog recommendations", () => {
  const missing = buildAssistantContext({ revision: 1, data }, employee, { revision: 0, plan: initialPlan(employee) }, "coach", null);
  assert.equal(missing.focus, null); assert.deepEqual(missing.candidates, []);
  assert.equal(presentAdvice(validateAdvice(base, missing), missing, "en").summary, base.summary);
  assert.deepEqual(presentAdvice(validateAdvice(base, missing), missing, "en").questions, []);
  assert.ok(validateAdvice({ ...base, questions: ["What do you want to achieve?"] }, missing));
  const freePlan = { revision: 1, plan: { ...planning.plan, goals: [{ id: "free", wording: "Deliver a clear presentation", target: null, origin: "employee" as const }], focusId: "free" } };
  assert.deepEqual(buildAssistantContext({ revision: 1, data }, employee, freePlan, "coach", null).candidates, []);
});

test("advice validation rejects fabricated citations, ineligible choices, unsupported targets and premature recommendations", () => {
  const c = context.candidates[0];
  const recommendation = { event_id: c.event_id, skill_id: c.contributions[0].skill_id, reason: "Supports the saved target.", evidence_ids: ["profile", "goal", "consultation", `event:${c.event_id}`, `gap:${c.contributions[0].skill_id}`, `participation:${c.event_id}`] };
  const valid = { ...base, recommendations: [recommendation] };
  assert.deepEqual(validateAdvice(valid, context), valid);
  assert.throws(() => validateAdvice({ ...valid, questions: ["Any constraints?"] }, context), /Resolve questions/);
  assert.throws(() => validateAdvice({ ...base, recommendations: [{ ...recommendation, event_id: "EV_001" }] }, context), /Invalid activity/);
  assert.throws(() => validateAdvice({ ...valid, recommendations: [recommendation, recommendation] }, context), /Invalid activity/);
  assert.throws(() => validateAdvice({ ...base, insights: [{ text: "Invented", evidence_ids: ["other-employee"] }] }, context), /Unsupported evidence/);
  assert.throws(() => validateAdvice({ ...base, recommendations: [{ ...recommendation, skill_id: "SK_MADE_UP" }] }, context), /contributing skill/);
  assert.deepEqual(validateAdvice({ ...base, recommendations: [{ ...recommendation, evidence_ids: [] }] }, context).recommendations[0].evidence_ids, recommendation.evidence_ids);
  assert.throws(() => validateAdvice({ ...valid, goal_draft: { wording: "New role", target_role: "Astronaut", target_grade: "Lead" } }, context), /Unknown proposed/);
  assert.equal(validateAdvice({ ...valid, goal_draft: { wording: context.focus!.wording, target_role: target.target_role, target_grade: target.target_grade } }, context).goal_draft, null);
});

test("provider uses strict Responses output, disables storage and validates returned claims", async () => {
  let sent: Record<string, unknown> | undefined;
  const fetcher: typeof fetch = async (_url, init) => {
    sent = JSON.parse(init!.body as string);
    return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(base) }] }] });
  };
  const result = await requestAdvice({ ...context, mode: "activity" }, [{ role: "user", content: "Help" }], "ru", { key: "synthetic-test-key", fetcher });
  assert.deepEqual(result.advice, base);
  assert.equal(sent!.store, false);
  assert.match(sent!.instructions as string, /Russian/);
  assert.equal((sent!.text as { format: { strict: boolean } }).format.strict, true);
  await assert.rejects(requestAdvice(context, [], "en", { key: "synthetic-test-key", fetcher: async () => Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ ...base, insights: [{ text: "Fabrication", evidence_ids: ["fake"] }] }) }] }] }) }), (error: unknown) => error instanceof ProviderError && error.reason === "invalid_output");
});

test("published facts cannot turn absent assessments into inability or invent historical gains", () => {
  const withoutCloudAssessment = { ...withGoal, skills: Object.fromEntries(Object.entries(withGoal.skills).filter(([id]) => id !== "SK_CLOUD")) };
  const missingContext = buildAssistantContext({ revision: 1, data }, withoutCloudAssessment, planning, "coach", null);
  const raw = { ...base, summary: "Let’s look at what the records actually tell us.", insights: [{ text: "No cloud experience; historical training raised System Design to 5", evidence_ids: ["gap:SK_CLOUD", "gap:SK_SYSTEM_DESIGN"] }] };
  const published = presentAdvice(validateAdvice(raw, missingContext), missingContext, "en");
  assert.doesNotMatch(JSON.stringify(published), /cannot do their job|No cloud experience|raised System Design to 5/);
  assert.equal(published.summary, raw.summary);
  assert.match(published.insights[0].text, /No assessment recorded; calculations use zero/);
  assert.match(published.insights[0].text, /Effective level 2/);
});

test("provider handles missing configuration, refusal, service failure and timeout without retrying", async () => {
  await assert.rejects(requestAdvice(context, [], "en", { key: "" }), (e: unknown) => e instanceof ProviderError && e.reason === "not_configured");
  for (const response of [Response.json({}, { status: 429 }), Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "Cannot help" }] }] })]) {
    let calls = 0;
    await assert.rejects(requestAdvice(context, [], "en", { key: "test", fetcher: async () => { calls++; return response; } }), ProviderError);
    assert.equal(calls, 1);
  }
  await assert.rejects(requestAdvice(context, [], "en", { key: "test", fetcher: async () => { throw new DOMException("deadline", "TimeoutError"); } }), (e: unknown) => e instanceof ProviderError && e.reason === "timeout");
});

test("audit persists scoped evidence and rejects answers after a plan change or dataset reset", () => {
  const directory = mkdtempSync(join(tmpdir(), "assistant-test-"));
  const path = join(directory, "test.sqlite");
  const repo = new SqliteRepository(path);
  const audit = new AssistantStore(path);
  const scope = `employee:${employee.employee_id}`;
  const turn: AssistantResult = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), message: "Help", advice: base, engine: "openai", reason: null, state: "no_match", evidence: context.facts, activities: [], datasetRevision: 1, planRevision: 0, locale: "en", mode: "coach", eventId: null, model: "test", latencyMs: 10 };
  try {
    audit.save(scope, employee.employee_id, turn, "test-v1");
    assert.equal(audit.get(turn.id, "hr", employee.employee_id), null);
    assert.equal(audit.history(scope, employee.employee_id, 1, 0, "coach", null).length, 1);
    assert.equal(audit.history(scope, employee.employee_id, 1, 1, "coach", null).length, 0);
    repo.savePlanning({ accessRole: "employee", employeeId: employee.employee_id }, employee.employee_id, 1, 0, { ...planning.plan, goals: planning.plan.goals.map(g => ({ ...g, origin: "employee" })) });
    assert.throws(() => audit.save(scope, employee.employee_id, { ...turn, id: crypto.randomUUID() }, "test-v1"), /Context changed/);
    repo.reset(1);
    assert.equal(audit.history(scope, employee.employee_id, 2, 0, "coach", null).length, 0);
  } finally { audit.close(); repo.close(); rmSync(directory, { recursive: true }); }
});

test("provider deadlines are optional, uncapped and preserve caller cancellation", async (t) => {
  const previous = process.env.OPENAI_TIMEOUT_MS;
  t.after(() => {
    if (previous === undefined) delete process.env.OPENAI_TIMEOUT_MS;
    else process.env.OPENAI_TIMEOUT_MS = previous;
  });
  const deadlines: number[] = [];
  const deadlineController = new AbortController();
  t.mock.method(AbortSignal, "timeout", (ms: number) => {
    deadlines.push(ms);
    return deadlineController.signal;
  });
  let received: AbortSignal | null | undefined;
  const receivedSignal = () => received;
  const fetcher: typeof fetch = async (_url, init) => {
    received = init?.signal;
    return Response.json({}, { status: 503 });
  };
  const run = (signal?: AbortSignal, timeoutMs?: number) => assert.rejects(
    requestAdvice(context, [], "en", { key: "test", fetcher, signal, timeoutMs }),
    (error: unknown) => error instanceof ProviderError && error.reason === "unavailable",
  );
  delete process.env.OPENAI_TIMEOUT_MS;
  await run();
  assert.equal(received, undefined);
  assert.deepEqual(deadlines, []);

  for (const value of ["", "0", "invalid", "-1", "1.5"]) {
    process.env.OPENAI_TIMEOUT_MS = value;
    await run();
    assert.equal(received, undefined);
  }
  assert.deepEqual(deadlines, []);

  process.env.OPENAI_TIMEOUT_MS = "60000";
  const caller = new AbortController();
  await run(caller.signal);
  assert.deepEqual(deadlines, [60000]);
  assert.equal(receivedSignal()?.aborted, false);
  caller.abort();
  assert.equal(receivedSignal()?.aborted, true);

  await run(undefined, 120000);
  assert.deepEqual(deadlines, [60000, 120000]);
  deadlineController.abort(new DOMException("deadline", "TimeoutError"));
  assert.equal(receivedSignal()?.aborted, true);

  delete process.env.OPENAI_TIMEOUT_MS;
  const cancellable = new AbortController();
  await run(cancellable.signal);
  assert.equal(received, cancellable.signal);
  cancellable.abort();
  assert.equal(receivedSignal()?.aborted, true);
});
