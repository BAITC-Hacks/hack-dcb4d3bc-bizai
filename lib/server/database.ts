import { canReadReview, canDecideReview, reviewDecisionSchema, type ReviewDecisionCommand, quarterPeriod, validateReviewItems, type ReviewCycle, type ReviewItem } from "../career/reviews";
import { initialPlan, planSchema, validatePlan, focusTarget, type PlanningState } from "../career/planning";
import type { Actor } from "./access";
import { eligibility } from "../career/eligibility";
import { effectiveSkills, skillAssessments } from "../career/skills";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseDataset, mergeImport } from "../career/import";
import type { Dataset, Snapshot, DemoCompletion, ApprovedAssessment } from "../career/types";

export function loadFixtures(): Dataset {
  const directory = resolve(process.env.DATASET_DIR ?? "case_source/case_1/career_quest_dataset");
  const read = (file: string) => readFileSync(resolve(directory, file), "utf8");
  return parseDataset({ employees: read("employees.json"), events: read("events.json"), skills: read("skills.json"), history: read("activity_history.csv") });
}

// One snapshot per transaction keeps imports atomic across concurrent server processes.
export class SqliteRepository {
  private db: DatabaseSync;
  constructor(path: string, seed: () => Dataset = loadFixtures) {
    if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS approved_assessments (scope INTEGER NOT NULL, employee_id TEXT NOT NULL, skill_id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(scope, employee_id, skill_id));
      CREATE TABLE IF NOT EXISTS review_decisions (scope INTEGER NOT NULL, command_id TEXT NOT NULL, actor_id TEXT NOT NULL, command TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(scope, command_id));
      CREATE TABLE IF NOT EXISTS review_scope (id INTEGER PRIMARY KEY CHECK(id = 1), epoch INTEGER NOT NULL);
      INSERT OR IGNORE INTO review_scope VALUES (1, 1);
      CREATE TABLE IF NOT EXISTS review_revisions (scope INTEGER NOT NULL, id TEXT NOT NULL, employee_id TEXT NOT NULL, quarter TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(scope, id, revision));
      CREATE INDEX IF NOT EXISTS review_subject ON review_revisions(scope, employee_id, quarter);
      CREATE TABLE IF NOT EXISTS dataset (id INTEGER PRIMARY KEY CHECK(id = 1), revision INTEGER NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS demo_completions (employee_id TEXT NOT NULL, event_id TEXT NOT NULL, command_id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(employee_id, command_id));
      CREATE TABLE IF NOT EXISTS planning (employee_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS planning_actions (id INTEGER PRIMARY KEY, employee_id TEXT NOT NULL, actor_id TEXT NOT NULL, dataset_revision INTEGER NOT NULL, state_revision INTEGER NOT NULL, happened_at TEXT NOT NULL, before_payload TEXT NOT NULL, after_payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, access_role TEXT NOT NULL, employee_id TEXT, expires INTEGER NOT NULL);`);
    // Migrate in one transaction; preserve completion IDs referenced by approvals.
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const columns = this.db.prepare("PRAGMA table_info(demo_completions)").all() as { name: string }[];
      if (!columns.some(column => column.name === "command_id")) this.db.exec(`
        ALTER TABLE demo_completions RENAME TO demo_completions_legacy;
        CREATE TABLE demo_completions (employee_id TEXT NOT NULL, event_id TEXT NOT NULL, command_id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(employee_id, command_id));
        INSERT INTO demo_completions SELECT employee_id, event_id, json_extract(payload, '$.id'), json_set(payload, '$.command_id', json_extract(payload, '$.id')) FROM demo_completions_legacy ORDER BY rowid;
        DROP TABLE demo_completions_legacy;
      `);
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    if (!this.db.prepare("SELECT id FROM dataset WHERE id = 1").get()) {
      this.db.prepare("INSERT OR IGNORE INTO dataset VALUES (1, 1, ?)").run(JSON.stringify(seed()));
    }
  }
  private rawRead(): Snapshot {
    const row = this.db.prepare("SELECT revision, payload FROM dataset WHERE id = 1").get() as { revision: number; payload: string };
    return { revision: row.revision, data: JSON.parse(row.payload) as Dataset };
  }
  read(): Snapshot {
    const snapshot = this.rawRead();
    const rows = this.db.prepare("SELECT payload FROM demo_completions ORDER BY rowid").all() as { payload: string }[];
    const completions: DemoCompletion[] = rows.map(row => JSON.parse(row.payload));
    snapshot.data.approved_assessments = (this.db.prepare("SELECT payload FROM approved_assessments WHERE scope = (SELECT epoch FROM review_scope WHERE id = 1)").all() as { payload: string }[]).map(row => JSON.parse(row.payload));
    snapshot.data.demo_completions = completions;
    snapshot.data.history.push(...completions.map(c => ({ record_id: c.id, employee_id: c.employee_id, event_id: c.event_id, date: c.business_date, due_date: null, status: "completed" as const, completion_pct: 100, score: null, feedback_rating: null, assigned_by: "self" as const })));
    return snapshot;
  }
  completeActivity(actor: Actor, eventId: string, datasetRevision: number, planRevision: number, commandId = `legacy:${datasetRevision}:${planRevision}:${eventId}`) {
    if (actor.accessRole !== "employee" || !actor.employeeId) throw new Error("Forbidden");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const snapshot = this.read();
      const previous = snapshot.data.demo_completions!.find(c => c.employee_id === actor.employeeId && c.command_id === commandId);
      if (previous && previous.event_id !== eventId) throw new Error("Context changed; completion ID reused");
      if (previous) { this.db.exec("COMMIT"); return { completion: previous, repeated: true }; }
      const planning = this.planning(actor.employeeId);
      if (snapshot.revision !== datasetRevision || planning.revision !== planRevision) throw new Error("Context changed; reload before completing");
      const employee = snapshot.data.employees.find(e => e.employee_id === actor.employeeId);
      const event = snapshot.data.events.find(e => e.event_id === eventId);
      if (!employee || !event) throw new Error("Activity or employee not found");
      const reasons = eligibility(employee, event, snapshot.data, focusTarget(planning.plan));
      if (reasons.length) throw new Error("Activity is not eligible for demo completion");
      const before = effectiveSkills(employee, snapshot.data);
      const completion: DemoCompletion = { id: `demo:${randomUUID()}`, command_id: commandId, employee_id: employee.employee_id, event_id: eventId, completed_at: new Date().toISOString(), business_date: snapshot.data.meta.as_of_date, gains: event.develops_skills, before: {}, after: {} };
      const after = effectiveSkills(employee, { ...snapshot.data, demo_completions: [...snapshot.data.demo_completions!, completion] });
      for (const gain of event.develops_skills) { completion.before[gain.skill_id] = before[gain.skill_id] ?? 0; completion.after[gain.skill_id] = after[gain.skill_id] ?? 0; }
      this.db.prepare("INSERT INTO demo_completions (employee_id, event_id, command_id, payload) VALUES (?, ?, ?, ?)").run(employee.employee_id, eventId, commandId, JSON.stringify(completion));
      // Existing assistant version checks now reject in-flight/old advice.
      this.db.prepare("UPDATE dataset SET revision = revision + 1 WHERE id = 1").run();
      this.db.exec("COMMIT");
      return { completion, repeated: false };
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  import(input: { employees?: string; history?: string }, expectedRevision: number) {
    return this.transaction(expectedRevision, snapshot => {
      const result = mergeImport(snapshot.data, input);
      const demoRows = this.db.prepare("SELECT employee_id, event_id FROM demo_completions").all() as { employee_id: string; event_id: string }[];
      if (demoRows.some(c => result.data.history.some(h => h.employee_id === c.employee_id && h.event_id === c.event_id && h.status === "completed" && !snapshot.data.history.some(old => old.record_id === h.record_id)))) throw new Error("Imported completion conflicts with a recorded demo completion; reset the demo before importing this history");
      return { data: result.data, result: result.summary };
    });
  }
  reset(expectedRevision: number) {
    const seed = loadFixtures();
    return this.transaction(expectedRevision, () => {
      this.db.exec("DELETE FROM planning; DELETE FROM planning_actions; DELETE FROM demo_completions; UPDATE review_scope SET epoch = epoch + 1 WHERE id = 1;");
      return { data: seed, result: { reset: true } };
    });
  }
  private transaction<T>(expectedRevision: number, update: (snapshot: Snapshot) => { data: Dataset; result: T }) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const snapshot = this.rawRead();
      if (snapshot.revision !== expectedRevision) throw new Error("Dataset changed; preview again before applying");
      const next = update(snapshot);
      this.db.prepare("UPDATE dataset SET revision = revision + 1, payload = ? WHERE id = 1").run(JSON.stringify(next.data));
      this.db.exec("COMMIT");
      return { revision: snapshot.revision + 1, ...next.result };
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  planning(employeeId: string): PlanningState {
    const employee = this.read().data.employees.find(e => e.employee_id === employeeId);
    if (!employee) throw new Error("Employee not found");
    const row = this.db.prepare("SELECT revision, payload FROM planning WHERE employee_id = ?").get(employeeId) as { revision: number; payload: string } | undefined;
    return row ? { revision: row.revision, plan: planSchema.parse(JSON.parse(row.payload)) } : { revision: 0, plan: initialPlan(employee) };
  }
  savePlanning(actor: Actor, employeeId: string, expectedDatasetRevision: number, expectedRevision: number, input: unknown) {
    if (actor.accessRole !== "employee" || actor.employeeId !== employeeId) throw new Error("Forbidden");
    const plan = planSchema.parse(input);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const snapshot = this.read();
      if (snapshot.revision !== expectedDatasetRevision) throw new Error("Dataset changed; reload before saving");
      const previous = this.planning(employeeId);
      if (previous.revision !== expectedRevision) throw new Error("Plan changed; reload before saving");
      validatePlan(plan, snapshot.data);
      // Imported attribution cannot be forged or retained on rewritten aspirations.
      for (const goal of plan.goals) {
        const old = previous.plan.goals.find(g => g.id === goal.id);
        if (goal.origin === "imported" && (!old || old.origin !== "imported" || goal.wording !== old.wording || JSON.stringify(goal.target) !== JSON.stringify(old.target))) throw new Error("Edited goals must have employee origin");
      }
      const payload = JSON.stringify(plan);
      this.db.prepare("INSERT INTO planning VALUES (?, ?, ?) ON CONFLICT(employee_id) DO UPDATE SET revision = excluded.revision, payload = excluded.payload").run(employeeId, previous.revision + 1, payload);
      this.db.prepare("INSERT INTO planning_actions (employee_id, actor_id, dataset_revision, state_revision, happened_at, before_payload, after_payload) VALUES (?, ?, ?, ?, ?, ?, ?)").run(employeeId, actor.employeeId!, snapshot.revision, previous.revision + 1, new Date().toISOString(), JSON.stringify(previous.plan), payload);
      this.db.exec("COMMIT");
      return { revision: previous.revision + 1, plan };
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  reviews(actor: Actor, employeeId: string): ReviewCycle[] {
    const employee = this.read().data.employees.find(e => e.employee_id === employeeId);
    if (!employee || !canReadReview(actor, employee)) throw new Error("Forbidden");
    const rows = this.db.prepare("SELECT payload FROM review_revisions WHERE scope = (SELECT epoch FROM review_scope WHERE id = 1) AND employee_id = ? ORDER BY quarter DESC, revision DESC").all(employeeId) as { payload: string }[];
    return rows.map(row => JSON.parse(row.payload) as ReviewCycle);
  }
  createReview(actor: Actor, quarter: string, datasetRevision: number, planRevision: number): ReviewCycle {
    if (actor.accessRole !== "employee" || !actor.employeeId) throw new Error("Forbidden");
    const period = quarterPeriod(quarter);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const snapshot = this.read();
      const planning = this.planning(actor.employeeId);
      if (snapshot.revision !== datasetRevision || planning.revision !== planRevision) throw new Error("Context changed");
      const existing = this.reviews(actor, actor.employeeId).find(r => r.quarter === quarter);
      if (existing) { this.db.exec("COMMIT"); return existing; }
      if (period.periodEnd > snapshot.data.meta.as_of_date) throw new Error("Quarter has not ended on the dataset clock");
      const target = focusTarget(planning.plan);
      const profile = target && snapshot.data.role_profiles.find(p => p.role === target.target_role && p.grade === target.target_grade);
      if (!profile || !Object.keys(profile.required_skills).length) throw new Error("Choose a role-linked focus goal first");
      const employee = snapshot.data.employees.find(e => e.employee_id === actor.employeeId)!;
      const cycle: ReviewCycle = {
        id: randomUUID(), employeeId: employee.employee_id, quarter, ...period,
        revision: 1, status: "draft", action: "created", actorId: actor.employeeId, happenedAt: new Date().toISOString(),
        reviewerId: employee.manager_id === employee.employee_id ? null : employee.manager_id,
        target: { role: profile.role, grade: profile.grade, requiredSkills: profile.required_skills, criticalSkills: profile.critical_skills, proficiencyScale: snapshot.data.proficiency_scale ?? null },
        items: Object.keys(profile.required_skills).map(skillId => ({ skillId, selfRating: null, justification: "" })), evidence: null,
      };
      this.appendReview(cycle); this.db.exec("COMMIT"); return cycle;
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  updateReview(actor: Actor, id: string, expectedRevision: number, datasetRevision: number, action: "save" | "submit" | "reopen", items: ReviewItem[]): ReviewCycle {
    if (actor.accessRole !== "employee" || !actor.employeeId) throw new Error("Forbidden");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const snapshot = this.read();
      if (snapshot.revision !== datasetRevision) throw new Error("Context changed");
      const current = this.reviews(actor, actor.employeeId).find(r => r.id === id);
      if (!current) throw new Error("Forbidden");
      const nextAction = action === "save" ? "saved" : action === "submit" ? "submitted" : "reopened";
      if (current.revision === expectedRevision + 1 && current.action === nextAction && (action === "reopen" || JSON.stringify(current.items) === JSON.stringify(items))) { this.db.exec("COMMIT"); return current; }
      if (current.revision !== expectedRevision) throw new Error("Context changed");
      if ((action === "reopen" && !["submitted", "returned"].includes(current.status)) || (action !== "reopen" && current.status !== "draft")) throw new Error("Invalid review transition");
      validateReviewItems(action === "reopen" ? current.items : items, current.target.requiredSkills, action === "submit");
      const employee = snapshot.data.employees.find(e => e.employee_id === actor.employeeId)!;
      const relevantEvents = snapshot.data.events.filter(e => e.develops_skills.some(g => Object.hasOwn(current.target.requiredSkills, g.skill_id)));
      const now = new Date().toISOString();
      const next: ReviewCycle = { ...current, revision: current.revision + 1, status: action === "submit" ? "submitted" : "draft", action: nextAction, actorId: actor.employeeId, happenedAt: now, reviewerId: employee.manager_id === employee.employee_id ? null : employee.manager_id,
        items: action === "reopen" ? current.items : items, decision: null,
        evidence: action === "submit" ? { datasetRevision: snapshot.revision, asOfDate: snapshot.data.meta.as_of_date, capturedAt: now, assessment: { skills: skillAssessments(employee, snapshot.data).values, lastReviewDate: employee.last_review_date, approvedSources: Object.fromEntries([...skillAssessments(employee, snapshot.data).observations].map(([id, value]) => [id, value.decisionId])) }, history: snapshot.data.history.filter(h => h.employee_id === employee.employee_id && relevantEvents.some(e => e.event_id === h.event_id)), activities: relevantEvents, demoCompletions: (snapshot.data.demo_completions ?? []).filter(c => c.employee_id === employee.employee_id && relevantEvents.some(e => e.event_id === c.event_id)) } : null,
      };
      this.appendReview(next); this.db.exec("COMMIT"); return next;
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  decideReview(actor: Actor, raw: ReviewDecisionCommand): ReviewCycle {
    const input = reviewDecisionSchema.parse(raw);
    input.ratings.sort((a, b) => a.skillId.localeCompare(b.skillId));
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const snapshot = this.read();
      const employee = snapshot.data.employees.find(e => e.employee_id === input.employeeId);
      if (!employee || !canDecideReview(actor, employee)) throw new Error("Forbidden");
      const actorId = actor.accessRole === "hr" ? "hr_demo" : actor.employeeId!;
      const previous = this.db.prepare("SELECT actor_id, command, result FROM review_decisions WHERE scope = (SELECT epoch FROM review_scope WHERE id = 1) AND command_id = ?").get(input.commandId) as { actor_id: string; command: string; result: string } | undefined;
      if (previous) {
        if (previous.actor_id !== actorId || previous.command !== JSON.stringify(input)) throw new Error("Context changed");
        this.db.exec("COMMIT"); return JSON.parse(previous.result);
      }
      if (snapshot.revision !== input.datasetRevision) throw new Error("Context changed");
      const current = this.reviews(actor, input.employeeId).find(r => r.id === input.id);
      if (!current) throw new Error("Forbidden");
      if (current.revision !== input.revision || current.status !== "submitted") throw new Error("Context changed");
      if (!current.evidence) throw new Error("Missing submission evidence");
      validateReviewItems(current.items, current.target.requiredSkills, true);
      if (input.action === "return" && input.ratings.length) throw new Error("Return must not set ratings");
      if (input.action === "approve") {
        validateReviewItems(input.ratings.map(r => ({ skillId: r.skillId, selfRating: r.finalRating, justification: input.comment })), current.target.requiredSkills, true);
        const observations = skillAssessments(employee, snapshot.data).observations;
        for (const rating of input.ratings) {
          const accepted = observations.get(rating.skillId);
          if ((accepted?.decisionId ?? null) !== (current.evidence.assessment.approvedSources?.[rating.skillId] ?? null) || accepted && (accepted.quarter > current.quarter || accepted.evidenceAsOf > current.evidence.asOfDate)) throw new Error("Assessment changed; resubmit review");
        }
      }
      const now = new Date().toISOString();
      const decision: NonNullable<ReviewCycle["decision"]> = { commandId: input.commandId, type: input.action, actorId, actorRole: actor.accessRole, submissionRevision: current.revision, comment: input.comment, ratings: input.ratings, decidedAt: now, calibration: "not_run" };
      const next: ReviewCycle = { ...current, revision: current.revision + 1, status: input.action === "approve" ? "approved" : "returned", action: input.action === "approve" ? "approved" : "returned", actorId, happenedAt: now, decision };
      this.appendReview(next);
      if (input.action === "approve") {
        for (const rating of input.ratings) {
          const observation: ApprovedAssessment = { employeeId: employee.employee_id, skillId: rating.skillId, value: rating.finalRating, reviewId: current.id, decisionId: input.commandId, quarter: current.quarter, evidenceAsOf: current.evidence.asOfDate, includedDemoIds: current.evidence.demoCompletions.map(c => c.id), approvedAt: now, actorId };
          this.db.prepare("INSERT INTO approved_assessments VALUES ((SELECT epoch FROM review_scope WHERE id = 1), ?, ?, ?) ON CONFLICT(scope, employee_id, skill_id) DO UPDATE SET payload = excluded.payload").run(employee.employee_id, rating.skillId, JSON.stringify(observation));
        }
        this.db.prepare("UPDATE dataset SET revision = revision + 1 WHERE id = 1").run();
      }
      this.db.prepare("INSERT INTO review_decisions VALUES ((SELECT epoch FROM review_scope WHERE id = 1), ?, ?, ?, ?)").run(input.commandId, actorId, JSON.stringify(input), JSON.stringify(next));
      this.db.exec("COMMIT"); return next;
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  private appendReview(cycle: ReviewCycle) {
    this.db.prepare("INSERT INTO review_revisions VALUES ((SELECT epoch FROM review_scope WHERE id = 1), ?, ?, ?, ?, ?)").run(cycle.id, cycle.employeeId, cycle.quarter, cycle.revision, JSON.stringify(cycle));
  }
  createSession(token: string, accessRole: "employee" | "hr", employeeId: string | null) {
    this.db.prepare("DELETE FROM sessions WHERE expires < ?").run(Date.now());
    this.db.prepare("INSERT INTO sessions VALUES (?, ?, ?, ?)").run(token, accessRole, employeeId, Date.now() + 8 * 60 * 60 * 1000);
  }
  session(token: string) {
    return this.db.prepare("SELECT access_role AS accessRole, employee_id AS employeeId FROM sessions WHERE token = ? AND expires > ?").get(token, Date.now()) as { accessRole: "employee" | "hr"; employeeId: string | null } | undefined;
  }
  deleteSession(token: string) { this.db.prepare("DELETE FROM sessions WHERE token = ?").run(token); }
  close() { this.db.close(); }
}
