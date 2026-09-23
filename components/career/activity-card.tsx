import { BookOpen, CalendarDays, CheckCircle2, Clock3, LockKeyhole, ShieldCheck, Sparkles, Users, Zap } from "lucide-react";
import type { Event } from "@/lib/career/types";

const conciseReason: Record<string, string> = {
  "Mandatory activity — excluded from voluntary recommendations": "Required activity · outside voluntary recommendations",
  "Outside current role/grade audience": "Outside your current role / grade",
  "Prerequisites not met": "Prerequisites not met",
  "Already completed": "Already completed",
  "Already in progress": "Already in progress",
  "No upcoming session": "No upcoming session",
};

export function ActivityCard({ event, reasons, skillNames, date }: {
  event: Event; reasons: string[]; skillNames: Map<string, string>; date: string;
}) {
  const eligible = reasons.length === 0;
  const StatusIcon = eligible ? CheckCircle2 : LockKeyhole;
  const Icon = event.mandatory ? ShieldCheck : event.type === "mentoring" ? Users : event.type === "workshop" ? Zap : BookOpen;
  const sessions = event.upcoming_sessions.filter(session => session >= date);
  const prerequisites = Object.entries(event.prerequisites);
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-brand-navy/15 bg-white p-1 shadow-card transition-shadow hover:shadow-elevated">
      <header className="relative rounded-t-xl border-b border-brand-navy/10 bg-gradient-to-br from-brand-paper to-brand-mist/60 px-4 pb-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-navy text-white"><Icon className="h-4 w-4" aria-hidden="true"/></span>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-navy">{event.mandatory ? "Mandatory" : event.type}</span>
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-brand-gold/30 bg-white px-2.5 py-1 text-xs font-bold tabular-nums text-brand-ink" title="Total duration">
            <Clock3 className="h-3 w-3 text-brand-gold-dark" aria-hidden="true"/>{event.duration_hours}<span className="font-normal text-muted-foreground">h</span>
          </span>
        </div>
        <h2 className="mt-3 text-base font-semibold leading-snug">{event.title}</h2>
        <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{event.format.replaceAll("_", " ")}</p>
      </header>

      <div className="flex flex-1 flex-col gap-3 px-4 py-3">
        <p className="text-xs leading-relaxed text-muted-foreground">{event.description}</p>
        <section aria-label="Skill gains" className="rounded-lg border border-brand-gold/20 bg-brand-gold/[0.04] px-3 py-2.5">
          <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-gold-dark"><Sparkles className="h-3 w-3" aria-hidden="true"/>Skill gains</h3>
          {event.develops_skills.length ? <ul className="space-y-1.5">{event.develops_skills.map(gain => <li key={gain.skill_id} className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-brand-ink">{skillNames.get(gain.skill_id)}</span>
            <span className="flex shrink-0 items-center gap-2"><span className="text-[10px] text-muted-foreground">cap {gain.max_level}</span><span className="min-w-8 rounded-md bg-brand-gold/15 px-1.5 py-0.5 text-center font-bold tabular-nums text-brand-gold-dark">+{gain.gain}</span></span>
          </li>)}</ul> : <p className="text-xs text-muted-foreground">No skill gains</p>}
        </section>
        <section aria-label="Prerequisites">
          <h3 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-navy"><LockKeyhole className="h-3 w-3" aria-hidden="true"/>Prerequisites</h3>
          {prerequisites.length ? <ul className="flex flex-wrap gap-1.5">{prerequisites.map(([id, level]) => <li key={id} className="rounded-md border border-brand-mist bg-brand-paper px-2 py-1 text-[11px] text-brand-ink">{skillNames.get(id)} <strong className="ml-1 text-brand-navy">≥ {level}</strong></li>)}</ul> : <p className="text-xs text-muted-foreground">None</p>}
        </section>
        <section aria-label="Sessions" className="mt-auto border-t border-dashed pt-2.5">
          <h3 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-navy"><CalendarDays className="h-3 w-3" aria-hidden="true"/>Sessions</h3>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{event.format === "self_paced" ? "Available anytime" : sessions.join(" · ") || "None scheduled"}</p>
        </section>
      </div>

      <footer className={`rounded-b-xl border-t px-4 py-3 ${eligible ? "border-emerald-100 bg-emerald-50/70" : "border-brand-mist bg-brand-paper"}`}>
        <div className="flex items-center justify-between gap-2"><p className={`flex items-center gap-1.5 text-xs font-semibold ${eligible ? "text-emerald-800" : "text-brand-ink"}`}><StatusIcon className="h-3.5 w-3.5" aria-hidden="true"/>{eligible ? "Eligible to explore" : "Eligibility"}</p><span className="font-mono text-[9px] tracking-wider text-muted-foreground">{event.event_id}</span></div>
        {!!reasons.length && <ul className="mt-1.5 space-y-1 text-[11px] leading-snug text-muted-foreground">{reasons.map(reason => <li key={reason}>{conciseReason[reason] ?? reason}</li>)}</ul>}
      </footer>
    </article>
  );
}
