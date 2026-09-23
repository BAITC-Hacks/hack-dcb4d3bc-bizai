import { z } from "zod";
import type { Actor } from "../server/access";
import type { Employee, Dataset } from "./types";

export const reviewItemsSchema = z.array(z.object({
  skillId: z.string().min(1).max(100), selfRating: z.number().int().min(0).max(5).nullable(),
  justification: z.string().max(4000),
}).strict()).max(100);
export type ReviewItem = z.infer<typeof reviewItemsSchema>[number];
export type ReviewCycle = {
  id: string; employeeId: string; quarter: string; periodStart: string; periodEnd: string;
  revision: number; status: "draft" | "submitted"; action: "created" | "saved" | "submitted" | "reopened";
  actorId: string; happenedAt: string; reviewerId: string | null;
  target: { role: string; grade: string; requiredSkills: Record<string, number>; criticalSkills: string[]; proficiencyScale: Record<string, string> | null };
  items: ReviewItem[];
  evidence: { datasetRevision: number; asOfDate: string; capturedAt: string; assessment: { skills: Record<string, number>; lastReviewDate: string }; history: Dataset["history"]; activities: Dataset["events"]; demoCompletions: NonNullable<Dataset["demo_completions"]> } | null;
};
export function canReadReview(actor: Actor | null, employee: Employee) {
  return !!actor && (actor.accessRole === "hr" || actor.employeeId === employee.employee_id || (actor.accessRole === "employee" && actor.employeeId !== null && employee.manager_id === actor.employeeId));
}
export function quarterPeriod(quarter: string) {
  if (!/^20\d{2}-Q[1-4]$/.test(quarter)) throw new Error("Invalid quarter");
  const year = Number(quarter.slice(0, 4)), q = Number(quarter.at(-1));
  return { periodStart: new Date(Date.UTC(year, (q - 1) * 3, 1)).toISOString().slice(0, 10), periodEnd: new Date(Date.UTC(year, q * 3, 0)).toISOString().slice(0, 10) };
}
export function previousQuarter(asOfDate: string) {
  const date = new Date(`${asOfDate}T00:00:00Z`);
  const q = Math.floor(date.getUTCMonth() / 3);
  return `${q === 0 ? date.getUTCFullYear() - 1 : date.getUTCFullYear()}-Q${q === 0 ? 4 : q}`;
}
export function validateReviewItems(items: ReviewItem[], required: Record<string, number>, submit: boolean) {
  reviewItemsSchema.parse(items);
  const ids = items.map(i => i.skillId);
  if (new Set(ids).size !== ids.length || ids.length !== Object.keys(required).length || ids.some(id => !Object.hasOwn(required, id))) throw new Error("Review skills must match the frozen target");
  if (submit && items.some(i => i.selfRating === null || !i.justification.trim())) throw new Error("Every skill needs a rating and business justification");
}
