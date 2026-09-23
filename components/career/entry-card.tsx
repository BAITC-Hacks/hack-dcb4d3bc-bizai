"use client";
import { useI18n } from "@/components/providers/locale";
import { useState } from "react";
import { ArrowRight, Building2, GraduationCap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EntryCard({ employees, demo = false }: { employees: { id: string; name: string }[]; demo?: boolean }) {
  const { t } = useI18n();
  const [role, setRole] = useState<"employee" | "hr">("employee");
  if (!demo) return <div className="rounded-xl border bg-white p-6 shadow-sm"><h2 className="text-2xl">{t("Enter the portal")}</h2><form action="/api/session" method="post" className="mt-5 space-y-5"><label className="block text-sm">{t("Access token")}<input className="mt-2 w-full rounded-lg border p-3" type="password" name="accessToken" required autoComplete="current-password" maxLength={64}/></label><p className="text-xs text-muted-foreground">{t("Use the access token issued by your administrator. Your account and permissions are assigned automatically.")}</p><Button className="w-full">{t("Sign in")}<ArrowRight className="h-4 w-4"/></Button></form></div>;
  return <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
    <div className="bg-[#152638] p-6 text-white"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-widest text-white/60">{t("Enter the portal")}</p><h2 className="mt-1 text-2xl text-white">{t("Choose your workspace")}</h2></div><Building2 className="h-8 w-8 text-brand-gold-light"/></div>
      <div className="mt-5 grid grid-cols-2 gap-3">{(["employee", "hr"] as const).map(value => { const Icon = value === "hr" ? Users : GraduationCap; return <button key={value} onClick={() => setRole(value)} aria-pressed={role === value} className={cn("rounded-xl border p-4 text-left transition", role === value ? "border-brand-gold bg-white/15" : "border-white/15 hover:bg-white/10")}><Icon className="mb-3 h-5 w-5 text-brand-gold-light"/><span className="block font-semibold">{value === "hr" ? t("HR") : t("Employee")}</span><span className="mt-1 block text-xs text-white/70">{value === "hr" ? t("Support your people") : t("Shape your growth")}</span></button>; })}</div>
    </div>
    <form action="/api/session" method="post" className="space-y-5 p-6"><input type="hidden" name="accessRole" value={role}/>{role === "employee" ? <><label htmlFor="employee" className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("Choose a synthetic demo profile")}</label><select id="employee" name="employeeId">{employees.map(e => <option key={e.id} value={e.id}>{e.name} · {e.id}</option>)}</select></> : <div className="rounded-xl border bg-brand-paper p-4"><p className="font-semibold">{t("People & development")}</p><p className="mt-1 text-sm text-muted-foreground">{t("Inspect skill gaps, explore employee trajectories, and manage jury data.")}</p></div>}<Button variant="default" className="w-full">{role === "hr" ? t("Open HR overview") : t("Open my development")}<ArrowRight className="h-4 w-4"/></Button><p className="text-xs leading-relaxed text-muted-foreground">{t("Demo authentication: anyone can select an account, including HR. Only synthetic data is supported.")}</p></form>
  </div>;
}
