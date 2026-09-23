"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/locale";
import type { PlanningState } from "@/lib/career/planning";
export function AdoptActivity({ eventId, planning, datasetRevision }: { eventId: string; planning: PlanningState; datasetRevision: number }) {
  const { t } = useI18n(); const router = useRouter();
  const steps = planning.plan.milestones.filter(m => m.goalId === planning.plan.focusId);
  const [selected, setSelected] = useState(steps[0]?.id ?? "new");
  const [outcome, setOutcome] = useState(""); const [criterion, setCriterion] = useState("");
  const [busy,setBusy] = useState(false); const [error,setError] = useState("");
  const adopted = steps.some(m => m.activityIds?.includes(eventId));
  if (!planning.plan.focusId) return <Link href="/employee/dashboard?view=plan">{t("Create a goal")} →</Link>;
  if (adopted) return <div className="mt-5"><strong className="text-sm">{t("Added to your plan")}</strong><Link href="/employee/dashboard">{t("Return to my development")} →</Link></div>;
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const plan = structuredClone(planning.plan);
    if (selected === "new") plan.milestones.push({ id: crypto.randomUUID(), goalId: plan.focusId!, outcome:outcome.trim(), criterion:criterion.trim(), state:"planned", evidence:"", actions:"", origin:"employee", activityIds:[eventId] });
    else plan.milestones = plan.milestones.map(m => m.id === selected ? {...m, activityIds:[...new Set([...(m.activityIds ?? []),eventId])]} : m);
    try { const response = await fetch("/api/planning", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({datasetRevision,revision:planning.revision,plan})}); if(!response.ok) {setError(response.status === 409 ? t("Your plan changed. Reload before saving.") : t("Could not save plan"));return;} router.refresh(); } catch {setError(t("Could not save plan"));} finally {setBusy(false);}
  }
  return <form onSubmit={save} className="mt-5 space-y-3"><label className="block text-xs font-medium">{t("Milestone")}<select value={selected} onChange={e=>setSelected(e.target.value)} className="mt-2">{steps.map(m=><option key={m.id} value={m.id}>{m.outcome}</option>)}<option value="new">{t("Create a milestone")}</option></select></label>{selected === "new" && <><label className="block text-xs font-medium">{t("What will you achieve?")}<input required maxLength={2000} value={outcome} onChange={e=>setOutcome(e.target.value)} className="mt-2 w-full rounded-lg border bg-white p-3"/></label><label className="block text-xs font-medium">{t("What will success look like?")}<textarea required maxLength={2000} value={criterion} onChange={e=>setCriterion(e.target.value)} className="mt-2 w-full rounded-lg border bg-white p-3"/></label></>}<button disabled={busy || selected === "new" && (!outcome.trim() || !criterion.trim())} className="journey-button !mt-3 disabled:opacity-50">{t(busy ? "Saving…" : "Add to my plan")}</button><p className="!text-xs">{t("Planning an activity does not enroll you or mark it complete.")}</p>{error && <p role="alert">{error}</p>}</form>;
}
