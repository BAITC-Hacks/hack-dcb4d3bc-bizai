import Link from "next/link";
import { ArrowRight, Target, BookOpen, CheckCircle2 } from "lucide-react";
import { DevelopmentFlow } from "./development-flow";
import { SkillCards } from "./skill-cards";
import { PlanningEditor } from "./planning-editor";
import { AssistantPanel } from "./assistant-panel";
import { ReviewPanel } from "./review-panel";
import { repository } from "@/lib/server/repository";
import { getActor } from "@/lib/server/session";
import { focusTarget } from "@/lib/career/planning";
import { getI18n } from "@/lib/i18n/server";
import { development } from "@/lib/career/skills";
import type { Dataset, Employee } from "@/lib/career/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function DevelopmentPanel({ employee, data, view = "overview" }: { employee: Employee; data: Dataset; view?: string }) {
  const { t, formatDate, formatNumber } = await getI18n();
  const store = repository();
  const actor = await getActor();
  const snapshot = store.read();
  data = snapshot.data;
  employee = data.employees.find(item => item.employee_id === employee.employee_id)!;
  const planning = store.planning(employee.employee_id);
  const result = development({ ...employee, career_goal: focusTarget(planning.plan) }, data);
  const history = data.history.filter(row => row.employee_id === employee.employee_id).sort((a, b) => b.date.localeCompare(a.date));
  const names = new Map(data.events.map(event => [event.event_id, event.title]));

  const isHR = actor?.accessRole === "hr";
  const base = isHR ? `/hr/employees/${employee.employee_id}` : "/employee/dashboard";
  const tabs = [["overview", "Overview"], ["plan", "My plan"], ["advisor", "Development advisor"], ["skills", "Skills & strengths"], ["history", "Learning history"], ...(isHR ? [["reviews", "Reviews"]] : [])];
  const active = tabs.some(([id]) => id === view) ? view : "overview";
  const focusedGoal = planning.plan.goals.find(g => g.id === planning.plan.focusId);
  const critical = result.gaps.filter(g => g.critical && !g.closed);
  const href = (section: string) => `${base}?view=${section}`;
  return <>
    <header className="page-heading"><div><p className="eyebrow">{isHR ? t("Employee record") : t("My development")}</p><h1>{isHR ? employee.full_name : t(tabs.find(([id]) => id === active)![1])}</h1><p className="mt-2 text-sm text-muted-foreground">{employee.full_name} <span className="px-2 text-slate-300">/</span> {t(employee.role)} · {t(employee.grade)}</p></div><span className="status-pill">{t("Assessment:")} {formatDate(employee.last_review_date)}</span></header>
    {isHR && <nav className="section-tabs" aria-label={t("Employee record")}>{tabs.map(([id, label]) => <Link key={id} href={href(id)} aria-current={active === id ? "page" : undefined}>{t(label)}</Link>)}</nav>}
    {active === "overview" && <>
      <section className="focus-panel"><div className="min-w-0"><p className="eyebrow">{t("Focus goal")}</p><h2 className="mt-3 text-2xl md:text-3xl">{focusedGoal?.wording || t("What would you like to achieve or change?")}</h2><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{focusedGoal ? t("Turn your goal into a plan, choose a useful next step, and keep evidence of your progress.") : t("Start with a goal in your own words. A role or grade is optional.")}</p><Link className="primary-link mt-6" href={href(focusedGoal ? "advisor" : "plan")}>{t(focusedGoal ? "Find my next step" : "Set a goal")}<ArrowRight className="h-4 w-4"/></Link></div><div className="focus-stat"><span className="text-4xl font-semibold tracking-tight">{result.target ? `${result.closed}/${result.gaps.length}` : "—"}</span><span className="mt-2 text-sm text-muted-foreground">{t("Closed modules")}</span><p className="mt-4 text-xs leading-5 text-muted-foreground">{t("Assessment evidence closes modules. Promotion remains a separate decision.")}</p>{result.target && <progress className="skill-progress mt-4" value={result.closed} max={result.gaps.length} aria-label={t("Closed modules")}/>}</div></section>
      <div className="grid gap-4 md:grid-cols-3">{[
        {icon:Target, title:"My plan", text:"Define outcomes, actions and success criteria.", url:href("plan"), value:planning.plan.milestones.filter(m => m.goalId === planning.plan.focusId).length},
        {icon:CheckCircle2, title:"Skills & strengths", text:"Compare your evidence with the target requirements.", url:href("skills"), value:result.target ? `${critical.length} ${t("Critical")}` : "—"},
        {icon:BookOpen, title:"Learning history", text:"See completed activities and recorded participation.", url:href("history"), value:history.filter(h => h.status === "completed").length}
      ].map(({icon:Icon,title,text,url,value}) => <Link href={url} key={title} className="action-card"><div className="flex items-center justify-between"><Icon className="h-5 w-5 text-brand-navy"/><span className="text-sm font-semibold">{value}</span></div><h2 className="mt-5 text-base">{t(title)}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{t(text)}</p><ArrowRight className="mt-4 h-4 w-4 text-brand-navy"/></Link>)}</div>
      <div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle>{t("Priority requirements")}</CardTitle></CardHeader><CardContent>{!result.target ? <Link className="text-sm text-brand-navy underline" href={href("plan")}>{t("Choose a target to compare requirements")}</Link> : critical.length ? <ul className="divide-y">{critical.slice(0,4).map(g => <li key={g.id} className="flex items-center justify-between gap-4 py-3"><span className="text-sm font-medium">{t(g.name)}</span><span className="status-pill">{g.assessed} / {g.required}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">{t("No open critical modules for this target.")}</p>}<Link className="mt-5 inline-block text-sm font-medium text-brand-navy" href={href("skills")}>{t("View skill evidence")} →</Link></CardContent></Card><Card><CardHeader><CardTitle>{t("Recent learning")}</CardTitle></CardHeader><CardContent><ul className="divide-y">{history.filter(h => h.status === "completed").slice(0,3).map(h => <li className="py-3" key={h.record_id}><p className="text-sm font-medium">{t(names.get(h.event_id))}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(h.date)}</p></li>)}</ul>{!history.some(h => h.status === "completed") && <p className="text-sm text-muted-foreground">{t("No participation records yet.")}</p>}<Link className="mt-5 inline-block text-sm font-medium text-brand-navy" href={href("history")}>{t("Full history")} →</Link></CardContent></Card></div>
    </>}
    {active === "plan" && <div className="workspace-content"><p className="page-description">{t("Define outcomes, actions and success criteria.")}</p><PlanningEditor employeeId={employee.employee_id} key={`${employee.employee_id}-${planning.revision}`} initial={planning} datasetRevision={snapshot.revision} profiles={data.role_profiles} editable={!isHR && actor?.employeeId === employee.employee_id}/></div>}
    {active === "advisor" && <div className="space-y-4"><div className="context-strip"><Target className="h-4 w-4 shrink-0"/><span>{t("Focus goal")}: <strong>{focusedGoal?.wording || t("Choose a focus goal")}</strong></span><Link className="ml-auto shrink-0 underline" href={href("plan")}>{t("My plan")}</Link></div><AssistantPanel key={`${employee.employee_id}-${planning.revision}-${snapshot.revision}`} employeeId={employee.employee_id} mode={isHR ? "hr" : "coach"}/></div>}
    {active === "skills" && <><div className="context-strip">{result.target ? `${t(result.target.target_role)} · ${t(result.target.target_grade)} · ${result.closed}/${result.gaps.length} ${t("Closed modules")}` : t("Choose a target to compare requirements")}</div>{result.target && <DevelopmentFlow current={{ role: employee.role, grade: employee.grade }} target={{ role: result.target.target_role, grade: result.target.target_grade }} gaps={result.gaps} goalUnset={result.targetSource === "goal_unset"} />}<SkillCards key={`${employee.employee_id}-${planning.revision}`} skills={data.skills.map(skill => {
      const gap = result.gaps.find(item => item.id === skill.skill_id);
      const inProgress = history.some(row => row.status === "in_progress" && data.events.find(event => event.event_id === row.event_id)?.develops_skills.some(gain => gain.skill_id === skill.skill_id));
      return { id: skill.skill_id, name: skill.name, level: result.skills[skill.skill_id] ?? 0, assessed: employee.skills[skill.skill_id] ?? 0, assessmentRecorded: Object.hasOwn(employee.skills, skill.skill_id), required: gap?.required ?? null, critical: gap?.critical ?? false, closed: gap?.closed ?? false, inProgress };
    }).sort((a, b) => Number(b.critical) - Number(a.critical) || Number(a.closed) - Number(b.closed))} goal={result.target ? `${t(result.target.target_grade)} · ${t(result.target.target_role)}` : null} assessmentDate={employee.last_review_date} /></>}
    {active === "history" && <div className="workspace-content">    <section id="history">
    <Card><CardHeader><CardTitle>{t("Participation history ·")} {formatNumber(history.length)}</CardTitle></CardHeader><CardContent><ol className="space-y-3">{history.map(row => <li key={row.record_id} className="flex gap-3 rounded-xl border bg-brand-paper/40 p-4"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${row.status === "completed" ? "bg-emerald-600" : row.status === "in_progress" ? "bg-brand-gold" : "bg-slate-300"}`} aria-hidden="true"/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="text-sm font-semibold">{t(names.get(row.event_id))}</h3><time className="text-xs text-muted-foreground" dateTime={row.date}>{formatDate(row.date)}</time></div><div className="mt-2 flex items-center justify-between gap-2 text-xs"><span>{t(row.status)}</span><span>{t("Progress")}: {formatNumber(row.completion_pct)}%</span></div><progress className="skill-progress mt-2" aria-label={`${t(names.get(row.event_id))} · ${t("Progress")}`} value={row.completion_pct} max={100}/></div></li>)}</ol>{!history.length && <p>{t("No participation records yet.")}</p>}</CardContent></Card>
    </section></div>}
    {active === "reviews" && isHR && <ReviewPanel employeeId={employee.employee_id} editable={false} skills={data.skills}/>}
  </>;
}
