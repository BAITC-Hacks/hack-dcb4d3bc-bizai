import { AssistantStore } from "@/lib/server/assistant-store";
import { focusTarget } from "@/lib/career/planning";
import { getI18n } from "@/lib/i18n/server";
import { Users, GraduationCap, CheckCircle2, Target } from "lucide-react";
import Link from "next/link";
import { requireActor } from "@/lib/server/session";
import { repository } from "@/lib/server/repository";
import { development } from "@/lib/career/skills";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; view?: string }> }) {
  const { t, formatDate, formatNumber } = await getI18n();
  await requireActor("hr");
  const { q = "", status = "all", view = "overview" } = await searchParams;
  const { data, revision } = repository().read();
  const audit = new AssistantStore();
  let decisions: ReturnType<AssistantStore["latestEmployeeDecisions"]>;
  try { decisions = audit.latestEmployeeDecisions(); } finally { audit.close(); }
  const statuses = ["Goal needed", "Not requested", "Advice stale", "AI unavailable", "Next step available", "Awaiting clarification", "No supported next step"];
  const profiles = data.employees.map(employee => {
    const planning = repository().planning(employee.employee_id);
    const decision = decisions.get(employee.employee_id);
    const state = !planning.plan.focusId ? "Goal needed" : !decision ? "Not requested" : decision.datasetRevision !== revision || decision.planRevision !== planning.revision || decision.consultationStale ? "Advice stale" : decision.reason ? "AI unavailable" : decision.advice.recommendations.length ? "Next step available" : decision.advice.questions.length ? "Awaiting clarification" : "No supported next step";
    return { employee, state, progress: development({ ...employee, career_goal: focusTarget(planning.plan) }, data) };
  });
  const gaps = data.skills.map(skill => {
    const relevant = profiles.flatMap(p => p.progress.gaps.filter(gap => gap.id === skill.skill_id));
    return { ...skill, deficient: relevant.filter(gap => gap.gap > 0).length, total: relevant.length };
  }).filter(skill => skill.deficient).sort((a, b) => b.deficient - a.deficient);
  const filtered = profiles.filter(({ employee, state }) => (status === "all" || state === status) && `${employee.full_name} ${employee.employee_id} ${t(employee.role)}`.toLowerCase().includes(q.toLowerCase()));
  return <><div><p className="eyebrow">{t("People & development")}</p><h1 className="mt-2">{t(view === "gaps" ? "Skill gaps" : view === "participation" ? "Participation" : "People")}</h1><p className="mt-2 text-muted-foreground">{t("Snapshot")} {formatDate(data.meta.as_of_date)} · {formatNumber(data.employees.length)} {t("employees ·")} {formatNumber(data.history.length)} {t("participation records")}</p></div>
    {view !== "gaps" && view !== "participation" && <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[{label:t("Employees"),value:data.employees.length,icon:Users},{label:t("Development activities"),value:data.events.filter(e=>!e.mandatory).length,icon:GraduationCap},{label:t("Completed participations"),value:data.history.filter(r=>r.status==="completed").length,icon:CheckCircle2},{label:t("Explicit career goals"),value:profiles.filter(p=>p.progress.target).length,icon:Target}].map(({label,value,icon:Icon})=><Card key={label}><CardContent className="p-5"><div className="flex items-start justify-between gap-2"><p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p><span className="rounded-lg bg-brand-navy/5 p-2 text-brand-navy"><Icon className="h-5 w-5"/></span></div><p className="mt-2 text-3xl font-semibold text-brand-ink">{typeof value === "number" ? formatNumber(value) : value}</p></CardContent></Card>)}</div>}
    {view === "gaps" && <section id="gaps">
    <Card><CardHeader><CardTitle>{t("Common target skill gaps")}</CardTitle></CardHeader><CardContent><p className="mb-4 text-sm text-muted-foreground">{t("Deficient employees / employees whose selected target requires this skill. These are target-grade gaps, not current-grade performance ratings.")}</p><div className="grid gap-3 md:grid-cols-2">{gaps.slice(0, 10).map(skill => <div key={skill.skill_id} className="rounded-xl bg-brand-paper p-3 text-sm"><div className="mb-3 flex justify-between gap-3"><span>{t(skill.name)}</span><strong>{formatNumber(skill.deficient)} / {formatNumber(skill.total)}</strong></div><progress className="skill-progress" aria-label={`${t(skill.name)} · ${t("Gap prevalence")}`} value={skill.deficient} max={skill.total}/></div>)}</div></CardContent></Card>
    </section>}{view !== "gaps" && view !== "participation" && <><Card><CardHeader><CardTitle>{t("Recommendation status")}</CardTitle></CardHeader><CardContent><div className="flex flex-wrap gap-2">{statuses.map(state => <Link key={state} href={`/hr/dashboard?status=${encodeURIComponent(state)}&q=${encodeURIComponent(q)}#employees`} className="rounded-lg border px-3 py-2 text-xs">{t(state)} · {formatNumber(profiles.filter(p => p.state === state).length)}</Link>)}</div></CardContent></Card>
    <section id="employees"><Card><CardHeader><CardTitle>{t("Employees")}</CardTitle></CardHeader><CardContent><form className="mb-4 grid gap-3 sm:grid-cols-[220px_1fr_auto]"><select name="status" aria-label={t("Recommendation status")} defaultValue={status} className="min-w-0 rounded-lg border bg-white p-2 text-xs"><option value="all">{t("All")}</option>{statuses.map(state => <option key={state} value={state}>{t(state)}</option>)}</select><Input aria-label={t("Search employees")} name="q" defaultValue={q} placeholder={t("Name, employee ID, or role")}/><Button variant="outline">{t("Search")}</Button></form><p className="mb-3 text-sm text-muted-foreground">{formatNumber(filtered.length)} {t("profiles · source order, no performance ranking")}</p><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th>{t("Employee")}</th><th>{t("Role / grade")}</th><th>{t("Target")}</th><th>{t("Recommendation status")}</th></tr></thead><tbody>{filtered.map(({ employee, progress, state }) => <tr key={employee.employee_id}><td><Link className="font-medium text-brand-navy underline" href={`/hr/employees/${encodeURIComponent(employee.employee_id)}`}>{employee.full_name}</Link><p className="text-xs text-muted-foreground">{employee.employee_id}</p></td><td>{t(employee.role)}<p className="text-muted-foreground">{t(employee.grade)}</p></td><td>{t(progress.target?.target_role)} · {t(progress.target?.target_grade)}{progress.targetSource !== "explicit" && <p className="text-xs text-muted-foreground">{t("No role-linked focus goal")}</p>}</td><td><Link className="text-brand-navy underline" href={`/hr/employees/${encodeURIComponent(employee.employee_id)}?view=advisor`}>{t(state)}</Link></td></tr>)}</tbody></table></div></CardContent></Card>
    </section></>}{view === "participation" && <section id="participation"><Card><CardHeader><CardTitle>{t("Participation by activity")}</CardTitle></CardHeader><CardContent><p className="mb-3 text-sm text-muted-foreground">{t("All supplied history, grouped by actual status. Mandatory activities are labeled.")}</p><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th>{t("Activity")}</th>{[t("Completed"), t("In progress"), t("No show"), t("Dropped"), t("Declined"), t("Overdue")].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{data.events.map(event => <tr key={event.event_id}><td>{t(event.title)}{event.mandatory && <p className="text-xs text-muted-foreground">{t("Mandatory")}</p>}</td>{["completed", "in_progress", "no_show", "dropped", "declined", "overdue"].map(status => <td key={status}>{data.history.filter(row => row.event_id === event.event_id && row.status === status).length}</td>)}</tr>)}</tbody></table></div></CardContent></Card>
    </section>}
  </>;
}
