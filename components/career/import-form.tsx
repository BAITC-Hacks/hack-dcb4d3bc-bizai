"use client";
import { useI18n } from "@/components/providers/locale";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Preview = { revision: number; employeesAdded: number; employeesUnchanged: number; historyAdded: number; historyUnchanged: number };
export function ImportForm({ revision }: { revision: number }) {
  const { t, locale, formatNumber } = useI18n();
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [payload, setPayload] = useState<{ employees?: string; history?: string } | null>(null);
  const [message, setMessage] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [filenames, setFilenames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function submit(mode: "preview" | "apply" | "reset") {
    setBusy(true); setMessage(""); setErrorDetail("");
    try {
      let files = payload ?? {};
      if (mode === "preview") {
        setPreview(null); setPayload(null);
        const values = new FormData(form.current!);
        files = {};
        for (const key of ["employees", "history"] as const) {
          const file = values.get(key) as File;
          if (file.size > 2 * 1024 * 1024) throw new Error(t("Each file must be at most 2 MB"));
          if (file.size) files[key] = await file.text();
        }
      }
      const response = await fetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...files, mode, revision: mode === "reset" ? revision : preview?.revision }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? t("Request failed"));
      if (mode === "preview") { setPreview(result); setPayload(files); }
      else { setPreview(null); setPayload(null); setMessage(mode === "reset" ? t("Demo reset to the supplied dataset.") : t("Import applied atomically.")); router.refresh(); }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Import failed";
      const translated = t(detail);
      if (locale === "en" || translated !== detail || /[А-Яа-яӘәІіҢңҒғҮүҰұҚқӨөҺһ]/.test(detail)) setMessage(translated);
      else { setMessage(t("Import could not be validated. Check the files and try again.")); setErrorDetail(detail); }
    }
    finally { setBusy(false); }
  }
  return <div className="space-y-5"><form ref={form} onSubmit={event => { event.preventDefault(); void submit("preview"); }} onChange={event => { setPreview(null); setPayload(null); const input = event.target; if (input instanceof HTMLInputElement && input.files) setFilenames(previous => ({ ...previous, [input.name]: input.files?.[0]?.name ?? "" })); }} className="space-y-4">
    <label className="block text-sm">{t("Employee JSON envelope")}<span className="relative mt-2 flex cursor-pointer items-center gap-3 rounded-lg border p-3 focus-within:ring-2 focus-within:ring-brand-navy"><input className="sr-only" type="file" name="employees" accept=".json,application/json" disabled={busy}/><span className="shrink-0 rounded bg-brand-mist px-2 py-1 text-xs">{t("Choose file")}</span><span className="min-w-0 truncate text-xs text-muted-foreground">{filenames.employees || t("No file selected")}</span></span></label>
    <label className="block text-sm">{t("Activity history CSV")}<span className="relative mt-2 flex cursor-pointer items-center gap-3 rounded-lg border p-3 focus-within:ring-2 focus-within:ring-brand-navy"><input className="sr-only" type="file" name="history" accept=".csv,text/csv" disabled={busy}/><span className="shrink-0 rounded bg-brand-mist px-2 py-1 text-xs">{t("Choose file")}</span><span className="min-w-0 truncate text-xs text-muted-foreground">{filenames.history || t("No file selected")}</span></span></label>
    <Button disabled={busy}>{busy ? t("Validating…") : t("Validate & preview")}</Button>
  </form>
    {preview && <div className="space-y-3 rounded-lg border bg-brand-paper p-4"><p className="text-sm">{t("Employees:")} {formatNumber(preview.employeesAdded)} {t("new,")} {formatNumber(preview.employeesUnchanged)} {t("unchanged.")}<br/>{t("History:")} {formatNumber(preview.historyAdded)} {t("new,")} {formatNumber(preview.historyUnchanged)} {t("unchanged.")}</p><Button disabled={busy} onClick={() => void submit("apply")}>{t("Apply validated import")}</Button></div>}
    <p role="status" className="whitespace-pre-wrap break-words text-sm">{message}</p>
    {errorDetail && <details className="text-xs"><summary>{t("Technical details")}</summary><pre lang="en" className="mt-2 whitespace-pre-wrap break-words">{errorDetail}</pre></details>}
    <details className="border-t pt-4"><summary className="cursor-pointer text-sm font-medium">{t("Reset demo data")}</summary><p className="my-3 text-sm text-muted-foreground">{t("This removes all imported profiles and history from the active database and restores the supplied fixtures.")}</p><Button variant="destructive" disabled={busy} onClick={() => { if (window.confirm(t("Discard imported data and restore the supplied fixtures?"))) void submit("reset"); }}>{t("Reset to supplied data")}</Button></details>
  </div>;
}
