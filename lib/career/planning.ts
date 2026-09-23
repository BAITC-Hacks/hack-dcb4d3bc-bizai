import { z } from "zod";
import { grades, type Employee, type Dataset } from "./types";
const text = z.string().trim().min(1).max(2000);
export const goalSchema = z.object({ id: z.string().min(1).max(100), wording: text, origin: z.enum(["employee", "imported"]), target: z.object({ target_role: text, target_grade: z.enum(grades) }).nullable() });
export const milestoneSchema = z.object({ id: z.string().min(1).max(100), goalId: z.string(), outcome: text, criterion: text, state: z.enum(["planned", "in_progress", "evidence_needed", "reached", "blocked", "paused"]), evidence: z.string().max(4000), actions: z.string().max(4000), origin: z.literal("employee") });
export const planSchema = z.object({ goals: z.array(goalSchema).max(20), focusId: z.string().nullable(), milestones: z.array(milestoneSchema).max(100) }).superRefine((plan, ctx) => {
  const ids = plan.goals.map(g => g.id);
  if (new Set(ids).size !== ids.length || new Set(plan.milestones.map(m => m.id)).size !== plan.milestones.length) ctx.addIssue({ code: "custom", message: "Duplicate planning ID" });
  if (plan.focusId !== null && !ids.includes(plan.focusId)) ctx.addIssue({ code: "custom", message: "Unknown focus goal" });
  if (plan.goals.length && !plan.focusId) ctx.addIssue({ code: "custom", message: "Choose a focus goal" });
  if (plan.milestones.some(m => !ids.includes(m.goalId))) ctx.addIssue({ code: "custom", message: "Unknown milestone goal" });
});
export type Plan = z.infer<typeof planSchema>;
export type PlanningState = { revision: number; plan: Plan };
export function initialPlan(employee: Employee): Plan {
  return { goals: employee.career_goal ? [{ id: "imported-goal", wording: `${employee.career_goal.target_grade} ${employee.career_goal.target_role}`, origin: "imported", target: employee.career_goal }] : [], focusId: employee.career_goal ? "imported-goal" : null, milestones: [] };
}
export function focusTarget(plan: Plan) { return plan.goals.find(g => g.id === plan.focusId)?.target ?? null; }
export function validatePlan(plan: Plan, data: Dataset) {
  planSchema.parse(plan);
  for (const goal of plan.goals) if (goal.target && !data.role_profiles.some(p => p.role === goal.target!.target_role && p.grade === goal.target!.target_grade)) throw new Error("Unknown target role profile");
}

// Drafts may be incomplete; saved plans still use the strict schema above.
export const draftSchema = z.object({
  goals: z.array(goalSchema.extend({ wording: z.string().max(2000) })).max(20),
  focusId: z.string().nullable(),
  milestones: z.array(milestoneSchema.extend({ outcome: z.string().max(2000), criterion: z.string().max(2000) })).max(100),
});
