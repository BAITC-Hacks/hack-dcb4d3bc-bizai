import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { consultationAnswersSchema, type ConsultationAnswers, type Consultation } from "../ai/consultation";
import type { AssistantResult } from "../ai/contracts";

// Separate adapter, same database: AI audit records cannot mutate domain assessments.
export class AssistantStore {
  private db: DatabaseSync;
  constructor(path = process.env.DATABASE_PATH ?? ".data/career-quest.sqlite") {
    if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA busy_timeout = 500;
      CREATE TABLE IF NOT EXISTS assistant_consultations (
        employee_id TEXT NOT NULL, dataset_revision INTEGER NOT NULL, plan_revision INTEGER NOT NULL,
        revision INTEGER NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL, answers TEXT NOT NULL,
        PRIMARY KEY (employee_id, dataset_revision, plan_revision, revision)
      );
      CREATE TABLE IF NOT EXISTS assistant_turns (
        id TEXT PRIMARY KEY, scope TEXT NOT NULL, employee_id TEXT NOT NULL,
        dataset_revision INTEGER NOT NULL, plan_revision INTEGER NOT NULL,
        mode TEXT NOT NULL, event_id TEXT NOT NULL, created_at TEXT NOT NULL,
        payload TEXT NOT NULL, prompt_version TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS assistant_context ON assistant_turns(scope, employee_id, dataset_revision, plan_revision, mode, event_id, created_at);`);
  }
  consultation(employeeId: string, datasetRevision: number, planRevision: number): Consultation {
    const row = this.db.prepare("SELECT revision, answers FROM assistant_consultations WHERE employee_id = ? AND dataset_revision = ? AND plan_revision = ? ORDER BY revision DESC LIMIT 1").get(employeeId, datasetRevision, planRevision) as { revision: number; answers: string } | undefined;
    return row ? { revision: row.revision, answers: consultationAnswersSchema.parse(JSON.parse(row.answers)) } : { revision: 0, answers: null };
  }
  saveConsultation(employeeId: string, datasetRevision: number, planRevision: number, revision: number, input: ConsultationAnswers): Consultation {
    const answers = consultationAnswersSchema.parse(input);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const dataset = this.db.prepare("SELECT revision FROM dataset WHERE id = 1").get() as { revision: number };
      const plan = this.db.prepare("SELECT revision FROM planning WHERE employee_id = ?").get(employeeId) as { revision: number } | undefined;
      if (dataset.revision !== datasetRevision || (plan?.revision ?? 0) !== planRevision) throw new Error("Context changed");
      const current = this.consultation(employeeId, datasetRevision, planRevision);
      // Identical retries do not create another revision; stale different edits are rejected.
      if (current.revision === revision + 1 && JSON.stringify(current.answers) === JSON.stringify(answers)) {
        this.db.exec("COMMIT"); return current;
      }
      if (current.revision !== revision) throw new Error("Context changed");
      const next = { revision: revision + 1, answers };
      this.db.prepare("INSERT INTO assistant_consultations VALUES (?, ?, ?, ?, ?, ?, ?)").run(employeeId, datasetRevision, planRevision, next.revision, `employee:${employeeId}`, new Date().toISOString(), JSON.stringify(answers));
      this.db.exec("COMMIT"); return next;
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  get(id: string, scope: string, employeeId: string): AssistantResult | null {
    const row = this.db.prepare("SELECT payload FROM assistant_turns WHERE id = ? AND scope = ? AND employee_id = ?").get(id, scope, employeeId) as { payload: string } | undefined;
    return row ? JSON.parse(row.payload) : null;
  }
  history(scope: string, employeeId: string, datasetRevision: number, planRevision: number, mode: string, eventId: string | null, consultationRevision = 0): AssistantResult[] {
    const rows = this.db.prepare("SELECT payload FROM assistant_turns WHERE scope = ? AND employee_id = ? AND dataset_revision = ? AND plan_revision = ? AND mode = ? AND event_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 6").all(scope, employeeId, datasetRevision, planRevision, mode, eventId ?? "") as { payload: string }[];
    return rows.reverse().map(row => JSON.parse(row.payload) as AssistantResult).filter(turn => (turn.consultationRevision ?? 0) === consultationRevision);
  }
  conversation(scope: string, employeeId: string, datasetRevision: number, planRevision: number, mode: string, eventId: string | null): AssistantResult[] {
    const rows = this.db.prepare("SELECT payload FROM assistant_turns WHERE scope = ? AND employee_id = ? AND dataset_revision = ? AND plan_revision = ? AND mode = ? AND event_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 6").all(scope, employeeId, datasetRevision, planRevision, mode, eventId ?? "") as { payload: string }[];
    return rows.reverse().map(row => JSON.parse(row.payload) as AssistantResult);
  }
  latestEmployeeDecisions(): Map<string, AssistantResult & { consultationStale: boolean }> {
    const rows = this.db.prepare("SELECT employee_id, payload FROM assistant_turns WHERE scope = 'employee:' || employee_id AND mode IN ('coach', 'activity') ORDER BY created_at DESC, rowid DESC").all() as { employee_id: string; payload: string }[];
    const latest = new Map<string, AssistantResult & { consultationStale: boolean }>();
    for (const row of rows) if (!latest.has(row.employee_id)) {
      const turn = JSON.parse(row.payload) as AssistantResult;
      // Small talk must not replace a still-current development recommendation.
      if (!turn.reason && ["conversation", "explain"].includes(turn.advice.intent ?? "") && !turn.advice.recommendations.length && !turn.advice.goal_draft && !turn.advice.consultation_draft) continue;
      latest.set(row.employee_id, { ...turn, consultationStale: this.consultation(row.employee_id, turn.datasetRevision, turn.planRevision).revision !== (turn.consultationRevision ?? 0) });
    }
    return latest;
  }
  limited(scope: string) {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM assistant_turns WHERE scope = ? AND created_at > ?").get(scope, new Date(Date.now() - 60000).toISOString()) as { count: number };
    return row.count >= 6;
  }
  save(scope: string, employeeId: string, result: AssistantResult, promptVersion: string) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const dataset = this.db.prepare("SELECT revision FROM dataset WHERE id = 1").get() as { revision: number };
      const plan = this.db.prepare("SELECT revision FROM planning WHERE employee_id = ?").get(employeeId) as { revision: number } | undefined;
      if (dataset.revision !== result.datasetRevision || (plan?.revision ?? 0) !== result.planRevision || this.consultation(employeeId, result.datasetRevision, result.planRevision).revision !== (result.consultationRevision ?? 0)) throw new Error("Context changed");
      this.db.prepare("INSERT INTO assistant_turns VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(result.id, scope, employeeId, result.datasetRevision, result.planRevision, result.mode, result.eventId ?? "", result.createdAt, JSON.stringify(result), promptVersion);
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  close() { this.db.close(); }
}
