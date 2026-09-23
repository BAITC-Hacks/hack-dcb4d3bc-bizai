import { LanguageSwitcher } from "@/components/shell/language-switcher";
import { getI18n } from "@/lib/i18n/server";
import { Compass, GraduationCap, Target, Users, BarChart3 } from "lucide-react";
import { repository } from "@/lib/server/repository";
import { EntryCard } from "@/components/career/entry-card";

export default async function Page() {
  const { t, formatDate, formatNumber } = await getI18n();
  const { data } = repository().read();
  const features = [
    { icon: Target, title: t("Your career trajectory"), text: t("A clear view of your target and the skills that matter.") },
    { icon: GraduationCap, title: t("Learning that fits"), text: t("Explore activities, prerequisites, and upcoming sessions.") },
    { icon: BarChart3, title: t("Visible progress"), text: t("Assessed skills and completed learning in one place.") },
    { icon: Users, title: t("A shared view for HR"), text: t("Understand development needs and participation.") },
  ];
  return <div className="relative min-h-screen overflow-hidden gradient-paper"><div className="pointer-events-none absolute inset-0 hero-grid opacity-60"/><div className="relative mx-auto max-w-7xl px-6 md:px-10">
    <header className="flex flex-wrap items-center justify-between gap-4 py-7"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-navy text-white"><Compass className="h-6 w-6"/></span><span className="text-xl font-bold text-brand-ink">{t("Career Quest")} <span className="block text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">{t("by BizAI")}</span></span></div><div className="flex items-center gap-3"><LanguageSwitcher/><span className="hidden rounded-full border bg-white/70 md:inline-block px-3 py-1 text-xs text-brand-navy">{t("Hackathon edition")}</span></div></header>
    <main className="grid items-center gap-12 py-10 lg:grid-cols-[1.1fr_0.9fr]"><div><span className="inline-flex items-center gap-2 rounded-full bg-brand-gold/10 px-3 py-1 text-xs font-semibold text-brand-gold-dark"><Compass className="h-4 w-4"/>{t("A clearer path to growth")}</span><h1 className="mt-5 text-4xl leading-tight md:text-5xl">{t("Your next chapter.")}<br/><span className="bg-gradient-to-r from-brand-navy to-brand-gold bg-clip-text text-transparent">{t("Built on your strengths.")}</span></h1><p className="mt-5 max-w-xl leading-relaxed text-muted-foreground">{t("One workspace for employees and HR. Understand your skills, explore development opportunities, and see the path toward your career goal.")}</p>
      <div className="mt-7 grid grid-cols-3 gap-3">{[[data.employees.length, t("Profiles")], [data.events.length, t("Activities")], [data.skills.length, t("Skills")]].map(([value, label]) => <div key={label} className="rounded-xl border border-brand-mist bg-white/80 p-4 shadow-card"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-semibold text-brand-ink">{typeof value === "number" ? formatNumber(value) : value}</p></div>)}</div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">{features.map(({ icon: Icon, title, text }) => <div key={title} className="flex gap-3 rounded-2xl border border-brand-mist bg-white p-4 shadow-card"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-navy text-white"><Icon className="h-5 w-5"/></span><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p></div></div>)}</div>
    </div><EntryCard employees={data.employees.map(e => ({ id: e.employee_id, name: e.full_name }))}/></main><footer className="flex flex-col justify-between gap-2 border-t py-6 text-xs text-muted-foreground sm:flex-row">{t("Career Quest · BizAI")} <span className="text-xs">{t("Synthetic dataset ·")} {formatDate(data.meta.as_of_date)}</span></footer>
  </div></div>;
}
