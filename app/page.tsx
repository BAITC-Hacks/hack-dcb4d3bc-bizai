import { LanguageSwitcher } from "@/components/shell/language-switcher";
import { getI18n } from "@/lib/i18n/server";
import { Compass, ArrowRight } from "lucide-react";
import { repository } from "@/lib/server/repository";
import { EntryCard } from "@/components/career/entry-card";
import { demoAuthEnabled } from "@/lib/server/identity";
export default async function Page() {
  const { t, formatDate } = await getI18n();
  const { data } = repository().read();
  return <div className="min-h-screen bg-[#f4f6f8]"><header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-7"><div className="flex items-center gap-3"><Compass className="h-6 w-6 text-brand-navy"/><span className="font-semibold tracking-tight">Career Quest <span className="ml-2 text-xs font-normal text-muted-foreground">by BizAI</span></span></div><LanguageSwitcher/></header><main className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-10 lg:min-h-[75vh] lg:grid-cols-[1fr_440px] lg:gap-20"><section><p className="eyebrow">{t("A clearer path to growth")}</p><h1 className="mt-5 max-w-lg text-4xl leading-[1.12] tracking-tight md:text-6xl">{t("Your next chapter.")}</h1><p className="mt-6 max-w-md text-base leading-7 text-muted-foreground">{t("Turn your goal into a plan, choose a useful next step, and keep evidence of your progress.")}</p><ol className="mt-10 max-w-md divide-y border-y">{["Choose your direction", "Build your development plan", "Learn and demonstrate progress"].map((label,index)=><li className="flex items-center gap-4 py-5" key={label}><span className="font-mono text-xs text-muted-foreground">0{index+1}</span><span className="flex-1 text-sm font-medium">{t(label)}</span><ArrowRight className="h-4 w-4 text-slate-400"/></li>)}</ol><p className="mt-6 text-xs text-muted-foreground">{t("Synthetic dataset ·")} {formatDate(data.meta.as_of_date)}</p></section><EntryCard demo={demoAuthEnabled()} employees={demoAuthEnabled() ? data.employees.map(e=>({id:e.employee_id,name:e.full_name})) : []}/></main></div>;
}
