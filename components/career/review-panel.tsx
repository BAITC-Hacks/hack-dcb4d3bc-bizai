"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/providers/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReviewCycle, ReviewItem } from "@/lib/career/reviews";
import { reviewText } from "@/lib/career/review-copy";

type Session = { reviews: ReviewCycle[]; datasetRevision: number; planRevision: number | null; defaultQuarter: string };
export function ReviewPanel({ employeeId, editable, skills }: { employeeId: string; editable: boolean; skills: { skill_id: string; name: string }[] }) {
  const { locale } = useI18n();
  const say = (key: Parameters<typeof reviewText>[1]) => reviewText(locale, key);
  const [session, setSession] = useState<Session | null>(null);
  const [quarter, setQuarter] = useState("");
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"error" | "stale" | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setSession(null); setError(null);
    fetch(`/api/reviews?employeeId=${encodeURIComponent(employeeId)}`, { signal: controller.signal, cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error();
      const value = await response.json() as Session;
      if (!controller.signal.aborted) { setSession(value); setQuarter(value.defaultQuarter); }
    }).catch(() => { if (!controller.signal.aborted) setError("error"); });
    return () => controller.abort();
  }, [employeeId, reload]);
  async function command(input: object) {
    if (!session || busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, datasetRevision: session.datasetRevision }) });
      if (!response.ok) { setError(response.status === 409 ? "stale" : "error"); return; }
      setReload(n => n + 1);
    } catch { setError("error"); }
    finally { setBusy(false); }
  }
  const latest = [...new Map((session?.reviews ?? []).slice().reverse().map(r => [r.id, r])).values()].sort((a, b) => b.quarter.localeCompare(a.quarter));
  return <section id="reviews"><Card><CardHeader><CardTitle>{say("title")}</CardTitle><p className="text-sm text-muted-foreground">{say(editable ? "description" : "readonly")}</p></CardHeader><CardContent className="space-y-5">
    {editable && session && <form onSubmit={e => { e.preventDefault(); void command({ action: "create", quarter, planRevision: session.planRevision }); }} className="flex flex-wrap items-end gap-3"><label className="text-xs">{say("quarter")}<input aria-label={say("quarter")} required pattern="20[0-9]{2}-Q[1-4]" value={quarter} onChange={e => setQuarter(e.target.value)} className="mt-1 block rounded-lg border p-2 text-sm"/></label><Button disabled={busy}>{say("create")}</Button></form>}
    {session && !latest.length && <p className="text-sm">{say("none")}</p>}
    {latest.map(review => <ReviewEditor key={`${review.id}-${review.revision}`} review={review} editable={editable} busy={busy} skills={skills} command={command}/>)}
    {error && <p role="alert" className="text-sm text-amber-800">{say(error)}</p>}
    <Button variant="outline" disabled={busy} onClick={() => setReload(n => n + 1)}>{say("reload")}</Button>
    {!!session?.reviews.length && <details><summary className="cursor-pointer text-sm">{say("history")}</summary><p className="my-2 text-xs">{say("evidence")}</p><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-brand-paper p-3 text-xs">{JSON.stringify(session.reviews, null, 2)}</pre></details>}
  </CardContent></Card></section>;
}
function ReviewEditor({ review, editable, busy, skills, command }: { review: ReviewCycle; editable: boolean; busy: boolean; skills: { skill_id: string; name: string }[]; command: (input: object) => Promise<void> }) {
  const { locale, t } = useI18n();
  const say = (key: Parameters<typeof reviewText>[1]) => reviewText(locale, key);
  const [items, setItems] = useState<ReviewItem[]>(review.items);
  const canEdit = editable && review.status === "draft";
  const complete = items.every(item => item.selfRating !== null && item.justification.trim());
  function update(index: number, patch: Partial<ReviewItem>) { setItems(current => current.map((item, i) => i === index ? { ...item, ...patch } : item)); }
  return <div className="space-y-3 rounded-xl border p-4"><h3 className="font-semibold">{review.quarter} · {t(review.target.role)} · {t(review.target.grade)}</h3><p className="text-sm">{say(review.status)} · #{review.revision}</p><p className="text-xs text-muted-foreground">{review.reviewerId ? `${say("manager")}: ${review.reviewerId}` : say("noManager")}</p>
    <details><summary className="cursor-pointer text-sm">{say("scale")}</summary>{review.target.proficiencyScale ? Object.entries(review.target.proficiencyScale).map(([level, text]) => <p key={level} className="text-xs">{level}: {t(text)}</p>) : <p className="text-xs">{say("noScale")}</p>}</details>
    {items.map((item, index) => <fieldset disabled={!canEdit || busy} key={item.skillId} className="space-y-2 rounded-lg bg-brand-paper p-3"><legend className="text-sm font-medium">{t(skills.find(s => s.skill_id === item.skillId)?.name ?? item.skillId)} · {t("Required")} {review.target.requiredSkills[item.skillId]}{review.target.criticalSkills.includes(item.skillId) ? ` · ${t("Critical")}` : ""}</legend><label className="block text-xs">{say("rating")}<select value={item.selfRating ?? ""} onChange={e => update(index, { selfRating: e.target.value === "" ? null : Number(e.target.value) })} className="ml-2 rounded border bg-white p-2"><option value="">—</option>{[0, 1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</select></label><label className="block text-xs">{say("justification")}<textarea maxLength={4000} rows={3} value={item.justification} onChange={e => update(index, { justification: e.target.value })} className="mt-1 w-full rounded border bg-white p-2 text-sm"/></label></fieldset>)}
    {canEdit && <><p className="text-xs text-muted-foreground">{say("missing")}</p><div className="flex flex-wrap gap-2"><Button disabled={busy} variant="outline" onClick={() => command({ action: "save", id: review.id, revision: review.revision, items })}>{say("save")}</Button><Button disabled={busy || !complete} onClick={() => command({ action: "submit", id: review.id, revision: review.revision, items })}>{say("submit")}</Button></div></>}
    {editable && review.status === "submitted" && <Button disabled={busy} variant="outline" onClick={() => command({ action: "reopen", id: review.id, revision: review.revision, items: [] })}>{say("reopen")}</Button>}
  </div>;
}
