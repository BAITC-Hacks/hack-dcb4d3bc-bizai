"use client";

import { CheckCircle2, Flag, GitBranch, ShieldAlert, Target, TrendingUp } from "lucide-react";
import { useI18n } from "@/components/providers/locale";

type Requirement = { id: string; name: string; level: number; required: number; gap: number; critical: boolean; assessed: number; closed: boolean };

export function DevelopmentFlow({ current, target, gaps, goalUnset }: { current: { role: string; grade: string }; target: { role: string; grade: string }; gaps: Requirement[]; goalUnset: boolean }) {
  const { t, formatNumber } = useI18n();
  const met = gaps.filter(gap => gap.closed);
  const groups = [
    { title: "Critical gaps", description: "Essential requirements to develop", icon: ShieldAlert, skills: gaps.filter(gap => gap.critical && !gap.closed), color: "text-amber-800", background: "bg-amber-50", border: "border-amber-200", bar: "bg-amber-500" },
    { title: "Skills to develop", description: "Other requirements to develop", icon: TrendingUp, skills: gaps.filter(gap => !gap.critical && !gap.closed), color: "text-brand-navy", background: "bg-blue-50", border: "border-blue-200", bar: "bg-brand-navy" },
    { title: "Closed modules", description: "Strengths already at target", icon: CheckCircle2, skills: met, color: "text-emerald-800", background: "bg-emerald-50", border: "border-emerald-200", bar: "bg-emerald-600" },
  ];

  return <section id="trajectory" className="overflow-hidden rounded-2xl border bg-white shadow-card">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><h2 className="flex items-center gap-2 text-lg font-semibold"><GitBranch aria-hidden="true" className="h-5 w-5 text-brand-gold" />{t("Development map")}</h2><p className="mt-1 text-xs text-muted-foreground">{t("Branches show target requirements, not a sequence of tasks.")}</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">{t("Closed modules")}: {formatNumber(met.length)} / {formatNumber(gaps.length)}</span></div>
    <div className="bg-brand-paper/50 p-4 sm:p-6">
      <div className="relative mx-auto flex max-w-lg items-center gap-3 rounded-xl border border-brand-navy/20 bg-white p-4 shadow-sm">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-navy text-white"><Flag aria-hidden="true" className="h-5 w-5" /></span>
        <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{t("Current profile")}</p><p className="mt-1 text-sm font-semibold text-brand-navy">{t(current.grade)} · {t(current.role)}</p><p className="mt-1 text-xs text-muted-foreground">{t("Effective skills after completed learning")}</p></div>
      </div>
      <div aria-hidden="true" className="mx-auto h-6 w-px bg-brand-navy/20" />
      <div aria-hidden="true" className="mx-auto hidden h-5 w-[66.666%] rounded-t-xl border-x border-t border-brand-navy/20 md:block"><div className="mx-auto h-full w-px bg-brand-navy/20" /></div>
      <div className="grid items-start gap-4 md:grid-cols-[1fr_2fr_1fr]">
        {groups.map(group => <section key={group.title} className={`min-w-0 overflow-hidden rounded-xl border bg-white ${group.border}`}>
          <div className={`border-b p-4 ${group.background} ${group.border}`}><div className={`flex items-center gap-2 ${group.color}`}><group.icon aria-hidden="true" className="h-4 w-4 shrink-0" /><h3 className="flex-1 text-sm font-semibold">{t(group.title)}</h3><span className="rounded-md bg-white/80 px-2 py-0.5 text-xs font-bold">{formatNumber(group.skills.length)}</span></div><p className="mt-1.5 text-xs text-muted-foreground">{t(group.description)}</p></div>
          <ul className={`px-4 ${group.title === "Skills to develop" ? "grid gap-x-4 sm:grid-cols-2" : ""}`}>{group.skills.map(skill => <li key={skill.id} className="border-b border-slate-100 py-3 last:border-b-0">
            <div className="flex items-start justify-between gap-2"><span className="text-xs font-medium leading-5 text-brand-navy">{t(skill.name)}</span><span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground" aria-label={`${t("Effective level")}: ${formatNumber(skill.level, 0)}; ${t("Required")}: ${formatNumber(skill.required)}`}>{formatNumber(skill.level, 0)}<span className="px-1 text-slate-300">/</span>{formatNumber(skill.required)}</span></div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className={`h-full rounded-full ${group.bar}`} style={{ width: `${skill.required ? Math.min(100, skill.level / skill.required * 100) : 100}%` }} /></div>
            <div className="mt-1.5 flex justify-between gap-2 text-[10px]"><span className={group.color}>{skill.closed ? t("Closed") : skill.gap ? `${t("Gap")}: ${formatNumber(skill.gap, 0)}` : t("Reassessment needed")}</span>{skill.critical && <span className="font-semibold text-amber-800">{t("Critical")}</span>}</div>
          </li>)}</ul>
          {!group.skills.length && <p className="p-4 text-xs text-muted-foreground">{t("No skills in this group.")}</p>}
        </section>)}
      </div>
      <div aria-hidden="true" className="mx-auto h-6 w-px bg-brand-navy/20" />
      <div className="mx-auto flex max-w-lg items-center gap-3 rounded-xl border border-indigo-200 bg-white p-4 shadow-sm"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Target aria-hidden="true" className="h-5 w-5" /></span><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-600">{t(goalUnset ? "Current role requirements" : "Career goal")}</p><p className="mt-1 text-sm font-semibold text-brand-navy">{t(target.grade)} · {t(target.role)}</p><p className="mt-1 text-xs text-muted-foreground">{t("Skill coverage does not guarantee promotion.")}</p></div></div>
    </div>
    <div className="flex flex-wrap justify-between gap-2 border-t px-5 py-3 text-xs text-muted-foreground"><span>{t("All target skills, grouped by assessment status. Levels show effective / required.")}</span><a href="#skills" className="font-semibold text-brand-navy underline underline-offset-4">{t("Skills against target")}</a></div>
  </section>;
}
