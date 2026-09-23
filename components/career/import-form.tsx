"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Preview = { revision: number; employeesAdded: number; employeesUnchanged: number; historyAdded: number; historyUnchanged: number };
export function ImportForm({ revision }: { revision: number }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [payload, setPayload] = useState<{ employees?: string; history?: string } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(mode: "preview" | "apply" | "reset") {
    setBusy(true); setMessage("");
    try {
      let files = payload ?? {};
      if (mode === "preview") {
        setPreview(null); setPayload(null);
        const values = new FormData(form.current!);
        files = {};
        for (const key of ["employees", "history"] as const) {
          const file = values.get(key) as File;
          if (file.size > 2 * 1024 * 1024) throw new Error("Each file must be at most 2 MB");
          if (file.size) files[key] = await file.text();
        }
      }
      const response = await fetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...files, mode, revision: mode === "reset" ? revision : preview?.revision }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Request failed");
      if (mode === "preview") { setPreview(result); setPayload(files); }
      else { setPreview(null); setPayload(null); setMessage(mode === "reset" ? "Demo reset to the supplied dataset." : "Import applied atomically."); router.refresh(); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Import failed"); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5"><form ref={form} onSubmit={event => { event.preventDefault(); void submit("preview"); }} onChange={() => { setPreview(null); setPayload(null); }} className="space-y-4">
    <label className="block text-sm">Employee JSON envelope<input className="mt-2 block w-full rounded-lg border p-3" type="file" name="employees" accept=".json,application/json" disabled={busy}/></label>
    <label className="block text-sm">Activity history CSV<input className="mt-2 block w-full rounded-lg border p-3" type="file" name="history" accept=".csv,text/csv" disabled={busy}/></label>
    <Button disabled={busy}>{busy ? "Validating…" : "Validate & preview"}</Button>
  </form>
    {preview && <div className="space-y-3 rounded-lg border bg-brand-paper p-4"><p className="text-sm">Employees: {preview.employeesAdded} new, {preview.employeesUnchanged} unchanged.<br/>History: {preview.historyAdded} new, {preview.historyUnchanged} unchanged.</p><Button disabled={busy} onClick={() => void submit("apply")}>Apply validated import</Button></div>}
    <p role="status" className="whitespace-pre-wrap break-words text-sm">{message}</p>
    <details className="border-t pt-4"><summary className="cursor-pointer text-sm font-medium">Reset demo data</summary><p className="my-3 text-sm text-muted-foreground">This removes all imported profiles and history from the active database and restores the supplied fixtures.</p><Button variant="destructive" disabled={busy} onClick={() => { if (window.confirm("Discard imported data and restore the supplied fixtures?")) void submit("reset"); }}>Reset to supplied data</Button></details>
  </div>;
}
