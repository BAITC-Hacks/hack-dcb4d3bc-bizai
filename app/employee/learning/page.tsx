import { CompletionButton } from "@/components/career/completion-button";
import { effectiveSkills } from "@/lib/career/skills";
import { focusTarget } from "@/lib/career/planning";
import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { redirect } from "next/navigation";
import { requireActor } from "@/lib/server/session";
import { repository } from "@/lib/server/repository";
import { eligibility, audienceContext } from "@/lib/career/eligibility";
import { Card, CardContent } from "@/components/ui/card";
import { ActivityCard } from "@/components/career/activity-card";
import { AssistantPanel } from "@/components/career/assistant-panel";
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; event?: string; q?: string }> }) {
  const { t, formatNumber } = await getI18n();
  const { tab = "eligible", event: selectedId, q = "" } = await searchParams;
  const actor = await requireActor("employee");
  const { data, revision } = repository().read();
  const employee = data.employees.find(e => e.employee_id === actor.employeeId);
  if (!employee) redirect("/");
  const planning = repository().planning(employee.employee_id);
  const target = focusTarget(planning.plan);
  const skills = effectiveSkills(employee, data);
  const completions = (data.demo_completions ?? []).filter(c => c.employee_id === employee.employee_id);
  const names = new Map(data.skills.map(skill => [skill.skill_id, skill.name]));
  const history = data.history.filter(row => row.employee_id === employee.employee_id);
  const completed = new Set(history.filter(row => row.status === "completed").map(row => row.event_id));
  const active = new Set(history.filter(row => row.status === "in_progress").map(row => row.event_id));
  const eligible = new Set(data.events.filter(event => !eligibility(employee,event,data,target).length).map(event => event.event_id));
  const filtered = data.events.filter(event => tab === "eligible" ? eligible.has(event.event_id) : tab === "mandatory" ? event.mandatory : tab === "in_progress" ? active.has(event.event_id) : tab === "completed" ? completed.has(event.event_id) : true).filter(event => `${t(event.title)} ${t(event.description)}`.toLowerCase().includes(q.toLowerCase()));
  const selected = data.events.find(event => event.event_id === selectedId);
  return <><header className="page-heading"><div><p className="eyebrow">{t("Learning")}</p><h1 className="flex items-center gap-3">{t("Development activities")}</h1></div><GraduationCap className="h-6 w-6 text-brand-navy"/></header><details className="text-xs text-muted-foreground"><summary className="cursor-pointer">{t("How availability works")}</summary><p className="mt-3 max-w-3xl leading-6">{t("Eligibility checks your current role/grade or chosen target. Prerequisites and participation rules still apply. Target access is a prototype mobility policy, not enrollment permission.")}</p></details>
    {completions.length > 0 && <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><h2 className="text-sm font-semibold">{t("Recent demo completions")}</h2><p className="mt-1 text-xs">{t("Effective skills updated. Assessment baselines and formal modules are unchanged. Ask the assistant again for an updated next step.")}</p>{completions.slice(-3).reverse().map(c => <div key={c.id} className="mt-3 border-t border-emerald-200 pt-2 text-xs"><strong>{t(data.events.find(e => e.event_id === c.event_id)?.title)}</strong><p>{Object.keys(c.after).map(id => `${t(names.get(id))}: ${formatNumber(c.before[id], 0)} → ${formatNumber(c.after[id], 0)}`).join(" · ")}</p><p className="mt-1 text-muted-foreground">{t("Demo business date")}: {c.business_date} · {t("Recorded at")}: {c.completed_at}</p></div>)}</section>}
    <div className="grid gap-4 sm:grid-cols-3">{[[t("Completed activities"),completed.size],[t("In progress"),active.size],[t("Eligible to explore"),eligible.size]].map(([label,value]) => <Card key={label}><CardContent className="p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold text-brand-navy">{value}</p></CardContent></Card>)}</div>
    <nav aria-label={t("Activity filters")} className="section-tabs">{[["all",t("All activities")],["eligible",t("Eligible")],["in_progress",t("In progress")],["completed",t("Completed")],["mandatory",t("Mandatory")]].map(([value,label]) => <Link key={value} href={`/employee/learning?tab=${value}`} aria-current={tab === value ? "page" : undefined} >{label}</Link>)}</nav>
    <form className="catalog-toolbar"><input type="hidden" name="tab" value={tab}/><label className="flex-1 text-xs font-medium">{t("Search activities")}<input name="q" defaultValue={q} className="mt-2 w-full rounded-lg border px-3 py-2.5 text-sm" placeholder={t("Search activities")}/></label><button className="primary-link" type="submit">{t("Search")}</button><span className="px-2 py-3 text-xs text-muted-foreground">{filtered.length} {t("Activities")}</span></form>
    {selected && <section className="workspace-content"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg">{t(selected.title)}</h2><Link href={`/employee/learning?tab=${tab}`} className="text-sm underline">{t("Back to activities")}</Link></div><AssistantPanel employeeId={employee.employee_id} mode="activity" key={selected.event_id} activities={[{id:selected.event_id,title:selected.title}]}/></section>}
    {!filtered.length && <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-muted-foreground">{t("No activities in this category.")}</div>}
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{filtered.map(event => (
      <div key={event.event_id} className="flex flex-col"><ActivityCard event={event} reasons={eligibility(employee, event, data, target)} skillNames={names} date={data.meta.as_of_date} targetAccess={audienceContext(employee, event, target) === "target"}/>
      <div className="rounded-b-xl border border-t-0 bg-white p-4"><p className="text-xs font-semibold">{t("Expected effective levels")}</p><p className="mt-1 text-xs text-muted-foreground">{event.develops_skills.map(gain => { const before = skills[gain.skill_id] ?? 0; const after = Math.max(before, Math.min(5, before + gain.gain, gain.max_level)); return `${t(names.get(gain.skill_id))}: ${formatNumber(before, 0)} → ${formatNumber(after, 0)}${after === before ? ` (${t("No additional gain")})` : ""}`; }).join(" · ")}</p><Link className="mt-4 inline-flex text-sm font-medium text-brand-navy underline" href={`/employee/learning?tab=${tab}&event=${event.event_id}#assistant`}>{t("Discuss this activity")}</Link>{eligible.has(event.event_id) && <CompletionButton eventId={event.event_id} datasetRevision={revision} planRevision={planning.revision}/>}</div></div>
    ))}</div></>;
}
