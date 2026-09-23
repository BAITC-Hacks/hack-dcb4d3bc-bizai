import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { SqliteRepository, loadFixtures } from "../lib/server/database";
import { initialPlan } from "../lib/career/planning";
import { effectiveSkills } from "../lib/career/skills";
import { buildAssistantContext, validateAdvice } from "../lib/ai/context";
import { presentAdvice } from "../lib/ai/presentation";
import { demoAuthEnabled, sessionKey, verifyAccessToken } from "../lib/server/identity";

const data = loadFixtures();
const employee = data.employees.find(e => e.employee_id === "E0165")!;
const context = buildAssistantContext({ revision: 1, data }, employee, { revision: 0, plan: initialPlan(employee) }, "coach", null, { revision: 1, answers: { maxHours: null, formats: [], notes: "" } });
const empty = { summary: "Ready", questions: [], insights: [], recommendations: [], goal_draft: null };

test("related participation survives shortlisting and published advice always includes the required factors", () => {
  const candidate = context.candidates.find(c => c.event_id === "EV_036")!;
  for (const id of ["R001032", "R001835"]) {
    assert.ok(candidate.participation.records.some(row => row.record_id === id && row.status === "dropped"));
    assert.ok(context.facts.some(f => f.id === `history:${id}`));
  }
  const validated = validateAdvice({ ...empty, recommendations: [{ event_id: candidate.event_id, skill_id: candidate.contributions[0].skill_id, reason: "Invented grade and perfect attendance", evidence_ids: [] }] }, context);
  for (const locale of ["en", "ru", "kk"] as const) {
    const published = presentAdvice(validated, context, locale).recommendations[0];
    for (const id of ["profile", "goal", "gap:SK_PUBLIC_SPEAKING", "participation:EV_036"]) assert.ok(published.evidence_ids.includes(id));
    assert.doesNotMatch(published.reason, /Invented|perfect attendance/);
    assert.ok(published.reason.includes("→"));
  }
  const reason = presentAdvice(validated, context, "en").recommendations[0].reason;
  assert.match(reason, new RegExp(employee.grade));
  assert.match(reason, /Middle/);
  assert.match(reason, new RegExp(`Dropped: ${candidate.participation.dropped}`, "i"));
  assert.match(reason, /Eligible alternative/);
});

test("ready coaching rejects empty answers while real questions and other modes remain valid", () => {
  assert.equal(context.readiness.state, "ready");
  assert.throws(() => validateAdvice(empty, context), /requires 1–3/);
  assert.ok(validateAdvice({ ...empty, questions: ["Does this schedule work?"] }, context));
  assert.ok(validateAdvice(empty, { ...context, mode: "hr" }));
  assert.ok(validateAdvice(empty, { ...context, mode: "activity" }));
});

test("recurring completion distinguishes new occurrences, retries, stale commands and caps", () => {
  const repo = new SqliteRepository(":memory:");
  const actor = { accessRole: "employee" as const, employeeId: "E0001" };
  try {
    const employee = repo.read().data.employees[0];
    assert.equal(effectiveSkills(employee, repo.read().data).SK_PUBLIC_SPEAKING ?? 0, 0);
    const firstId = randomUUID();
    const first = repo.completeActivity(actor, "EV_036", 1, 0, firstId);
    assert.equal(repo.completeActivity(actor, "EV_036", 1, 0, firstId).completion.id, first.completion.id);
    assert.throws(() => repo.completeActivity(actor, "EV_005", 2, 0, firstId), /ID reused/);
    assert.throws(() => repo.completeActivity(actor, "EV_036", 1, 0, randomUUID()), /Context changed/);
    for (let level = 2; level <= 5; level++) {
      repo.completeActivity(actor, "EV_036", repo.read().revision, 0, randomUUID());
      assert.equal(effectiveSkills(employee, repo.read().data).SK_PUBLIC_SPEAKING, Math.min(level, 4));
    }
    assert.equal(repo.read().data.demo_completions!.length, 5);
    repo.completeActivity(actor, "EV_005", repo.read().revision, 0, randomUUID());
    assert.throws(() => repo.completeActivity(actor, "EV_005", repo.read().revision, 0, randomUUID()), /not eligible/);
  } finally { repo.close(); }
});

test("legacy completion migration preserves IDs, history and gains across reopen", () => {
  const dir = mkdtempSync(join(tmpdir(), "completion-migration-"));
  const path = join(dir, "test.sqlite");
  try {
    const old = new DatabaseSync(path);
    old.exec("CREATE TABLE demo_completions (employee_id TEXT NOT NULL, event_id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(employee_id,event_id))");
    const event = data.events.find(e => e.event_id === "EV_036")!;
    old.prepare("INSERT INTO demo_completions VALUES (?, ?, ?)").run("E0001", event.event_id, JSON.stringify({ id: "preserved-id", employee_id: "E0001", event_id: event.event_id, gains: event.develops_skills, completed_at: "2026-10-01T00:00:00Z", business_date: "2026-10-01", before: {}, after: {} }));
    old.close();
    for (let i = 0; i < 2; i++) {
      const repo = new SqliteRepository(path);
      try {
        const snapshot = repo.read();
        assert.equal(snapshot.data.demo_completions![0].id, "preserved-id");
        assert.equal(snapshot.data.history.filter(row => row.record_id === "preserved-id").length, 1);
        assert.equal(effectiveSkills(snapshot.data.employees[0], snapshot.data).SK_PUBLIC_SPEAKING, 1);
      } finally { repo.close(); }
    }
  } finally { rmSync(dir, { recursive: true }); }
});

test("identity fails closed and binds random tokens to server-defined roles", () => {
  const dir = mkdtempSync(join(tmpdir(), "identity-"));
  const previousMode = process.env.AUTH_MODE;
  const previousFile = process.env.AUTH_CREDENTIALS_FILE;
  try {
    delete process.env.AUTH_MODE;
    process.env.AUTH_CREDENTIALS_FILE = join(dir, "credentials.json");
    assert.equal(demoAuthEnabled(), false);
    assert.equal(sessionKey("cookie"), "credentials:cookie");
    const token = randomBytes(32).toString("hex");
    assert.equal(verifyAccessToken(token), null);
    writeFileSync(process.env.AUTH_CREDENTIALS_FILE, JSON.stringify([{ tokenHash: createHash("sha256").update(token).digest("hex"), accessRole: "employee", employeeId: "E0001" }]));
    assert.deepEqual(verifyAccessToken(token), { accessRole: "employee", employeeId: "E0001" });
    assert.equal(verifyAccessToken(randomBytes(32).toString("hex")), null);
    assert.equal(verifyAccessToken("hr"), null);
    process.env.AUTH_MODE = "demo";
    assert.equal(demoAuthEnabled(), true);
    assert.equal(sessionKey("cookie"), "demo:cookie");
    writeFileSync(process.env.AUTH_CREDENTIALS_FILE, "invalid JSON");
    assert.equal(verifyAccessToken(token), null);
  } finally {
    if (previousMode === undefined) delete process.env.AUTH_MODE; else process.env.AUTH_MODE = previousMode;
    if (previousFile === undefined) delete process.env.AUTH_CREDENTIALS_FILE; else process.env.AUTH_CREDENTIALS_FILE = previousFile;
    rmSync(dir, { recursive: true });
  }
});
