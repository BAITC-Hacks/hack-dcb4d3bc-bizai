import { effectiveSkills } from "./skills";
import type { Dataset, Employee, Event } from "./types";

export const audiencePolicyVersion = "career-transition-v1";
export function audienceContext(employee: Employee, event: Event, target: Employee["career_goal"] = null) {
  if (event.target_roles.includes(employee.role) && event.target_grades.includes(employee.grade)) return "current";
  if (target && event.target_roles.includes(target.target_role) && event.target_grades.includes(target.target_grade)) return "target";
  return null;
}
export function eligibility(employee: Employee, event: Event, data: Dataset, target: Employee["career_goal"] = null): string[] {
  const skills = effectiveSkills(employee, data);
  const history = data.history.filter(row => row.employee_id === employee.employee_id && row.event_id === event.event_id);
  const reasons: string[] = [];
  if (event.mandatory) reasons.push("Mandatory activity — excluded from voluntary recommendations");
  if (!audienceContext(employee, event, target)) reasons.push("Outside current and chosen target audiences");
  if (Object.entries(event.prerequisites).some(([id, required]) => (skills[id] ?? 0) < required)) reasons.push("Prerequisites not met");
  if (history.some(row => row.status === "completed") && event.event_id !== "EV_036") reasons.push("Already completed");
  if (history.some(row => row.status === "in_progress")) reasons.push("Already in progress");
  if (event.format !== "self_paced" && !event.upcoming_sessions.some(date => date >= data.meta.as_of_date)) reasons.push("No upcoming session");
  return reasons;
}
