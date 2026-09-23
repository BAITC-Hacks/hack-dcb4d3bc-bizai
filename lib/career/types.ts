import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, "Invalid calendar date");
const id = z.string().trim().min(1).max(100);
const label = z.string().trim().min(1).max(500);
const levels = z.record(id, z.number().min(0).max(5));
export const grades = ["Junior", "Middle", "Senior", "Lead"] as const;
const grade = z.enum(grades);
export const metaSchema = z.object({ dataset: label, version: label, as_of_date: date });
export const employeeSchema = z.object({
  employee_id: id, full_name: label, department: label, role: label, grade,
  manager_id: id.nullable(), hire_date: date, tenure_months: z.number().int().nonnegative(),
  work_format: z.enum(["office", "hybrid", "remote"]),
  preferred_language: z.enum(["kk", "ru", "en"]),
  career_goal: z.object({ target_role: label, target_grade: grade }).nullable(),
  skills: levels, last_review_date: date,
});
export const eventSchema = z.object({
  event_id: id, title: label, description: z.string(), type: label,
  format: z.enum(["online", "offline", "self_paced"]), duration_hours: z.number().positive(),
  mandatory: z.boolean(), target_roles: z.array(label), target_grades: z.array(grade),
  develops_skills: z.array(z.object({ skill_id: id, gain: z.number().positive().max(5), max_level: z.number().min(0).max(5) })),
  prerequisites: levels, upcoming_sessions: z.array(date),
});
export const skillSchema = z.object({ skill_id: id, name: label, type: z.enum(["hard", "soft"]), category: label, description: z.string() });
export const roleSchema = z.object({ role: label, grade, required_skills: levels, critical_skills: z.array(id) });
export const historySchema = z.object({
  record_id: id, employee_id: id, event_id: id, date, due_date: date.nullable(),
  status: z.enum(["completed", "in_progress", "dropped", "no_show", "declined", "overdue"]),
  completion_pct: z.number().int().min(0).max(100), score: z.number().int().min(0).max(100).nullable(),
  feedback_rating: z.number().int().min(1).max(5).nullable(), assigned_by: z.enum(["self", "manager", "hr"]),
}).superRefine((row, ctx) => {
  if ((row.status === "completed" && row.completion_pct !== 100) ||
      (["no_show", "declined"].includes(row.status) && row.completion_pct !== 0) ||
      (["in_progress", "dropped", "overdue"].includes(row.status) && row.completion_pct > 95) ||
      (row.status === "dropped" && row.completion_pct < 5)) {
    ctx.addIssue({ code: "custom", message: "completion_pct does not match status" });
  }
});
export const employeeEnvelope = z.object({ meta: metaSchema, employees: z.array(employeeSchema).max(10000) });
export type Employee = z.infer<typeof employeeSchema>;
export type Event = z.infer<typeof eventSchema>;
export type History = z.infer<typeof historySchema>;
export type RoleProfile = z.infer<typeof roleSchema>;
export type DemoCompletion = {
  id: string; employee_id: string; event_id: string; completed_at: string; business_date: string;
  gains: Event["develops_skills"]; before: Record<string, number>; after: Record<string, number>;
};
export type ApprovedAssessment = {
  employeeId: string; skillId: string; value: number; reviewId: string; decisionId: string;
  quarter: string; evidenceAsOf: string; includedDemoIds: string[]; approvedAt: string; actorId: string;
};
export type Dataset = {
  approved_assessments?: ApprovedAssessment[];
  proficiency_scale?: Record<string, string>;
  demo_completions?: DemoCompletion[];
  meta: z.infer<typeof metaSchema>;
  employees: Employee[]; events: Event[]; skills: z.infer<typeof skillSchema>[];
  role_profiles: RoleProfile[]; history: History[];
};
export type Snapshot = { revision: number; data: Dataset };
