import { parse } from "csv-parse/sync";
import { z } from "zod";
import { employeeEnvelope, eventSchema, historySchema, metaSchema, roleSchema, skillSchema, type Dataset, type History } from "./types";

const columns = ["record_id", "employee_id", "event_id", "date", "due_date", "status", "completion_pct", "score", "feedback_rating", "assigned_by"];

export function parseHistory(csv: string): History[] {
  const rows = parse(csv, { bom: true, skip_empty_lines: true, trim: true, columns: (headers: string[]) => {
    if (headers.length !== columns.length || columns.some(key => !headers.includes(key))) throw new Error("CSV columns must match the supplied history format");
    return headers;
  } }) as Record<string, string>[];
  if (rows.length > 100000) throw new Error("History exceeds 100,000 records");
  return rows.map((row, index) => {
    const result = historySchema.safeParse({ ...row,
      due_date: row.due_date || null,
      completion_pct: row.completion_pct === "" ? null : Number(row.completion_pct),
      score: row.score === "" ? null : Number(row.score),
      feedback_rating: row.feedback_rating === "" ? null : Number(row.feedback_rating),
    });
    if (!result.success) throw new Error(`CSV row ${index + 2}: ${result.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
    return result.data;
  });
}

function unique<T>(rows: T[], key: (row: T) => string, name: string) {
  const ids = rows.map(key);
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate ${name} ID`);
}

export function validateDataset(data: Dataset): Dataset {
  unique(data.employees, e => e.employee_id, "employee");
  unique(data.events, e => e.event_id, "event");
  unique(data.skills, e => e.skill_id, "skill");
  unique(data.history, e => e.record_id, "history");
  unique(data.role_profiles, e => JSON.stringify([e.role, e.grade]), "role profile");
  const employees = new Set(data.employees.map(e => e.employee_id));
  const events = new Map(data.events.map(e => [e.event_id, e]));
  const skills = new Set(data.skills.map(e => e.skill_id));
  const hasRole = (role: string, grade: string) => data.role_profiles.some(p => p.role === role && p.grade === grade);
  const checkSkills = (ids: string[]) => { if (ids.some(id => !skills.has(id))) throw new Error("Unknown skill reference"); };
  for (const employee of data.employees) {
    if (!hasRole(employee.role, employee.grade)) throw new Error(`${employee.employee_id}: unknown role/grade`);
    if (employee.career_goal && !hasRole(employee.career_goal.target_role, employee.career_goal.target_grade)) throw new Error(`${employee.employee_id}: unknown career goal`);
    if (employee.manager_id && (!employees.has(employee.manager_id) || employee.manager_id === employee.employee_id)) throw new Error(`${employee.employee_id}: invalid manager reference`);
    if (employee.hire_date > data.meta.as_of_date || employee.last_review_date > data.meta.as_of_date) throw new Error(`${employee.employee_id}: profile date after dataset date`);
    checkSkills(Object.keys(employee.skills));
  }
  for (const profile of data.role_profiles) {
    checkSkills([...Object.keys(profile.required_skills), ...profile.critical_skills]);
    if (profile.critical_skills.some(id => !(id in profile.required_skills))) throw new Error("Critical skill missing requirement");
  }
  for (const event of data.events) {
    checkSkills([...Object.keys(event.prerequisites), ...event.develops_skills.map(s => s.skill_id)]);
    if (event.target_roles.some(role => !data.role_profiles.some(p => p.role === role))) throw new Error(`${event.event_id}: unknown audience role`);
  }
  const voluntaryCompletions = new Set<string>();
  for (const row of data.history) {
    if (!employees.has(row.employee_id) || !events.has(row.event_id)) throw new Error(`${row.record_id}: unknown employee or event`);
    if (row.date > data.meta.as_of_date) throw new Error(`${row.record_id}: history date after dataset date`);
    const event = events.get(row.event_id)!;
    if (row.status === "completed" && !event.mandatory && event.event_id !== "EV_036") {
      const key = JSON.stringify([row.employee_id, row.event_id]);
      if (voluntaryCompletions.has(key)) throw new Error(`${row.record_id}: repeated completion of a non-repeatable activity`);
      voluntaryCompletions.add(key);
    }
  }
  return data;
}

export function parseDataset(input: { employees: string; events: string; skills: string; history: string }): Dataset {
  const employees = employeeEnvelope.parse(JSON.parse(input.employees));
  const events = z.object({ meta: metaSchema, events: z.array(eventSchema) }).parse(JSON.parse(input.events));
  const skills = z.object({ meta: metaSchema, proficiency_scale: z.record(z.string(), z.string()).optional(), skills: z.array(skillSchema), role_profiles: z.array(roleSchema) }).parse(JSON.parse(input.skills));
  if ([events.meta, skills.meta].some(meta => meta.as_of_date !== employees.meta.as_of_date)) throw new Error("Dataset snapshot dates must match");
  return validateDataset({ proficiency_scale: skills.proficiency_scale, meta: employees.meta, employees: employees.employees, events: events.events, skills: skills.skills, role_profiles: skills.role_profiles, history: parseHistory(input.history) });
}

function merge<T>(existing: T[], incoming: T[], key: (row: T) => string) {
  const result = new Map(existing.map(row => [key(row), row]));
  let added = 0;
  for (const row of incoming) {
    const previous = result.get(key(row));
    if (previous && canonical(previous) !== canonical(row)) throw new Error(`Conflicting duplicate ID: ${key(row)}`);
    if (!previous) { result.set(key(row), row); added++; }
  }
  return { rows: [...result.values()], added, unchanged: incoming.length - added };
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

export function mergeImport(base: Dataset, input: { employees?: string; history?: string }) {
  if (!input.employees && !input.history) throw new Error("Choose employee JSON and/or history CSV");
  const envelope = input.employees ? employeeEnvelope.parse(JSON.parse(input.employees)) : null;
  if (envelope && envelope.meta.as_of_date !== base.meta.as_of_date) throw new Error("Import snapshot date must match the active dataset");
  const employees = merge(base.employees, envelope?.employees ?? [], row => row.employee_id);
  const history = merge(base.history, input.history ? parseHistory(input.history) : [], row => row.record_id);
  return {
    data: validateDataset({ ...base, employees: employees.rows, history: history.rows }),
    summary: { employeesAdded: employees.added, employeesUnchanged: employees.unchanged, historyAdded: history.added, historyUnchanged: history.unchanged },
  };
}
