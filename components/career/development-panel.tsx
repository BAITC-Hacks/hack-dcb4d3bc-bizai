import { getI18n } from "@/lib/i18n/server";
import { Compass, Target, CheckCircle2, Sparkles, ArrowUpRight } from "lucide-react";
import { Donut } from "@/components/charts/donut";
import { grades } from "@/lib/career/types";
import { development } from "@/lib/career/skills";
import type { Dataset, Employee } from "@/lib/career/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export async function DevelopmentPanel({ employee, data }: { employee: Employee; data: Dataset }) {
  const { t, formatDate, formatNumber } = await getI18n();
  const result = development(employee, data);
  const history = data.history.filter(row => row.employee_id === employee.employee_id).sort((a, b) => b.date.localeCompare(a.date));
  const names = new Map(data.events.map(event => [event.event_id, event.title]));
  return <>
    <div className="gradient-navy relative overflow-hidden rounded-2xl p-6 text-white shadow-elevated md:p-8">
      <Compass aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-64 w-64 text-white/5"/>
      <div className="relative grid gap-6 xl:grid-cols-[1.4fr_1fr]"><div><p className="text-xs uppercase tracking-[.18em] text-white/60">{t(employee.department)} · {employee.employee_id}</p><h1 className="mt-3 text-3xl text-white">{employee.full_name}</h1><p className="mt-2 text-white/75">{t(employee.grade)} {t(employee.role)}</p><p className="mt-5 text-sm text-white/65">{t("Every step builds on what you already know.")}</p></div>
      <div className="grid grid-cols-3 gap-3 self-end">{[[`${result.coverage}%`, t("Skill coverage")], [history.filter(row => row.status === "completed").length, t("Completed")], [employee.tenure_months, t("Months here")]].map(([value,label]) => <div key={label} className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur"><p className="text-[10px] uppercase tracking-widest text-white/65">{label}</p><p className="mt-2 text-2xl font-semibold">{typeof value === "number" ? formatNumber(value) : value}</p></div>)}</div></div>
    </div>
    <div className="grid gap-3 sm:grid-cols-4" aria-label={t("Current and target grade")}>{grades.map((grade, index) => <div key={grade} className={`rounded-2xl border p-4 ${grade === employee.grade ? "border-brand-gold bg-brand-gold/5" : "border-brand-mist bg-white"}`}><div className="flex items-center justify-between"><span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${grade === employee.grade ? "bg-brand-gold text-white" : "bg-brand-mist text-brand-navy"}`}>{index+1}</span>{grade === employee.grade && <Badge variant="gold">{t("Current")}</Badge>}{grade === result.target.target_grade && grade !== employee.grade && <Badge variant="navy">{t("Target")}</Badge>}</div><p className="mt-3 text-sm font-semibold">{t(grade)}</p></div>)}</div>
    <div className="grid items-start gap-6 xl:grid-cols-[1.6fr_1fr]">
    <div className="space-y-6">
    <section id="trajectory">
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Compass className="h-5 w-5 text-brand-gold"/>{t("Career trajectory")}</CardTitle></CardHeader><CardContent className="space-y-4">
      <p>{t(employee.grade)} {t(employee.role)} → <strong>{t(result.target.target_grade)} {t(result.target.target_role)}</strong></p>
      {result.targetSource === "default" && <p className="text-sm text-muted-foreground">{t("Suggested default: next grade in the current role. No explicit goal is set.")}</p>}
      {result.targetSource === "goal_unset" && <p className="text-sm text-amber-800">{t("No career goal is set. Showing current Lead requirements; discuss a development goal with HR.")}</p>}
      <div className="flex justify-between text-sm"><span>{t("Target skill coverage")}</span><strong>{result.coverage}%</strong></div>
      <progress aria-label={t("Target skill coverage")} value={result.coverage} max={100} className="skill-progress"/>
      <p className="text-xs text-muted-foreground">{t("Coverage measures achieved requirement units, capped per skill. It is not a promotion decision. Unmet critical skills remain visible below.")}</p>
    </CardContent></Card>
    </section><section id="skills"><Card><CardHeader><CardTitle>{t("Skills against target")}</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th>{t("Skill")}</th><th>{t("Effective level")}</th><th>{t("Required")}</th><th>{t("Gap")}</th></tr></thead><tbody>{result.gaps.map(gap => <tr key={gap.id}><td>{t(gap.name)} {gap.critical && <Badge variant={gap.gap ? "warning" : "secondary"}>{t("Critical")}</Badge>}</td><td>{formatNumber(gap.level, 1)}</td><td>{formatNumber(gap.required)}</td><td>{gap.gap > 0 ? formatNumber(gap.gap, 1) : t("Met")}</td></tr>)}</tbody></table></div>
      <p className="mt-4 text-xs text-muted-foreground">{t("Assessment:")} {formatDate(employee.last_review_date)}{t(". Only later completed activity adds gains. Historical CSV dates stand in for completion dates, including self-paced enrollment dates; exact completion-time replay is unavailable.")}</p>
    </CardContent></Card>
    </section></div>
    <aside className="space-y-6"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-brand-navy"/>{t("Your target at a glance")}</CardTitle></CardHeader><CardContent><Donut slices={[{label:t("Requirements met"),value:result.gaps.filter(gap => !gap.gap).length,color:"#003F7D"},{label:t("Skills to develop"),value:result.gaps.filter(gap => gap.gap>0).length,color:"#F39200"}]} centerValue={`${result.gaps.filter(gap => !gap.gap).length}/${result.gaps.length}`} centerLabel={t("Skills at target")}/><div className="mt-5 rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-4"><p className="text-sm font-semibold">{t("Critical gaps: {count}").replace("{count}", formatNumber(result.gaps.filter(gap => gap.critical && gap.gap>0).length))}</p><p className="mt-1 text-xs text-muted-foreground">{t("Prioritize the requirements essential to your target role.")}</p></div></CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-brand-gold"/>{t("Next-step recommendations")}</CardTitle></CardHeader><CardContent><div className="rounded-xl border border-dashed bg-brand-paper p-5"><p className="text-sm font-semibold">{t("Not generated")}</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("Personalized recommendations are not available yet. Explore activities and their requirements in the catalog.")}</p></div></CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600"/>{t("Recent learning")}</CardTitle></CardHeader><CardContent className="space-y-3">{history.filter(row => row.status === "completed").slice(0,3).map(row => <div key={row.record_id} className="rounded-xl border p-3"><p className="text-sm font-medium">{t(names.get(row.event_id))}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(row.date)}</p></div>)}<a href="#history" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-navy">{t("Full history")}<ArrowUpRight className="h-3 w-3"/></a></CardContent></Card>
    </aside></div>
    <section id="history">
    <Card><CardHeader><CardTitle>{t("Participation history ·")} {formatNumber(history.length)}</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th>{t("Date")}</th><th>{t("Activity")}</th><th>{t("Status")}</th><th>{t("Progress")}</th></tr></thead><tbody>{history.map(row => <tr key={row.record_id}><td className="whitespace-nowrap">{formatDate(row.date)}</td><td>{t(names.get(row.event_id))}</td><td>{t(row.status)}</td><td>{row.completion_pct}%</td></tr>)}</tbody></table>{!history.length && <p>{t("No participation records yet.")}</p>}</div></CardContent></Card>
    </section>
  </>;
}
