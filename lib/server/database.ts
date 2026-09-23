import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseDataset, mergeImport } from "../career/import";
import type { Dataset, Snapshot } from "../career/types";

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
      CREATE TABLE IF NOT EXISTS dataset (id INTEGER PRIMARY KEY CHECK(id = 1), revision INTEGER NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, access_role TEXT NOT NULL, employee_id TEXT, expires INTEGER NOT NULL);`);
    if (!this.db.prepare("SELECT id FROM dataset WHERE id = 1").get()) {
      this.db.prepare("INSERT OR IGNORE INTO dataset VALUES (1, 1, ?)").run(JSON.stringify(seed()));
    }
  }
  read(): Snapshot {
    const row = this.db.prepare("SELECT revision, payload FROM dataset WHERE id = 1").get() as { revision: number; payload: string };
    return { revision: row.revision, data: JSON.parse(row.payload) as Dataset };
  }
  import(input: { employees?: string; history?: string }, expectedRevision: number) {
    return this.transaction(expectedRevision, snapshot => {
      const result = mergeImport(snapshot.data, input);
      return { data: result.data, result: result.summary };
    });
  }
  reset(expectedRevision: number) {
    const seed = loadFixtures();
    return this.transaction(expectedRevision, () => ({ data: seed, result: { reset: true } }));
  }
  private transaction<T>(expectedRevision: number, update: (snapshot: Snapshot) => { data: Dataset; result: T }) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const snapshot = this.read();
      if (snapshot.revision !== expectedRevision) throw new Error("Dataset changed; preview again before applying");
      const next = update(snapshot);
      this.db.prepare("UPDATE dataset SET revision = revision + 1, payload = ? WHERE id = 1").run(JSON.stringify(next.data));
      this.db.exec("COMMIT");
      return { revision: snapshot.revision + 1, ...next.result };
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
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
