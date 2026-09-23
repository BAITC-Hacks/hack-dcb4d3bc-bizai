"use client";
import { useState } from "react";
import { useI18n } from "@/components/providers/locale";
import { Button } from "@/components/ui/button";
import { aiText } from "@/lib/ai/copy";
import type { ConsultationAnswers } from "@/lib/ai/consultation";
import { ConsultationForm } from "./consultation-form";

export function PreferenceProposal({ draft, revision, datasetRevision, planRevision, busy, onBusy, onSaved }: {
  draft: ConsultationAnswers; revision: number; datasetRevision: number; planRevision: number;
  busy: boolean; onBusy: (busy: boolean) => void; onSaved: () => void;
}) {
  const { locale, t, formatNumber } = useI18n();
  const say = (key: Parameters<typeof aiText>[1]) => aiText(locale, key);
  const [error, setError] = useState<"stale" | "error" | null>(null);
  async function save() {
    onBusy(true); setError(null);
    try {
      const response = await fetch("/api/assistant/consultation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision, datasetRevision, planRevision, answers: draft }) });
      if (!response.ok) { setError(response.status === 409 ? "stale" : "error"); return; }
      onSaved();
    } catch { setError("error"); } finally { onBusy(false); }
  }
  return <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/40 p-3">
    <p className="text-sm font-medium">{say("preferenceProposal")}</p>
    <p className="text-sm">{say("maxHours")}: {draft.maxHours === null ? say("unlimited") : formatNumber(draft.maxHours)} · {draft.formats.length ? draft.formats.map(t).join(", ") : say("anyFormat")}</p>
    {draft.notes && <p className="text-xs text-muted-foreground">{draft.notes}</p>}
    <Button type="button" disabled={busy} variant="outline" onClick={save}>{say("usePreferences")}</Button>
    <details className="chat-disclosure"><summary>{say("editPreferences")}</summary><div className="mt-3"><ConsultationForm consultation={{ revision, answers: draft }} proposed datasetRevision={datasetRevision} planRevision={planRevision} disabled={busy} onBusy={onBusy} onSaved={onSaved}/></div></details>
    {error && <p role="alert" className="text-xs text-amber-800">{say(error)}</p>}
  </div>;
}
