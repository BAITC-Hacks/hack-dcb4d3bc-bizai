import { readChatStream } from "../lib/ai/stream.ts";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { SqliteRepository } from "../lib/server/database.ts";
import { AssistantStore } from "../lib/server/assistant-store.ts";

const directory = mkdtempSync(join(tmpdir(), "career-ai-http-"));
const path = join(directory, "test.sqlite");
const base = `http://127.0.0.1:${process.env.AI_SMOKE_PORT ?? "3103"}`;
const repo = new SqliteRepository(path);
const audit = new AssistantStore(path);
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", new URL(base).port], { env: { ...process.env, DATABASE_PATH: path, COOKIE_SECURE: "false", OPENAI_API_KEY: "" }, stdio: ["ignore", "pipe", "pipe"] });
let logs = "";
child.stdout.on("data", chunk => { logs += chunk; }); child.stderr.on("data", chunk => { logs += chunk; });
let count = 0;
async function request(url, cookie = "", body, origin = base, accept = "application/json") {
  count++;
  return fetch(base + url, { redirect: "manual", headers: { Cookie: cookie, Origin: origin, Accept: accept, "Content-Type": "application/json" }, ...(body ? { method: "POST", body: JSON.stringify(body) } : {}) });
}
async function login(accessRole, employeeId) {
  const response = await fetch(base + "/api/session", { method: "POST", redirect: "manual", headers: { Origin: base, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ accessRole, ...(employeeId ? { employeeId } : {}) }) });
  assert.equal(response.status, 303); return response.headers.get("set-cookie").split(";")[0];
}
try {
  for (let i = 0; i < 100; i++) { if (child.exitCode !== null) throw new Error(logs); try { await fetch(base); break; } catch { await delay(100); } }
  const employee = await login("employee", "E0137");
  const hr = await login("hr");
  const query = "/api/assistant?employeeId=E0137&mode=coach";
  assert.equal((await request(query)).status, 403);
  assert.equal((await request("/api/assistant?employeeId=E0001&mode=coach", employee)).status, 403);
  assert.equal((await request("/api/assistant?employeeId=E0137&mode=hr", employee)).status, 403);
  const current = await (await request(query, employee)).json();
  assert.equal(current.configured, false);
  assert.deepEqual(current.turns, []);
  const input = { id: crypto.randomUUID(), employeeId: "E0137", mode: "coach", eventId: null, message: "Help me choose a goal.", datasetRevision: current.datasetRevision, planRevision: current.planRevision };
  assert.equal((await request("/api/assistant", employee, input, "https://other.example")).status, 403);
  assert.equal((await request("/api/assistant", employee, { ...input, employeeId: "E0001" })).status, 403);
  assert.equal((await request("/api/assistant", employee, { ...input, datasetRevision: 999 })).status, 409);
  assert.equal((await request("/api/assistant", employee, { ...input, message: "x".repeat(2001) })).status, 400);
  const response = await request("/api/assistant", employee + "; career_quest_locale=ru", input);
  assert.equal(response.status, 200);
  const turn = await response.json();
  assert.equal(turn.engine, "rules"); assert.equal(turn.reason, "not_configured"); assert.equal(turn.state, "needs_goal");
  assert.ok(turn.advice.questions.length); assert.equal(turn.locale, "ru"); assert.deepEqual(turn.advice.recommendations, []);
  assert.equal((await (await request("/api/assistant", employee, input)).json()).id, turn.id);
  assert.equal((await (await request(query, employee)).json()).turns.length, 1);
  const replay = await request("/api/assistant", employee, input, base, "text/event-stream");
  assert.match(replay.headers.get("content-type"), /text\/event-stream/);
  const events = [];
  await readChatStream(replay.body, event => events.push(event));
  assert.equal(events[0].type, "status");
  assert.equal(events.at(-1).result.id, turn.id);
  assert.ok(events.some(event => event.type === "delta"));
  assert.equal((await request("/api/assistant", employee, { ...input, datasetRevision: 999 }, base, "text/event-stream")).status, 409);

  assert.equal((await request("/api/assistant", employee, { ...input, message: "Different payload" })).status, 409);
  const hrSession = await (await request("/api/assistant?employeeId=E0137&mode=hr", hr)).json();
  assert.deepEqual(hrSession.turns, []);
  const activity = await request("/api/assistant?employeeId=E0137&mode=activity&eventId=EV_001", employee);
  assert.equal(activity.status, 200);
  assert.equal((await request("/api/assistant?employeeId=E0137&mode=activity&eventId=made-up", employee)).status, 400);
  assert.equal((await request("/api/assistant/goal", hr, { turnId: turn.id })).status, 403);
  assert.equal((await request("/api/assistant/goal", employee, { turnId: turn.id })).status, 404);
  // A synthetic saved AI result exercises adoption without making a provider request.
  const draft = { ...turn, id: crypto.randomUUID(), engine: "openai", reason: null, advice: { ...turn.advice, goal_draft: { wording: "Become a Senior Backend Engineer", target_role: "Backend Engineer", target_grade: "Senior" } } };
  audit.save("employee:E0137", "E0137", draft, "test-only");
  assert.equal((await request("/api/assistant/goal", employee, { turnId: draft.id })).status, 200);
  assert.equal((await request("/api/assistant/goal", employee, { turnId: draft.id })).status, 200);
  assert.equal(repo.planning("E0137").plan.goals.length, 1);
  assert.deepEqual(repo.read().data.employees.find(e => e.employee_id === "E0137").career_goal, null);
  assert.equal((await request("/api/assistant", employee, { ...input, id: crypto.randomUUID() })).status, 409);
  assert.deepEqual((await (await request(query, employee)).json()).turns, []);
  const goalSession = await (await request(query, employee)).json();
  assert.deepEqual(goalSession.readiness, { state: "awaiting_answer", reason: "constraints" });
  const consultation = { datasetRevision: goalSession.datasetRevision, planRevision: goalSession.planRevision, revision: 0, answers: { maxHours: 12, formats: ["self_paced"], notes: "Schedule conflict is my own explanation, not verified history." } };
  assert.equal((await request("/api/assistant/consultation", hr, consultation)).status, 403);
  assert.equal((await request("/api/assistant/consultation", employee, consultation, "https://other.example")).status, 403);
  assert.equal((await request("/api/assistant/consultation", employee, { ...consultation, employeeId: "E0001" })).status, 400);
  assert.equal((await request("/api/assistant/consultation", employee, { ...consultation, answers: { ...consultation.answers, maxHours: -1 } })).status, 400);
  const staleDraft = { ...draft, id: crypto.randomUUID(), planRevision: goalSession.planRevision };
  audit.save("employee:E0137", "E0137", staleDraft, "test-only");
  assert.equal((await (await request("/api/assistant/consultation", employee, consultation)).json()).revision, 1);
  assert.equal((await (await request("/api/assistant/consultation", employee, consultation)).json()).revision, 1);
  assert.equal((await request("/api/assistant/consultation", employee, { ...consultation, answers: { ...consultation.answers, maxHours: 20 } })).status, 409);
  assert.equal((await request("/api/assistant/goal", employee, { turnId: staleDraft.id })).status, 409);
  const confirmed = await (await request(query, employee)).json();
  assert.deepEqual(confirmed.consultation, { revision: 1, answers: consultation.answers });
  assert.deepEqual(confirmed.turns, []);
  assert.equal((await request("/api/assistant", employee, { ...input, id: crypto.randomUUID(), planRevision: goalSession.planRevision })).status, 409);
  const confirmedRequest = { ...input, id: crypto.randomUUID(), planRevision: goalSession.planRevision, consultationRevision: 1 };
  const confirmedTurn = await (await request("/api/assistant", employee, confirmedRequest)).json();
  assert.equal(confirmedTurn.consultationRevision, 1);
  assert.equal(confirmedTurn.reason, "not_configured");
  assert.equal((await (await request("/api/assistant", employee, confirmedRequest)).json()).id, confirmedTurn.id);
  const constraintEvidence = confirmedTurn.evidence.find(fact => fact.id === "consultation");
  assert.equal(constraintEvidence.value.verified, false);
  assert.equal(constraintEvidence.value.answers.notes, consultation.answers.notes);
  const other = await login("employee", "E0001");
  assert.deepEqual((await (await request("/api/assistant?employeeId=E0001&mode=coach", other)).json()).consultation, { revision: 0, answers: null });
  repo.reset(1);
  assert.equal((await request("/api/assistant/goal", employee, { turnId: draft.id })).status, 409);
  assert.deepEqual((await (await request(query, employee)).json()).turns, []);
  assert.deepEqual((await (await request(query, employee)).json()).consultation, { revision: 0, answers: null });
  console.log(`PASS: ${count} assistant HTTP checks; authorization, origin, input limits, locale, fallback, retries, scoped history, goal adoption and stale/reset isolation. No provider calls.`);
} catch (error) { console.error(logs); throw error; }
finally {
  child.kill("SIGTERM"); await new Promise(resolve => child.exitCode !== null ? resolve() : child.once("exit", resolve));
  audit.close(); repo.close(); rmSync(directory, { recursive: true, force: true });
}
