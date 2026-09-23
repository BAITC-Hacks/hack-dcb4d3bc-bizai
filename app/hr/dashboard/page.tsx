import { Users, GraduationCap, CheckCircle2, Target } from "lucide-react";
import Link from "next/link";
import { requireActor } from "@/lib/server/session";
import { repository } from "@/lib/server/repository";
import { development } from "@/lib/career/skills";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireActor("hr");
  const { q = "" } = await searchParams;
  const { data } = repository().read();
  const profiles = data.employees.map(employee => ({ employee, progress: development(employee, data) }));
  const gaps = data.skills.map(skill => {
    const relevant = profiles.flatMap(p => p.progress.gaps.filter(gap => gap.id === skill.skill_id));
    return { ...skill, deficient: relevant.filter(gap => gap.gap > 0).length, total: relevant.length };
  }).filter(skill => skill.deficient).sort((a, b) => b.deficient - a.deficient);
  const filtered = profiles.filter(({ employee }) => `${employee.full_name} ${employee.employee_id} ${employee.role}`.toLowerCase().includes(q.toLowerCase()));
  return <><div><h1>Development overview</h1><p className="mt-2 text-muted-foreground">Snapshot {data.meta.as_of_date} · {data.employees.length} employees · {data.history.length} participation records</p></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[{label:"Employees",value:data.employees.length,icon:Users},{label:"Development activities",value:data.events.filter(e=>!e.mandatory).length,icon:GraduationCap},{label:"Completed participations",value:data.history.filter(r=>r.status==="completed").length,icon:CheckCircle2},{label:"Explicit career goals",value:data.employees.filter(e=>e.career_goal).length,icon:Target}].map(({label,value,icon:Icon})=><Card key={label}><CardContent className="p-5"><div className="flex items-start justify-between gap-2"><p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p><span className="rounded-lg bg-brand-navy/5 p-2 text-brand-navy"><Icon className="h-5 w-5"/></span></div><p className="mt-2 text-3xl font-semibold text-brand-ink">{value}</p></CardContent></Card>)}</div>
    <section id="gaps">
    <Card><CardHeader><CardTitle>Common target skill gaps</CardTitle></CardHeader><CardContent><p className="mb-4 text-sm text-muted-foreground">Deficient employees / employees whose selected target requires this skill. These are target-grade gaps, not current-grade performance ratings.</p><div className="grid gap-3 md:grid-cols-2">{gaps.slice(0, 10).map(skill => <div key={skill.skill_id} className="rounded-xl bg-brand-paper p-3 text-sm"><div className="mb-3 flex justify-between gap-3"><span>{skill.name}</span><strong>{skill.deficient} / {skill.total}</strong></div><progress className="skill-progress" aria-label={`${skill.name} gap prevalence`} value={skill.deficient} max={skill.total}/></div>)}</div></CardContent></Card>
    </section><Card><CardHeader><CardTitle>Recommendation status</CardTitle></CardHeader><CardContent><p className="text-sm">Not generated: {data.employees.length} employees. Personalized next steps are not available yet.</p></CardContent></Card>
    <section id="employees"><Card><CardHeader><CardTitle>Employees</CardTitle></CardHeader><CardContent><form className="mb-4 flex gap-2"><Input aria-label="Search employees" name="q" defaultValue={q} placeholder="Name, employee ID, or role"/><Button variant="outline">Search</Button></form><p className="mb-3 text-sm text-muted-foreground">{filtered.length} profiles · source order, no performance ranking</p><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th>Employee</th><th>Role / grade</th><th>Target</th></tr></thead><tbody>{filtered.map(({ employee, progress }) => <tr key={employee.employee_id}><td><Link className="font-medium text-brand-navy underline" href={`/hr/employees/${encodeURIComponent(employee.employee_id)}`}>{employee.full_name}</Link><p className="text-xs text-muted-foreground">{employee.employee_id}</p></td><td>{employee.role}<p className="text-muted-foreground">{employee.grade}</p></td><td>{progress.target.target_role} · {progress.target.target_grade}{progress.targetSource !== "explicit" && <p className="text-xs text-muted-foreground">{progress.targetSource === "default" ? "Suggested default" : "Goal unset · current role"}</p>}</td></tr>)}</tbody></table></div></CardContent></Card>
    </section><section id="participation"><Card><CardHeader><CardTitle>Participation by activity</CardTitle></CardHeader><CardContent><p className="mb-3 text-sm text-muted-foreground">All supplied history, grouped by actual status. Mandatory activities are labeled.</p><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th>Activity</th>{["Completed", "In progress", "No show", "Dropped", "Declined", "Overdue"].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{data.events.map(event => <tr key={event.event_id}><td>{event.title}{event.mandatory && <p className="text-xs text-muted-foreground">Mandatory</p>}</td>{["completed", "in_progress", "no_show", "dropped", "declined", "overdue"].map(status => <td key={status}>{data.history.filter(row => row.event_id === event.event_id && row.status === status).length}</td>)}</tr>)}</tbody></table></div></CardContent></Card>
    </section>
  </>;
}
