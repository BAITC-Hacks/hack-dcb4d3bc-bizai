"use client";
import { useEffect, useRef, useState, useId } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Sparkles, X, Maximize2 } from "lucide-react";
import { AssistantPanel } from "./assistant-panel";
import { useI18n } from "@/components/providers/locale";
import { aiText } from "@/lib/ai/copy";

export function AdvisorWidget({ employeeId, employees = [] }: { employeeId: string | null; employees?: { id: string; name: string }[] }) {
  const { locale } = useI18n();
  const say = (key: Parameters<typeof aiText>[1]) => aiText(locale, key);
  const pathname = usePathname(), params = useSearchParams();
  const [open, setOpen] = useState(false), [mounted, setMounted] = useState(false);
  const [subject, setSubject] = useState(employeeId ?? "");
  const launcher = useRef<HTMLButtonElement>(null), closeButton = useRef<HTMLButtonElement>(null);
  const dialogId = useId();
  const fullPage = params.get("view") === "advisor" && (pathname === "/employee/dashboard" || pathname.startsWith("/hr/employees/"));
  const fullHref = employeeId ? "/employee/dashboard?view=advisor" : subject ? `/hr/employees/${encodeURIComponent(subject)}?view=advisor` : "/hr/dashboard";
  useEffect(() => { if (open && !fullPage) closeButton.current?.focus(); }, [open, fullPage]);
  function close() { setOpen(false); launcher.current?.focus(); }
  return <div hidden={fullPage} className="advisor-widget">
    {mounted && <div hidden={!open} id={dialogId} role="dialog" aria-modal="false" aria-label={say("chatAdvisor")} className="advisor-widget-window" onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); close(); } }}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-white px-4 py-2.5"><p className="truncate text-xs font-medium text-muted-foreground">{employeeId ? "Career Quest AI" : employees.find(e => e.id === subject)?.name ?? say("widgetSubject")}</p><div className="flex items-center gap-3"><Link href={fullHref} title={say("widgetFull")} aria-label={say("widgetFull")} onClick={() => setOpen(false)}><Maximize2 size={15}/></Link><button ref={closeButton} type="button" onClick={close} aria-label={say("widgetClose")} title={say("widgetClose")}><X size={18}/></button></div></div>
      {!employeeId && <label className="shrink-0 border-b bg-white px-4 py-3 text-xs">{say("widgetSubject")}<select className="mt-1" value={subject} onChange={e => setSubject(e.target.value)}><option value="">—</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name} · {e.id}</option>)}</select></label>}
      {subject ? <AssistantPanel key={subject} employeeId={subject} mode={employeeId ? "coach" : "hr"} compact/> : <div className="grid flex-1 place-items-center bg-slate-50 p-8 text-center text-sm text-muted-foreground">{say("widgetChoose")}</div>}
    </div>}
    <button ref={launcher} type="button" className="advisor-widget-launcher" aria-label={say(open ? "widgetClose" : "widgetOpen")} aria-expanded={open} aria-controls={mounted ? dialogId : undefined} onClick={() => { setMounted(true); if (open) close(); else setOpen(true); }}><Sparkles size={21}/><span>{say("widgetOpen")}</span><span className="h-2 w-2 rounded-full bg-teal-300"/></button>
  </div>;
}
