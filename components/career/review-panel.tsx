"use client";
import { createClientId } from "@/lib/client-id";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReviewCycle, ReviewItem } from "@/lib/career/reviews";
import { reviewText } from "@/lib/career/review-copy";

type Session = { canDecide: boolean; reviews: ReviewCycle[]; datasetRevision: number; planRevision: number | null; defaultQuarter: string };
export function ReviewPanel({ employeeId, editable, skills }: { employeeId: string; editable: boolean; skills: { skill_id: string; name: string }[] }) {
  const { locale } = useI18n();
  const router = useRouter();
  const say = (key: Parameters<typeof reviewText>[1]) => reviewText(locale, key);
  const [session, setSession] = useState<Session | null>(null);
  const [quarter, setQuarter] = useState("");
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"error" | "stale" | "assessmentChanged" | null>(null);
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
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        setError(failure.error === "Assessment changed" ? "assessmentChanged" : response.status === 409 ? "stale" : "error"); return;
      }
      setReload(n => n + 1); router.refresh();
      window.dispatchEvent(new CustomEvent("career-chat-updated", { detail: "review-decision" }));
    } catch { setError("error"); }
    finally { setBusy(false); }
  }
  const latest = [...new Map((session?.reviews ?? []).slice().reverse().map(r => [r.id, r])).values()].sort((a, b) => b.quarter.localeCompare(a.quarter));
  return <section id="reviews"><Card><CardHeader><CardTitle>{say("title")}</CardTitle><p className="text-sm text-muted-foreground">{say(editable ? "description" : "readonly")}</p></CardHeader><CardContent className="space-y-5">
    {editable && session && <form onSubmit={e => { e.preventDefault(); void command({ action: "create", quarter, planRevision: session.planRevision }); }} className="flex flex-wrap items-end gap-3"><label className="text-xs">{say("quarter")}<input aria-label={say("quarter")} required pattern="20[0-9]{2}-Q[1-4]" value={quarter} onChange={e => setQuarter(e.target.value)} className="mt-1 block rounded-lg border p-2 text-sm"/></label><Button disabled={busy}>{say("create")}</Button></form>}
    {session && !latest.length && <p className="text-sm">{say("none")}</p>}
    {latest.map(review => <ReviewEditor key={`${review.id}-${review.revision}`} review={review} canDecide={session?.canDecide ?? false} editable={editable} busy={busy} skills={skills} command={command}/>)}
    {error && <p role="alert" className="text-sm text-amber-800">{say(error)}</p>}
    <Button variant="outline" disabled={busy} onClick={() => setReload(n => n + 1)}>{say("reload")}</Button>
    {!!session?.reviews.length && <details><summary className="cursor-pointer text-sm">{say("history")}</summary><p className="my-2 text-xs">{say("evidence")}</p><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-brand-paper p-3 text-xs">{JSON.stringify(session.reviews, null, 2)}</pre></details>}
  </CardContent></Card></section>;
}
function ReviewEditor({ review, canDecide, editable, busy, skills, command }: { review: ReviewCycle; canDecide: boolean; editable: boolean; busy: boolean; skills: { skill_id: string; name: string }[]; command: (input: object) => Promise<void> }) {
  const { locale, t } = useI18n();
  const say = (key: Parameters<typeof reviewText>[1]) => reviewText(locale, key);
  const [items, setItems] = useState<ReviewItem[]>(review.items);
  const canEdit = editable && review.status === "draft";
  const complete = items.every(item => item.selfRating !== null && item.justification.trim());
  function update(index: number, patch: Partial<ReviewItem>) { setItems(current => current.map((item, i) => i === index ? { ...item, ...patch } : item)); }
  return <div className="space-y-3 rounded-xl border p-4"><h3 className="font-semibold">{review.quarter} · {t(review.target.role)} · {t(review.target.grade)}</h3><p className="text-sm">{say(review.status)} · #{review.revision}</p><p className="text-xs text-muted-foreground">{review.reviewerId ? `${say("manager")}: ${review.reviewerId}` : say("noManager")}</p>
    <details><summary className="cursor-pointer text-sm">{say("scale")}</summary>{review.target.proficiencyScale ? Object.entries(review.target.proficiencyScale).map(([level, text]) => <p key={level} className="text-xs">{level}: {t(text)}</p>) : <p className="text-xs">{say("noScale")}</p>}</details>
    {review.decision && <div className="rounded-lg border border-teal-200 bg-teal-50 p-4"><p className="text-sm font-semibold">{say(review.status === "approved" ? "approved" : "returned")} · {review.decision.actorId === "hr_demo" ? say("hrActor") : review.decision.actorId}</p><p className="mt-2 whitespace-pre-wrap text-sm">{review.decision.comment}</p><p className="mt-2 text-xs">{say("calibrationMissing")}</p>{review.decision.ratings.map(r => <p key={r.skillId} className="mt-1 text-xs">{t(skills.find(s => s.skill_id === r.skillId)?.name ?? r.skillId)}: {say("finalRating")} {r.finalRating}</p>)}</div>}
    {canDecide && review.status === "submitted" && <DecisionForm review={review} skills={skills} busy={busy} command={command}/>}
    <details open={canEdit}><summary className="cursor-pointer text-sm font-medium">{say("submittedEvidence")}</summary>
    {items.map((item, index) => <fieldset disabled={!canEdit || busy} key={item.skillId} className="space-y-2 rounded-lg bg-brand-paper p-3"><legend className="text-sm font-medium">{t(skills.find(s => s.skill_id === item.skillId)?.name ?? item.skillId)} · {t("Required")} {review.target.requiredSkills[item.skillId]}{review.target.criticalSkills.includes(item.skillId) ? ` · ${t("Critical")}` : ""}</legend><label className="block text-xs">{say("rating")}<select value={item.selfRating ?? ""} onChange={e => update(index, { selfRating: e.target.value === "" ? null : Number(e.target.value) })} className="ml-2 rounded border bg-white p-2"><option value="">—</option>{[0, 1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</select></label><label className="block text-xs">{say("justification")}<textarea maxLength={4000} rows={3} value={item.justification} onChange={e => update(index, { justification: e.target.value })} className="mt-1 w-full rounded border bg-white p-2 text-sm"/></label></fieldset>)}</details>
    {canEdit && <><p className="text-xs text-muted-foreground">{say("missing")}</p><div className="flex flex-wrap gap-2"><Button disabled={busy} variant="outline" onClick={() => command({ action: "save", id: review.id, revision: review.revision, items })}>{say("save")}</Button><Button disabled={busy || !complete} onClick={() => command({ action: "submit", id: review.id, revision: review.revision, items })}>{say("submit")}</Button></div></>}
    {editable && ["submitted", "returned"].includes(review.status) && <Button disabled={busy} variant="outline" onClick={() => command({ action: "reopen", id: review.id, revision: review.revision, items: [] })}>{say("reopen")}</Button>}
  </div>;
}

function DecisionForm({ review, skills, busy, command }: { review: ReviewCycle; skills: { skill_id: string; name: string }[]; busy: boolean; command: (input: object) => Promise<void> }) {
  const { locale, t } = useI18n();
  const say = (key: Parameters<typeof reviewText>[1]) => reviewText(locale, key);
  const [ratings, setRatings] = useState<Record<string, string>>({});
  const [comment, setComment] = useState("");
  const attempt = useRef<{ fingerprint: string; id: string } | null>(null);
  async function decide(action: "approve" | "return") {
    const payload = { action, employeeId: review.employeeId, id: review.id, revision: review.revision, ratings: action === "return" ? [] : review.items.map(item => ({ skillId: item.skillId, finalRating: Number(ratings[item.skillId]) })), comment };
    const fingerprint = JSON.stringify(payload);
    if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, id: createClientId() };
    await command({ ...payload, commandId: attempt.current.id });
  }
  const complete = review.items.every(i => ratings[i.skillId] !== undefined && ratings[i.skillId] !== "");
  return <div className="space-y-4 rounded-xl border border-brand-navy/20 bg-white p-4">
    <h3 className="font-semibold">{say("decisionTitle")}</h3><p className="text-sm text-muted-foreground">{say("decisionHelp")}</p>
    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{say("calibrationMissing")}</p>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th>{t("Skills & strengths")}</th><th>{say("baseline")}</th><th>{say("rating")}</th><th>{say("finalRating")}</th></tr></thead><tbody>{review.items.map(item => <tr key={item.skillId}><td><strong>{t(skills.find(s => s.skill_id === item.skillId)?.name ?? item.skillId)}</strong><details className="mt-1"><summary className="cursor-pointer text-xs text-muted-foreground">{say("justification")}</summary><p className="mt-2 max-w-lg whitespace-pre-wrap text-xs leading-5">{item.justification}</p></details></td><td>{review.evidence?.assessment.skills[item.skillId] ?? "—"}</td><td>{item.selfRating}</td><td><select aria-label={`${say("finalRating")} · ${t(skills.find(s => s.skill_id === item.skillId)?.name ?? item.skillId)}`} disabled={busy} value={ratings[item.skillId] ?? ""} onChange={e => setRatings(current => ({ ...current, [item.skillId]: e.target.value }))}><option value="">—</option>{[0, 1, 2, 3, 4, 5].map(level => <option key={level} value={level}>{level}</option>)}</select></td></tr>)}</tbody></table></div>
    <label className="block text-sm font-medium">{say("comment")}<textarea disabled={busy} maxLength={4000} rows={3} value={comment} onChange={e => setComment(e.target.value)} className="mt-2 w-full rounded-lg border p-3 text-sm"/></label>
    <p className="text-xs text-muted-foreground">{say("decisionRequired")}</p><div className="flex flex-wrap gap-3"><Button type="button" disabled={busy || !complete || !comment.trim()} onClick={() => decide("approve")}>{say("approve")}</Button><Button type="button" variant="outline" disabled={busy || !comment.trim()} onClick={() => decide("return")}>{say("return")}</Button></div>
  </div>;
}
