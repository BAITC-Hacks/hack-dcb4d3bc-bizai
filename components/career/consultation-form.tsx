"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/providers/locale";
import { aiText } from "@/lib/ai/copy";
import { activityFormats, type Consultation } from "@/lib/ai/consultation";

export function ConsultationForm({ consultation, datasetRevision, planRevision, disabled, onSaved, onBusy, proposed = false }: {
  proposed?: boolean;
  consultation: Consultation; datasetRevision: number; planRevision: number; disabled: boolean;
  onSaved: () => void; onBusy: (busy: boolean) => void;
}) {
  const { locale, t } = useI18n();
  const say = (key: Parameters<typeof aiText>[1]) => aiText(locale, key);
  const [hours, setHours] = useState(consultation.answers?.maxHours?.toString() ?? "");
  const [formats, setFormats] = useState(consultation.answers?.formats ?? []);
  const [notes, setNotes] = useState(consultation.answers?.notes ?? "");
  const [error, setError] = useState<"error" | "stale" | null>(null);
  async function save(event: React.FormEvent) {
    event.preventDefault(); onBusy(true); setError(null);
    try {
      const response = await fetch("/api/assistant/consultation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ datasetRevision, planRevision, revision: consultation.revision, answers: { maxHours: hours.trim() ? Number(hours) : null, formats, notes } }) });
      if (!response.ok) { setError(response.status === 409 ? "stale" : "error"); return; }
      onSaved();
    } catch { setError("error"); }
    finally { onBusy(false); }
  }
  return <form onSubmit={save} className="space-y-3 rounded-xl border bg-brand-paper p-4">
    <fieldset disabled={disabled} className="space-y-3">
      <legend className="text-sm font-semibold">{say("constraintsTitle")}</legend>
      <p className="text-xs text-muted-foreground">{say(proposed ? "preferenceProposal" : consultation.answers ? "confirmedConstraints" : "constraintsQuestion")}</p>
      <label className="block text-xs font-medium">{say("maxHours")}<input type="number" min="0.1" max="10000" step="any" value={hours} onChange={e => setHours(e.target.value)} placeholder={say("unlimited")} className="mt-1 block w-full rounded-lg border bg-white p-2 text-sm"/></label>
      <fieldset><legend className="mb-1 text-xs font-medium">{say("formats")}</legend><div className="flex flex-wrap gap-4">{activityFormats.map(format => <label key={format} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={formats.includes(format)} onChange={e => setFormats(current => e.target.checked ? [...current, format] : current.filter(f => f !== format))}/>{t(format)}</label>)}</div></fieldset>
      <p className="text-xs text-muted-foreground">{say("constraintsHint")}</p>
      <label className="block text-xs font-medium">{say("notes")}<textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} maxLength={2000} className="mt-1 block w-full rounded-lg border bg-white p-2 text-sm"/></label>
      <p className="text-xs text-muted-foreground">{say("notesHint")}</p>
      <Button type="submit" variant="outline">{say("confirmConstraints")}</Button>
    </fieldset>
    {error && <p role="alert" className="text-sm text-amber-800">{say(error)}</p>}
  </form>;
}
