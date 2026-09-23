"use client";

import { useState } from "react";
import { Target, CheckCircle2, Clock3 } from "lucide-react";
import { useI18n } from "@/components/providers/locale";

export type SkillCard = { approvedAt?: string; reviewId?: string; id: string; name: string; level: number; assessed: number; assessmentRecorded: boolean; required: number | null; critical: boolean; closed: boolean; inProgress: boolean };
export function SkillCards({ skills, goal, assessmentDate }: { skills: SkillCard[]; goal: string | null; assessmentDate: string }) {
  const { t, formatNumber, formatDate } = useI18n();
  const [filter, setFilter] = useState(goal ? "required" : "known");
  const [hideClosed, setHideClosed] = useState(false);
  const filters = [
    { id: "known", label: "Known skills", matches: (s: SkillCard) => s.level > 0 || s.assessed > 0 },
    { id: "required", label: "Required", matches: (s: SkillCard) => s.required !== null },
    { id: "progress", label: "In progress", matches: (s: SkillCard) => s.inProgress },
    { id: "reassessment", label: "Reassessment needed", matches: (s: SkillCard) => s.required !== null && !s.closed && s.level >= s.required },
    { id: "all", label: "All skills", matches: () => true },
  ];
  const visible = skills.filter(s => filters.find(f => f.id === filter)!.matches(s) && (!hideClosed || !s.closed));
  return <section id="skills" className="overflow-hidden rounded-2xl border bg-white shadow-card">
    <div className="border-b p-5"><h2 className="text-lg font-semibold">{t("Skills against target")}</h2><p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><Target aria-hidden="true" className="h-4 w-4 shrink-0"/>{goal ?? t("No role-linked focus goal")}</p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={t("Filter skills")}>{filters.filter(f => (f.id !== "required" || !!goal) && (!["progress", "reassessment"].includes(f.id) || skills.some(f.matches))).map(f => <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${filter === f.id ? "border-brand-navy bg-brand-navy text-white" : "bg-white text-muted-foreground hover:bg-brand-paper"}`}>{t(f.label)} <span className="ml-1 opacity-70">{formatNumber(skills.filter(f.matches).length)}</span></button>)}</div>
      <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={hideClosed} onChange={e => setHideClosed(e.target.checked)} className="accent-brand-navy"/>{t("Hide closed modules")}</label>
    </div>
    <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {visible.map(skill => <article key={skill.id} className={`min-w-0 rounded-xl border p-4 ${skill.closed ? "border-emerald-200 bg-emerald-50/30" : "border-brand-mist bg-brand-paper/40"}`}>
        <div className="flex items-start justify-between gap-2"><h3 className="text-sm font-semibold leading-5 text-brand-navy">{t(skill.name)}</h3>{skill.critical && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">{t("Critical")}</span>}</div>
        <div className="mt-4 flex items-end justify-between gap-3"><div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("Effective level")}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-brand-navy">{formatNumber(skill.level, 0)}<span className="ml-1 text-xs font-normal text-muted-foreground">/ 5</span></p></div><div className="text-right"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("Target")}</p><p className="mt-1 text-lg font-semibold tabular-nums">{skill.required === null ? "—" : formatNumber(skill.required, 0)}</p></div></div>
        <div className="mt-3 flex gap-1" aria-hidden="true">{[1,2,3,4,5].map(level => <span key={level} className={`h-2 flex-1 rounded-sm ${level <= skill.level ? skill.closed ? "bg-emerald-600" : "bg-brand-navy" : "bg-slate-200"} ${level === skill.required ? "ring-2 ring-brand-gold ring-offset-2" : ""}`}/>)}</div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]"><span className="text-muted-foreground">{skill.assessmentRecorded ? `${t("Assessment baseline")}: ${formatNumber(skill.assessed, 0)}` : t("No assessment recorded; calculations use zero")}</span><span className={skill.closed ? "text-emerald-700" : "text-amber-800"}>{t(skill.required === null ? "Outside current target" : skill.closed ? "Closed" : skill.level >= skill.required ? "Reassessment needed" : "Open")}</span></div>
        {skill.approvedAt && <p className="mt-2 text-[11px] text-emerald-800">{t("Human-approved assessment")} · {formatDate(skill.approvedAt.slice(0, 10))}</p>}
        {skill.inProgress && <p className="mt-3 flex items-center gap-1.5 border-t pt-2 text-[11px] text-brand-navy"><Clock3 aria-hidden="true" className="h-3 w-3"/>{t("Learning in progress")}</p>}
        {skill.closed && <p className="mt-2 flex items-center gap-1 text-[10px] text-emerald-700"><CheckCircle2 aria-hidden="true" className="h-3 w-3"/>{t("Supported by assessment baseline")}</p>}
      </article>)}
      {!visible.length && <p className="col-span-full rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{t(!goal && filter === "required" ? "Choose a role-linked goal to see required skills, or open All skills." : "No skills match these filters.")}</p>}
    </div><p className="border-t px-5 py-3 text-xs leading-relaxed text-muted-foreground">{t("Imported assessment:")} {formatDate(assessmentDate)} · {t("Gold outline marks the target level. In progress means a recorded active learning activity; it does not grant skill gains.")}</p>
  </section>;
}
