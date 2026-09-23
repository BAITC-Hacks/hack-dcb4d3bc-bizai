"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/locale";
import { draftSchema, type PlanningState, type Plan } from "@/lib/career/planning";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PlanningEditor({ initial, datasetRevision, profiles, editable, employeeId, suggestedTarget }: { employeeId: string; initial: PlanningState; datasetRevision: number; profiles: { role: string; grade: string }[]; editable: boolean; suggestedTarget?: Plan["goals"][number]["target"] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [plan, setPlan] = useState(initial.plan);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const draftKey = `career-draft:${employeeId}:${datasetRevision}:${initial.revision}`;
  const hydrated = useRef(false);
  useEffect(() => {
    if (!editable) return;
    try {
      const stored = sessionStorage.getItem(draftKey);
      if (stored) { const draft = draftSchema.safeParse(JSON.parse(stored)); if (draft.success) { setPlan(draft.data); setMessage("Draft restored in this tab. Review before saving."); } }
    } catch { /* Storage can be disabled; leave warnings remain available. */ }
    hydrated.current = true;
  }, [draftKey, editable]);
  useEffect(() => {
    if (!editable || !hydrated.current) return;
    try { if (JSON.stringify(plan) === JSON.stringify(initial.plan)) sessionStorage.removeItem(draftKey); else sessionStorage.setItem(draftKey, JSON.stringify(plan)); } catch { /* No persistence claim if browser storage is unavailable. */ }
  }, [plan, initial.plan, draftKey, editable]);
  const dirty = editable && JSON.stringify(plan) !== JSON.stringify(initial.plan);
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const navigate = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.origin === location.origin && link.pathname === location.pathname && link.search === location.search) return;
      if (!window.confirm(t("Discard unsaved plan changes?"))) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", navigate, true); };
  }, [dirty, t]);
  const focus = plan.goals.find(g => g.id === plan.focusId);
  const patchGoal = (patch: Partial<Plan["goals"][number]>) => setPlan({ ...plan, goals: plan.goals.map(g => g.id === plan.focusId ? { ...g, ...patch, origin: "employee" } : g) });
  const patchMilestone = (id: string, patch: Partial<Plan["milestones"][number]>) => setPlan({ ...plan, milestones: plan.milestones.map(m => m.id === id ? { ...m, ...patch } : m) });
  async function save() {
    setSubmitted(true);
    if (plan.goals.some(g => !g.wording.trim()) || plan.milestones.some(m => !m.outcome.trim() || !m.criterion.trim())) {
      setMessage("Add a goal, outcome and success criterion before saving."); return;
    }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/planning", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ datasetRevision, revision: initial.revision, plan }) });
      if (!response.ok) { setMessage(response.status === 409 ? "Plan or dataset changed. Reload before saving." : response.status === 400 ? "Add a goal, outcome and success criterion before saving." : "Could not save. Your edits are still here; try again."); return; }
      try { sessionStorage.removeItem(draftKey); } catch {}
      router.refresh(); setMessage("Saved");
    } catch { setMessage("Could not save. Your edits are still here; try again."); }
    finally { setBusy(false); }
  }
  return <section id="personal-plan" className="rounded-xl border bg-white p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{t("My goals and milestones")}</h2>{editable && <Button type="button" disabled={busy} onClick={() => { const id = crypto.randomUUID(); setPlan({ ...plan, focusId: id, goals: [...plan.goals, { id, wording: "", origin: "employee", target: null }] }); }}>{t("Add goal")}</Button>}</div>
    {dirty && <div role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{t("Unsaved changes. Focus and target updates apply after saving.")}<Button type="button" className="ml-2" variant="outline" disabled={busy} onClick={() => { setPlan(initial.plan); setSubmitted(false); setMessage(""); }}>{t("Cancel changes")}</Button></div>}
    <p className="mt-2 text-sm text-muted-foreground">{t("Your plan is editable. Milestones are self-reports and do not grant assessed skills.")}</p>
    {!focus && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{t("What would you like to achieve or change?")}</p>}
    {!focus && editable && suggestedTarget && <div className="mt-4 rounded-xl border p-4"><p className="text-sm">{t("Optional next-grade goal")}: {t(suggestedTarget.target_role)} · {t(suggestedTarget.target_grade)}</p><p className="mt-2 text-xs text-muted-foreground">{t("Review and save this goal only if it matches your direction.")}</p><Button className="mt-3" type="button" variant="outline" disabled={busy} onClick={() => { const id = crypto.randomUUID(); setPlan({ ...plan, focusId: id, goals: [...plan.goals, { id, wording: `${t(suggestedTarget.target_grade)} ${t(suggestedTarget.target_role)}`, target: suggestedTarget, origin: "employee" }] }); }}>{t("Draft next-grade goal")}</Button></div>}
    <div className="mt-4 space-y-4">
      {plan.goals.length > 0 && <label className="block text-sm">{t("Focus goal")}<select className="mt-1 w-full rounded-lg border bg-white p-2" value={plan.focusId ?? ""} onChange={e => setPlan({ ...plan, focusId: e.target.value })}>{plan.goals.map(g => <option key={g.id} value={g.id}>{g.wording || t("New goal")}</option>)}</select></label>}
    <fieldset disabled={!editable || busy} className="space-y-4 disabled:opacity-80">
      {focus && <><label className="block text-sm">{t("Goal in your own words")}<Input className="mt-1" aria-invalid={submitted && !focus.wording.trim()} value={focus.wording} maxLength={2000} onChange={e => patchGoal({ wording: e.target.value })} /></label>
      {submitted && !focus.wording.trim() && <p className="text-xs text-red-700">{t("Goal wording is required.")}</p>}
      <p className="text-xs text-muted-foreground">{t(focus.origin === "imported" ? "Imported aspiration" : "Employee-defined goal")}</p>
      <label className="block text-sm">{t("Optional role target")}<select className="mt-1 w-full rounded-lg border bg-white p-2" value={focus.target ? JSON.stringify(focus.target) : ""} onChange={e => patchGoal({ target: e.target.value ? JSON.parse(e.target.value) : null })}><option value="">{t("Free-form goal · no role mapping")}</option>{profiles.map(p => <option key={`${p.role}-${p.grade}`} value={JSON.stringify({ target_role: p.role, target_grade: p.grade })}>{t(p.role)} · {t(p.grade)}</option>)}</select></label>
      {!focus.target && <p className="rounded-lg bg-brand-paper p-3 text-xs">{t("This goal has no catalog role mapping. Keep planning; no formal requirements or activity advice are inferred.")}</p>}
      {editable && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">{t("Goal options")}</summary><Button type="button" className="mt-3" variant="outline" onClick={() => { const goals = plan.goals.filter(g => g.id !== focus.id); setPlan({ goals, focusId: goals[0]?.id ?? null, milestones: plan.milestones.filter(m => m.goalId !== focus.id) }); }}>{t("Remove goal and its milestones")}</Button></details>}
      {editable && <Button type="button" variant="outline" onClick={() => setPlan({ ...plan, milestones: [...plan.milestones, { id: crypto.randomUUID(), goalId: focus.id, outcome: "", criterion: "", state: "planned", evidence: "", actions: "", origin: "employee" }] })}>{t("Add milestone")}</Button>}
      <div className="space-y-3">{plan.milestones.filter(m => m.goalId === focus.id).map(m => <div key={m.id} className="rounded-xl border bg-brand-paper/50 p-4">
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs">{t("Outcome")}<Input className="mt-1" aria-invalid={submitted && !m.outcome.trim()} value={m.outcome} onChange={e => patchMilestone(m.id, { outcome: e.target.value })} /></label><label className="text-xs">{t("Success criterion")}<Input className="mt-1" aria-invalid={submitted && !m.criterion.trim()} value={m.criterion} onChange={e => patchMilestone(m.id, { criterion: e.target.value })} /></label><label className="text-xs">{t("Actions")}<textarea className="mt-1 w-full rounded-lg border p-2" value={m.actions} onChange={e => patchMilestone(m.id, { actions: e.target.value })} /></label><label className="text-xs">{t("Evidence / reflection")}<textarea className="mt-1 w-full rounded-lg border p-2" value={m.evidence} onChange={e => patchMilestone(m.id, { evidence: e.target.value })} /></label></div>
        {submitted && (!m.outcome.trim() || !m.criterion.trim()) && <p className="mt-2 text-xs text-red-700">{t("Outcome and success criterion are required.")}</p>}
        <div className="mt-3 flex flex-wrap gap-2"><label className="text-xs">{t("Status")}<select className="ml-2 rounded-lg border bg-white p-2" value={m.state} onChange={e => patchMilestone(m.id, { state: e.target.value as typeof m.state })}>{["planned", "in_progress", "evidence_needed", "reached", "blocked", "paused"].map(state => <option key={state} value={state}>{t(state)}</option>)}</select></label>{editable && <><Button type="button" variant="outline" disabled={plan.milestones.filter(item => item.goalId === focus.id)[0]?.id === m.id} onClick={() => { const items = [...plan.milestones]; const index = items.findIndex(item => item.id === m.id); let previous = index - 1; while (previous >= 0 && items[previous].goalId !== focus.id) previous--; if (previous >= 0) [items[index], items[previous]] = [items[previous], items[index]]; setPlan({ ...plan, milestones: items }); }}>{t("Move up")}</Button><Button type="button" variant="outline" onClick={() => setPlan({ ...plan, milestones: plan.milestones.filter(item => item.id !== m.id) })}>{t("Remove milestone")}</Button></>}</div>
      </div>)}</div></>}
      {editable && <Button type="button" disabled={busy || !dirty} onClick={save}>{t(busy ? "Saving…" : "Save plan")}</Button>}
    </fieldset></div><p role="status" className="mt-3 text-sm">{t(message)}</p>
  </section>;
}
