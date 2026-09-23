import { DevelopmentMap } from "./development-map";
import Link from "next/link";
import { ArrowUpRight, ArrowRight, Target, Check, BookOpen } from "lucide-react";
import type { Dataset, Employee } from "@/lib/career/types";
import type { PlanningState } from "@/lib/career/planning";
import { focusTarget } from "@/lib/career/planning";
import { development } from "@/lib/career/skills";
import { AssistantStore } from "@/lib/server/assistant-store";
import { getI18n } from "@/lib/i18n/server";

export async function DevelopmentWorkspace({ employee, data, planning, revision, base }: { employee: Employee; data: Dataset; planning: PlanningState; revision: number; base: string }) {
  const { t } = await getI18n();
  const goal = planning.plan.goals.find(g => g.id === planning.plan.focusId);
  const steps = planning.plan.milestones.filter(m => m.goalId === goal?.id);
  const active = steps.find(m => m.state === "evidence_needed") ?? steps.find(m => m.state === "in_progress") ?? steps.find(m => m.state === "planned");
  const result = development({ ...employee, career_goal: focusTarget(planning.plan) }, data);
  const store = new AssistantStore();
  let decision, consultation;
  try { decision = store.latestEmployeeDecisions().get(employee.employee_id); consultation = store.consultation(employee.employee_id, revision, planning.revision); } finally { store.close(); }
  const stale = decision && (decision.datasetRevision !== revision || decision.planRevision !== planning.revision || decision.consultationStale);
  const recommendations = !stale && !decision?.reason ? decision?.advice.recommendations ?? [] : [];
  const needsEvidence = active?.state === "evidence_needed" || active?.activityIds?.length && active.activityIds.every(id => data.history.some(h => h.employee_id === employee.employee_id && h.event_id === id && h.status === "completed"));
  const next = !goal ? ["Set your direction", "Start with an outcome you care about. A job title is optional.", "Create a goal", "plan"] : needsEvidence ? [active?.state === "evidence_needed" ? "Review the evidence for your milestone" : "Learning done. What can you demonstrate?", "Review your milestone success criterion and add evidence of the outcome. Completion alone does not finish the milestone.", "Review my outcome", "plan"] : active ? ["Continue your next milestone", active.outcome, "Open my plan", "plan"] : stale ? ["Your plan changed", "Refresh your advice before choosing a next step.", "Refresh advice", "advisor"] : !consultation.answers ? ["Make the next step fit your life", "Confirm your available time and preferred learning format.", "Set my preferences", "advisor"] : recommendations.length ? ["Your next step is ready to explore", "Inspect the activity and its evidence before adding it to your plan.", "Review advice", "advisor"] : ["Choose a useful next step", "Work with your advisor or define an action yourself.", "Explore with advisor", "advisor"];
  const hr = base.startsWith("/hr/");
  return <div className="journey-workspace">
    <div className="journey-topline"><span>{t("YOUR NEXT CHAPTER")}</span><Link href={`${base}?view=history`}>{t("View changes")} <ArrowUpRight size={14}/></Link></div>
    <section className="journey-goal"><div><p className="eyebrow">{t("YOUR DIRECTION")}</p><h2>{goal?.wording ?? t("What do you want to make possible?")}</h2><p>{result.target ? `${t(employee.role)} → ${t(result.target.target_role)} · ${t(result.target.target_grade)}` : t("Your goal can be bigger than a job title.")}</p></div><Link href={`${base}?view=plan`} className="journey-outline">{t("Edit direction")} <Target size={16}/></Link></section>
    <DevelopmentMap employee={{ ...employee, career_goal: focusTarget(planning.plan) }} data={data} base={base}/>
    <div className="journey-columns"><div className="space-y-6">
      <section className="journey-next"><span className="journey-kicker"><span/> {t("NEXT ACTION")}</span><h2>{t(next[0])}</h2><p>{t(next[1])}</p><Link href={`${base}?view=${next[3]}`} className="journey-button">{t(next[2])}<ArrowRight size={17}/></Link></section>
      <section className="journey-section"><div className="journey-section-heading"><h2>{t("The plan you own")}</h2><Link href={`${base}?view=plan`}>{t("Manage plan")} <ArrowUpRight size={15}/></Link></div>
      {steps.length ? <ol className="journey-steps">{steps.map((step, index) => <li key={step.id}><span className="journey-step-number">{step.state === "reached" ? <Check size={16}/> : String(index + 1).padStart(2,"0")}</span><div><p className="text-xs text-muted-foreground">{t(step.state)}</p><h3>{step.outcome}</h3><p>{step.criterion}</p>{step.activityIds?.map(id => <Link className="mt-3 inline-block text-sm font-semibold text-teal-800" key={id} href={hr ? `${base}?view=advisor` : `/employee/learning?event=${encodeURIComponent(id)}`}>{t(data.events.find(e=>e.event_id===id)?.title)} →</Link>)}{step.actions && <p className="mt-2 text-sm">{step.actions}</p>}</div><Link href={`${base}?view=plan`} aria-label={`${t("Open my plan")}: ${step.outcome}`}><ArrowUpRight size={18}/></Link></li>)}</ol> : <div className="journey-empty"><BookOpen size={24}/><h3>{t("A goal becomes real through small steps")}</h3><p>{t("Add an outcome and what success looks like. You can change your plan at any time.")}</p><Link href={`${base}?view=plan`}>{t("Create your first milestone")} →</Link></div>}
      </section>
      {!!recommendations.length && <section className="journey-section"><div className="journey-section-heading"><h2>{t("Options worth exploring")}</h2><span>{t("Advisor suggestions")}</span></div>{recommendations.map(r => <div className="journey-option" key={r.event_id}><h3>{t(data.events.find(e => e.event_id === r.event_id)?.title)}</h3><p>{r.reason}</p><Link href={hr ? `${base}?view=advisor` : `/employee/learning?event=${encodeURIComponent(r.event_id)}`}>{t("Explore this activity")} →</Link></div>)}</section>}
    </div><aside className="space-y-5"><section className="journey-evidence"><p className="eyebrow">{t("YOUR EVIDENCE")}</p><p className="journey-count">{result.target ? result.closed : "—"}<span>{result.target ? ` / ${result.gaps.length}` : ""}</span></p><h3>{t("Requirements demonstrated")}</h3><p>{t("Learning builds capability. Assessment evidence closes a formal module.")}</p><Link href={`${base}?view=skills`}>{t("Open development map")} <ArrowUpRight size={16}/></Link></section><section className="journey-note"><p className="eyebrow">{t("KEEP THE DISTINCTION")}</p><h3>{t("Progress is more than a number")}</h3><p>{t("Your plan records intentions. Learning records activity. Assessments record demonstrated skills.")}</p></section><Link href={hr ? `${base}?view=reviews` : "/employee/reviews"} className="journey-review"><span>{t("Prepare your review")}<small>{t("Bring evidence of the work you have done.")}</small></span><ArrowUpRight size={20}/></Link></aside></div>
  </div>;
}
