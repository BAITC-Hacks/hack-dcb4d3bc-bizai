import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { redirect } from "next/navigation";
import { requireActor } from "@/lib/server/session";
import { repository } from "@/lib/server/repository";
import { eligibility } from "@/lib/career/eligibility";
import { Card, CardContent } from "@/components/ui/card";
import { ActivityCard } from "@/components/career/activity-card";
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { t } = await getI18n();
  const { tab = "all" } = await searchParams;
  const actor = await requireActor("employee");
  const { data } = repository().read();
  const employee = data.employees.find(e => e.employee_id === actor.employeeId);
  if (!employee) redirect("/");
  const names = new Map(data.skills.map(skill => [skill.skill_id, skill.name]));
  const history = data.history.filter(row => row.employee_id === employee.employee_id);
  const completed = new Set(history.filter(row => row.status === "completed").map(row => row.event_id));
  const active = new Set(history.filter(row => row.status === "in_progress").map(row => row.event_id));
  const eligible = new Set(data.events.filter(event => !eligibility(employee,event,data).length).map(event => event.event_id));
  const filtered = data.events.filter(event => tab === "eligible" ? eligible.has(event.event_id) : tab === "mandatory" ? event.mandatory : tab === "in_progress" ? active.has(event.event_id) : tab === "completed" ? completed.has(event.event_id) : true);
  return <><h1 className="flex items-center gap-3"><GraduationCap className="h-8 w-8 text-brand-navy"/>{t("Development activities")}</h1><p className="text-muted-foreground">{t("Eligibility uses your current role and grade. Mandatory records stay visible but are excluded from voluntary recommendations.")}</p>
    <div className="grid gap-4 sm:grid-cols-3">{[[t("Completed activities"),completed.size],[t("In progress"),active.size],[t("Eligible to explore"),eligible.size]].map(([label,value]) => <Card key={label}><CardContent className="p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold text-brand-navy">{value}</p></CardContent></Card>)}</div>
    <nav aria-label={t("Activity filters")} className="flex flex-wrap gap-1 rounded-xl bg-brand-mist/60 p-1">{[["all",t("All activities")],["eligible",t("Eligible")],["in_progress",t("In progress")],["completed",t("Completed")],["mandatory",t("Mandatory")]].map(([value,label]) => <Link key={value} href={`/employee/learning?tab=${value}`} aria-current={tab === value ? "page" : undefined} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === value ? "bg-white text-brand-navy shadow-sm" : "text-muted-foreground hover:bg-white/60"}`}>{label}</Link>)}</nav>
    {!filtered.length && <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-muted-foreground">{t("No activities in this category.")}</div>}
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{filtered.map(event => (
      <ActivityCard key={event.event_id} event={event} reasons={eligibility(employee, event, data)} skillNames={names} date={data.meta.as_of_date}/>
    ))}</div></>;
}
