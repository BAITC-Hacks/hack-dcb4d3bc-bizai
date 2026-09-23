import { constraintReasons, consultationReadiness, emptyConsultation, type Consultation } from "./consultation";
import { eligibility, audienceContext, audiencePolicyVersion } from "../career/eligibility";
import { development, skillAssessments } from "../career/skills";
import { focusTarget, type PlanningState } from "../career/planning";
import type { Employee, Snapshot } from "../career/types";
import type { Advice, AssistantMode, Evidence } from "./contracts";
import { adviceSchema } from "./contracts";

export function buildAssistantContext(snapshot: Snapshot, employee: Employee, planning: PlanningState, mode: AssistantMode, eventId: string | null, consultation: Consultation = emptyConsultation) {
  const { data } = snapshot;
  const focus = planning.plan.goals.find(g => g.id === planning.plan.focusId) ?? null;
  const progress = development({ ...employee, career_goal: focusTarget(planning.plan) }, data);
  const assessments = skillAssessments(employee, data);
  const history = data.history.filter(h => h.employee_id === employee.employee_id);
  const facts: Evidence[] = [
    { id: "profile", label: "Profile", source: `employees.json:${employee.employee_id}`, value: { role: employee.role, grade: employee.grade, work_format: employee.work_format, last_review_date: employee.last_review_date } },
    { id: "goal", label: "Focus goal", source: `planning:${employee.employee_id}:${planning.revision}`, value: focus },
    { id: "policy", label: "Calculation rules", source: audiencePolicyVersion, value: { as_of_date: data.meta.as_of_date, eligibility: "Complete current OR explicitly focused target role/grade pair (prototype mobility policy, not enrollment permission); real prerequisites; voluntary, available and not already completed/in progress. EV_036 is repeatable.", skill_gain: "Synthetic catalog rule, not measured competence. Historical dates are completion proxies.", feedback_rating: "Employee rating of the activity, not employee competence.", authority: "Advice cannot change assessed skills, certify a module or promote an employee." } },
  ];
  for (const gap of progress.gaps) facts.push({ id: `gap:${gap.id}`, label: gap.name, source: `computed:${employee.employee_id}:role_profiles:${progress.target?.target_role}:${progress.target?.target_grade}`, value: { ...gap, assessment_recorded: Object.hasOwn(assessments.values, gap.id), approved_observation: assessments.observations.get(gap.id) ?? null, missing_assessment_policy: "Missing skills compute as zero; absence is not proof of inability." } });
  for (const milestone of planning.plan.milestones.filter(m => m.goalId === focus?.id).slice(0, 15)) facts.push({ id: `milestone:${milestone.id}`, label: milestone.outcome, source: `planning:${employee.employee_id}:${planning.revision}`, value: milestone });
  const activities = data.events.map(event => {
    const reasons = [...eligibility(employee, event, data, focusTarget(planning.plan)), ...constraintReasons(event, consultation)];
    const contributions = event.develops_skills.flatMap(gain => {
      const gap = progress.gaps.find(g => g.id === gain.skill_id);
      if (!gap || !gap.gap) return [];
      const after = Math.max(gap.level, Math.min(5, gap.level + gain.gain, gain.max_level));
      return after > gap.level ? [{ skill_id: gap.id, before: gap.level, after, required: gap.required, critical: gap.critical, improvement: Math.min(after - gap.level, gap.gap) }] : [];
    });
    return { ...event, audienceContext: audienceContext(employee, event, focusTarget(planning.plan)), reasons, contributions, score: contributions.reduce((sum, c) => sum + c.improvement * (c.critical ? 10 : 1), 0) };
  });
  const candidates = focus?.target ? activities.filter(a => !a.reasons.length && a.score > 0).sort((a, b) => b.score - a.score || a.duration_hours - b.duration_hours || a.event_id.localeCompare(b.event_id)).slice(0, 8) : [];
  const selected = eventId ? activities.find(a => a.event_id === eventId) : null;
  if (eventId && !selected) throw new Error("Unknown activity");
  const considered = [...new Map([...candidates, ...activities.filter(a => a.score > 0 && a.reasons.length).sort((a, b) => b.score - a.score).slice(0, 3), ...(selected ? [selected] : [])].map(a => [a.event_id, a])).values()];
  for (const event of considered) {
    const { score: _score, ...visible } = event;
    void _score;
    // Do not send internal ranking weights or hypothetical gains for excluded activities.
    const value = event.reasons.length ? { event_id: event.event_id, title: event.title, format: event.format, duration_hours: event.duration_hours, reasons: event.reasons, prerequisites: event.prerequisites, target_roles: event.target_roles, target_grades: event.target_grades } : visible;
    facts.push({ id: `event:${event.event_id}`, label: event.title, source: `events.json:${event.event_id};computed:eligibility:${employee.employee_id}`, value });
  }
  for (const observation of assessments.observations.values()) facts.push({ id: `assessment:${observation.skillId}`, label: "Approved skill assessment", source: `review:${observation.reviewId}:decision:${observation.decisionId}`, value: observation });
  // Preserve the rows behind behavioral patterns, not inferred motives or preferences.
  const relevantHistory = history.filter(h => considered.some(a => a.event_id === h.event_id) && (h.status !== "completed" || h.date > employee.last_review_date)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
  for (const row of relevantHistory) facts.push({ id: `history:${row.record_id}`, label: `${row.event_id} · ${row.status} · ${row.date}`, source: data.demo_completions?.some(c => c.id === row.record_id) ? `demo_completions:${row.record_id}` : `activity_history.csv:${row.record_id}`, value: { ...row, completed_at: data.demo_completions?.find(c => c.id === row.record_id)?.completed_at ?? null, assessment_boundary: assessments.observations.size ? "Approved assessments have per-skill evidence cutoffs and included completion IDs. Use computed levels; never sum these history rows into an approved baseline." : data.demo_completions?.some(c => c.id === row.record_id) ? "Application demo completion after the imported snapshot; gains are already included in effective skills." : row.date <= employee.last_review_date ? "At or before the latest assessment. Already absorbed into the baseline; NEVER add its gains again or infer a newer skill level from it." : "After the assessment; only completed rows contribute to the computed effective levels.", demonstrated_workplace_competence: false } });
  facts.push({ id: "participation", label: "Participation summary", source: `computed:activity_history.csv:${employee.employee_id}`, value: { total: history.length, completed: history.filter(h => h.status === "completed").length, no_show: history.filter(h => h.status === "no_show").length, dropped: history.filter(h => h.status === "dropped").length, declined: history.filter(h => h.status === "declined").length, missing_absence_reasons: true } });
  const readiness = consultationReadiness(Boolean(focus), Boolean(focus?.target), consultation, candidates.length);
  facts.push({ id: "consultation", label: "Confirmed development constraints", source: `consultation:${employee.employee_id}:${snapshot.revision}:${planning.revision}:${consultation.revision}`, value: { ...consultation, attributed_to: employee.employee_id, verified: false, readiness, duration_definition: "Maximum total catalog hours per activity, not hours per week; empty formats means any format. Notes are self-report and may require clarification, never verified competence." } });
  return { consultation, readiness, mode, eventId, datasetRevision: snapshot.revision, planRevision: planning.revision, focus, candidates, facts, targets: data.role_profiles.map(p => ({ role: p.role, grade: p.grade })) };
}
export type AssistantContext = ReturnType<typeof buildAssistantContext>;

export function validateAdvice(input: unknown, context: AssistantContext): Advice {
  const advice = adviceSchema.parse(input);
  if (context.mode === "hr" && (advice.recommendations.length || advice.goal_draft)) throw new Error("HR briefs cannot propose employee-owned changes");
  const ids = new Set(context.facts.map(f => f.id));
  for (const item of [...advice.insights, ...advice.recommendations]) {
    if (new Set(item.evidence_ids).size !== item.evidence_ids.length || item.evidence_ids.some(id => !ids.has(id))) throw new Error("Unsupported evidence reference");
  }
  if (!context.focus && advice.recommendations.length) throw new Error("Clarify the missing goal before recommending");
  if (advice.questions.length && advice.recommendations.length) throw new Error("Resolve questions before recommending");
  if (advice.recommendations.length && context.readiness.state !== "ready") throw new Error("Consultation is not ready");
  const recommended = new Set<string>();
  for (const item of advice.recommendations) {
    const candidate = context.candidates.find(c => c.event_id === item.event_id);
    if (!candidate || recommended.has(item.event_id)) throw new Error("Invalid activity selection");
    recommended.add(item.event_id);
    if (!candidate.contributions.some(c => c.skill_id === item.skill_id)) throw new Error("Recommendation needs a contributing skill");
    // These links follow from validated IDs and the saved focus, not model-written citations.
    item.evidence_ids = [...new Set(["goal", "consultation", `event:${item.event_id}`, `gap:${item.skill_id}`, ...item.evidence_ids])];
  }
  const draft = advice.goal_draft;
  if (draft && ((draft.target_role === null) !== (draft.target_grade === null) || draft.target_role && !context.targets.some(p => p.role === draft.target_role && p.grade === draft.target_grade))) throw new Error("Unknown proposed target");
  if (draft && context.focus && draft.wording.trim() === context.focus.wording.trim() && draft.target_role === (context.focus.target?.target_role ?? null) && draft.target_grade === (context.focus.target?.target_grade ?? null)) advice.goal_draft = null;
  return advice;
}
