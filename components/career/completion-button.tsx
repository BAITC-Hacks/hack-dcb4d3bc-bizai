"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/locale";
import { Button } from "@/components/ui/button";
export function CompletionButton({ eventId, datasetRevision, planRevision }: { eventId: string; datasetRevision: number; planRevision: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  async function complete() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/completions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId, datasetRevision, planRevision }) });
      if (!response.ok) { setError(response.status === 409 ? "Context changed. Reload before completing." : "Could not complete. Try again or reload."); return; }
      router.refresh(); setConfirming(false);
    } catch { setError("Could not complete. Try again or reload."); }
    finally { setBusy(false); }
  }
  return <div className="mt-3 border-t pt-3">
    {!confirming ? <Button type="button" variant="outline" onClick={() => setConfirming(true)}>{t("Record demo completion")}</Button> : <div className="space-y-2"><p className="text-xs text-muted-foreground">{t("Simulate completion once. Only effective skills change; assessments and formal modules stay unchanged.")}</p><div className="flex flex-wrap gap-2"><Button type="button" disabled={busy} onClick={complete}>{t(busy ? "Saving…" : "Confirm demo completion")}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setConfirming(false)}>{t("Cancel changes")}</Button></div></div>}
    {error && <p role="alert" className="mt-2 text-xs text-amber-800">{t(error)}</p>}
  </div>;
}
