import { DevelopmentWorkspace } from "./development-workspace";
import Link from "next/link";
import { Target } from "lucide-react";
import { DevelopmentMap } from "./development-map";
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
  const href = (section: string) => `${base}?view=${section}`;
  return <>
    <header className="page-heading"><div><p className="eyebrow">{isHR ? t("Employee record") : t("My development")}</p><h1>{isHR ? employee.full_name : t(tabs.find(([id]) => id === active)![1])}</h1><p className="mt-2 text-sm text-muted-foreground">{employee.full_name} <span className="px-2 text-slate-300">/</span> {t(employee.role)} · {t(employee.grade)}</p></div><span className="status-pill">{t("Assessment:")} {formatDate(employee.last_review_date)}</span></header>
    {isHR && <nav className="section-tabs" aria-label={t("Employee record")}>{tabs.map(([id, label]) => <Link key={id} href={href(id)} aria-current={active === id ? "page" : undefined}>{t(label)}</Link>)}</nav>}
    {active === "overview" && <DevelopmentWorkspace employee={employee} data={data} planning={planning} revision={snapshot.revision} base={base} />}
    {active === "plan" && <div className="workspace-content"><p className="page-description">{t("Define outcomes, actions and success criteria.")}</p><PlanningEditor employeeId={employee.employee_id} key={`${employee.employee_id}-${planning.revision}`} initial={planning} datasetRevision={snapshot.revision} profiles={data.role_profiles} editable={!isHR && actor?.employeeId === employee.employee_id}/></div>}
    {active === "advisor" && <div className="space-y-4"><div className="context-strip"><Target className="h-4 w-4 shrink-0"/><span>{t("Focus goal")}: <strong>{focusedGoal?.wording || t("Choose a focus goal")}</strong></span><Link className="ml-auto shrink-0 underline" href={href("plan")}>{t("My plan")}</Link></div><AssistantPanel key={`${employee.employee_id}-${planning.revision}-${snapshot.revision}`} employeeId={employee.employee_id} mode={isHR ? "hr" : "coach"}/></div>}
    {active === "skills" && <><div className="context-strip">{result.target ? `${t(result.target.target_role)} · ${t(result.target.target_grade)} · ${result.closed}/${result.gaps.length} ${t("Closed modules")}` : t("Choose a target to compare requirements")}</div><DevelopmentMap employee={{ ...employee, career_goal: focusTarget(planning.plan) }} data={data} base={base}/><SkillCards key={`${employee.employee_id}-${planning.revision}`} skills={data.skills.map(skill => {
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
