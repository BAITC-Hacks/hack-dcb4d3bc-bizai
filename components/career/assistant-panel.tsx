"use client";
import { useEffect, useRef, useState, useId } from "react";
import { useRouter } from "next/navigation";
import { ConsultationForm } from "./consultation-form";
import type { Consultation, Readiness } from "@/lib/ai/consultation";
import { readChatStream, type ChatPhase } from "@/lib/ai/stream";
import { Sparkles, ArrowUp, Square, SlidersHorizontal, UserRound, Copy, Check, ArrowDown, ArrowUpRight, X } from "lucide-react";
import { useI18n } from "@/components/providers/locale";
import { Button } from "@/components/ui/button";
import type { AssistantMode, AssistantResult } from "@/lib/ai/contracts";
import { aiText, type CopyKey } from "@/lib/ai/copy";

type Session = { consultation: Consultation; readiness: Readiness; turns: AssistantResult[]; datasetRevision: number; planRevision: number; locale: "en" | "ru" | "kk"; configured: boolean };
export function AssistantPanel({ employeeId, mode, activities = [], compact = false }: { employeeId: string; mode: AssistantMode; activities?: { id: string; title: string }[]; compact?: boolean }) {
  const { locale, t, formatNumber, formatDate } = useI18n();
  const say = (key: CopyKey) => aiText(locale, key);
  const router = useRouter();
  const instanceId = useId();
  const [eventId, setEventId] = useState(activities[0]?.id ?? "");
  const [session, setSession] = useState<Session | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [streamText, setStreamText] = useState("");
  const [phase, setPhase] = useState<ChatPhase>("checking");
  const [contextOpen, setContextOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [error, setError] = useState<CopyKey | null>(null);
  const [notice, setNotice] = useState<CopyKey | null>(null);
  const [reload, setReload] = useState(0);
  const submission = useRef<{ id: string; message: string } | null>(null);
  const epoch = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const follow = useRef(true);
  useEffect(() => {
    const controller = new AbortController();
    epoch.current++; submission.current = null;
    activeRequest.current?.abort();
    setSession(null); setBusy(false); setSending(false); setError(null); setPendingMessage(null); setStreamText("");
    const query = new URLSearchParams({ employeeId, mode, ...(mode === "activity" ? { eventId } : {}) });
    fetch(`/api/assistant?${query}`, { signal: controller.signal, cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Unavailable");
      const value = await response.json() as Session;
      if (!controller.signal.aborted) { setSession(value); follow.current = true; }
    }).catch(() => { if (!controller.signal.aborted) setError("error"); });
    return () => { controller.abort(); activeRequest.current?.abort(); };
  }, [employeeId, mode, eventId, reload]);
  useEffect(() => {
    const refresh = (event: Event) => { if ((event as CustomEvent).detail !== instanceId && !busy) setReload(n => n + 1); };
    window.addEventListener("career-chat-updated", refresh);
    return () => window.removeEventListener("career-chat-updated", refresh);
  }, [instanceId, busy]);
  useEffect(() => {
    if (follow.current && transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [session, pendingMessage, streamText, phase]);
  function announce() { window.dispatchEvent(new CustomEvent("career-chat-updated", { detail: instanceId })); }
  async function ask(text: string) {
    if (!session || busy || !text.trim()) return;
    const activeEpoch = epoch.current;
    const attempt = submission.current?.message === text ? submission.current : { id: crypto.randomUUID(), message: text };
    submission.current = attempt;
    const controller = new AbortController(); activeRequest.current = controller;
    setBusy(true); setSending(true); setError(null); setNotice(null); setMessage("");
    setPendingMessage(text); setStreamText(""); setPhase("checking"); follow.current = true;
    let received = false;
    try {
      const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream" }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]), body: JSON.stringify({ ...attempt, employeeId, mode, eventId: mode === "activity" ? eventId : null, datasetRevision: session.datasetRevision, planRevision: session.planRevision, consultationRevision: session.consultation.revision }) });
      if (activeEpoch !== epoch.current) return;
      if (!response.ok) { setError(response.status === 409 ? "stale" : response.status === 429 ? "limited" : "error"); return; }
      if (!response.body) throw new Error("No stream");
      await readChatStream(response.body, event => {
        if (activeEpoch !== epoch.current || controller.signal.aborted) return;
        if (event.type === "status") setPhase(event.phase);
        if (event.type === "delta") setStreamText(current => current + event.text);
        if (event.type === "error") { setError(event.code); setStreamText(""); }
        if (event.type === "result") {
          received = true;
          const turn = event.result;
          setSession(value => value ? { ...value, turns: [...value.turns.filter(old => old.id !== turn.id), turn].slice(-6) } : value);
          submission.current = null; setPendingMessage(null); setStreamText(""); announce();
        }
      });
    } catch {
      if (activeEpoch === epoch.current) { setStreamText(""); if (controller.signal.aborted) setNotice("stopped"); else setError("error"); }
    } finally {
      if (activeEpoch === epoch.current) { setBusy(false); setSending(false); if (!received) setMessage(text); }
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }
  function stop() {
    // A stopped request must not later overwrite a retry, even if transport abort is delayed.
    epoch.current++;
    activeRequest.current?.abort(); activeRequest.current = null;
    setBusy(false); setSending(false); setStreamText(""); setError(null); setNotice("stopped");
    setMessage(submission.current?.message ?? "");
  }
  async function accept(turn: AssistantResult) {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/assistant/goal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ turnId: turn.id }) });
      if (!response.ok) { setError(response.status === 409 ? "stale" : "error"); return; }
      router.refresh(); setReload(n => n + 1); setNotice("saved"); announce();
    } catch { setError("error"); }
    finally { setBusy(false); }
  }
  async function copy(turn: AssistantResult) {
    try { await navigator.clipboard.writeText([turn.advice.summary, ...turn.advice.insights.map(i => i.text), ...turn.advice.questions, ...turn.advice.recommendations.map(r => r.reason)].join("\n\n")); setCopied(turn.id); } catch { setNotice("copyFailed"); }
  }
  const latest = session?.turns.at(-1);
  const evidenceLabel = (id: string, label: string) => id === "profile" || id === "policy" || id === "participation" ? say(id) : id.startsWith("statement:") ? say("statement") : t(label);
  function evidenceSummary(fact: AssistantResult["evidence"][number]) {
    const value = fact.value && typeof fact.value === "object" ? fact.value as Record<string, unknown> : {};
    if (fact.id === "goal") return typeof value.wording === "string" ? value.wording : t("No role-linked focus goal");
    if (fact.id.startsWith("gap:")) return `${value.assessment_recorded ? `${t("Assessment baseline")}: ${formatNumber(Number(value.assessed), 0)}` : t("No assessment recorded; calculations use zero")} · ${t("Effective level")}: ${formatNumber(Number(value.level), 0)} · ${t("Required")}: ${formatNumber(Number(value.required), 0)}`;
    if (fact.id === "profile") return `${t(String(value.role))} · ${t(String(value.grade))}`;
    if (fact.id.startsWith("history:")) return `${t(String(value.status))} · ${formatDate(String(value.date))}`;
    if (fact.id.startsWith("event:")) return `${t(String(value.format))} · ${formatNumber(Number(value.duration_hours))} ${t("h")} · ${Array.isArray(value.reasons) && value.reasons.length ? value.reasons.map(reason => t(String(reason))).join("; ") : t("Eligible")}`;
    if (fact.id.startsWith("milestone:")) return typeof value.criterion === "string" ? value.criterion : t("Employee-defined goal");
    return t("Supporting record; technical details below.");
  }
  function renderAnswer(turn: AssistantResult) {
    const factIds = new Set([...turn.advice.insights, ...turn.advice.recommendations].flatMap(item => item.evidence_ids));
    const facts = turn.evidence.filter(f => factIds.has(f.id) || turn.engine === "rules" && ["goal", "profile", "policy"].includes(f.id));
    return <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground"><span>{say(turn.engine === "openai" ? "interpretation" : "rules")}</span><span>· {say(turn.state)}</span></div>
      {turn.reason && <div className="space-y-2"><p className="text-xs text-amber-800">{say(turn.reason)}</p>{turn.id === latest?.id && <Button type="button" variant="outline" disabled={busy} onClick={() => { submission.current = null; void ask(turn.message); }}>{t("Retry this request")}</Button>}</div>}
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{turn.advice.summary}</p>
      {!!turn.advice.insights.length && <ul className="list-disc space-y-2 pl-5 text-sm">{turn.advice.insights.map((item, i) => <li key={i}>{item.text}<p className="mt-1 text-[10px] text-muted-foreground">{say("sources")}: {item.evidence_ids.map(id => { const fact = turn.evidence.find(f => f.id === id); return fact ? evidenceLabel(fact.id, fact.label) : t("Supporting record"); }).join(" · ")}</p></li>)}</ul>}
      {turn.advice.questions.map((question, i) => <p key={i} className="rounded-lg border border-brand-gold/40 bg-brand-gold/5 p-3 text-sm font-medium">{question}</p>)}
      {turn.advice.goal_draft && <div className="rounded-xl border bg-brand-paper p-3"><p className="text-xs text-muted-foreground">{say("draft")}</p><p className="mt-1 text-sm">{turn.advice.goal_draft.wording}</p>{mode !== "hr" && <Button type="button" className="mt-3" variant="outline" disabled={busy || turn.id !== latest?.id} onClick={() => accept(turn)}>{say("accept")}</Button>}</div>}
      {turn.advice.recommendations.map(item => <div key={item.event_id} className="rounded-xl border border-brand-gold/30 p-3"><p className="text-sm font-semibold">{t(turn.activities.find(a => a.id === item.event_id)?.title) || item.event_id}</p><p className="mt-1 text-sm leading-relaxed">{item.reason}</p><p className="mt-2 text-[10px] text-muted-foreground">{say("sources")}: {item.evidence_ids.map(id => { const fact = turn.evidence.find(f => f.id === id); return fact ? evidenceLabel(fact.id, fact.label) : t("Supporting record"); }).join(" · ")}</p></div>)}
      {!!facts.length && <details className="rounded-lg border p-3"><summary className="cursor-pointer text-xs font-medium">{say("sources")} · {facts.length}</summary><div className="mt-3 space-y-3">{facts.map(fact => <div key={fact.id} className="min-w-0 border-t pt-2"><p className="text-xs font-semibold">{evidenceLabel(fact.id, fact.label)}</p><p className="mt-1 text-xs">{evidenceSummary(fact)}</p><details className="mt-2"><summary className="cursor-pointer text-[10px] text-muted-foreground">{t("Technical details")}</summary><p className="break-all text-[10px] text-muted-foreground">{fact.id} · {say("source")}: {fact.source}</p><pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-brand-paper p-2 text-[10px]">{JSON.stringify(fact.value, null, 2)}</pre></details></div>)}</div></details>}
      <details><summary className="cursor-pointer text-[10px] text-muted-foreground">{t("Technical details")}</summary><p className="text-[10px] text-muted-foreground">{turn.model ?? "rules"} · {(turn.latencyMs / 1000).toFixed(1)}s · {turn.id.slice(0, 8)}</p></details>
    </div>;
  }
  const title = say(mode === "activity" ? "activityTitle" : mode === "hr" ? "hrTitle" : "title");
  const starters: CopyKey[] = mode === "hr" ? ["hrStarter"] : mode === "activity" ? ["activityStarter"] : ["starter", "gapStarter", "goalStarter"];
  return <section id={compact ? undefined : "assistant"} aria-label={title} className={`chat-workspace ${compact ? "chat-workspace-compact" : ""}`}>
    <header className="chat-header"><div className="chat-avatar"><Sparkles size={20}/></div><div className="min-w-0 flex-1"><h2 className="text-base font-semibold text-white">{title}</h2><p className="mt-1 flex items-center gap-2 text-xs text-white/70"><span className="h-1.5 w-1.5 rounded-full bg-teal-300"/>{say("chatGrounded")}</p></div><button type="button" className="chat-header-button" aria-label={say("chatContext")} title={say("chatContext")} aria-expanded={contextOpen} onClick={() => setContextOpen(v => !v)}><SlidersHorizontal size={18}/></button></header>
    <div className="relative flex min-h-0 flex-1 flex-col">
      {contextOpen && <aside className="chat-context"><div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-semibold">{say("chatContext")}</h3><button type="button" aria-label={say("closeContext")} onClick={() => setContextOpen(false)}><X size={18}/></button></div>
        {mode === "activity" && <label className="mb-4 block text-xs font-medium">{say("choose")}<select disabled={busy} className="mt-2" value={eventId} onChange={e => setEventId(e.target.value)}>{activities.map(a => <option key={a.id} value={a.id}>{t(a.title)}</option>)}</select></label>}
        {session && mode !== "hr" && <ConsultationForm key={`${session.datasetRevision}-${session.planRevision}-${session.consultation.revision}`} consultation={session.consultation} datasetRevision={session.datasetRevision} planRevision={session.planRevision} disabled={busy} onBusy={setBusy} onSaved={() => { setContextOpen(false); router.refresh(); setReload(n => n + 1); announce(); }}/>}
        {session?.readiness.state === "blocked" && <p className="mt-4 text-xs leading-5 text-amber-800">{say(session.readiness.reason === "unmapped" ? "blockedUnmapped" : "blockedCatalog")}</p>}
        <a className="mt-4 flex items-center gap-2 text-sm text-brand-navy underline" href={mode === "hr" ? `/hr/employees/${employeeId}?view=plan` : "/employee/dashboard?view=plan"}>{say("plan")}<ArrowUpRight size={14}/></a><p className="mt-4 text-xs leading-5 text-muted-foreground">{say("privacy")}</p>
      </aside>}
      <div ref={transcript} role="log" aria-label={say("chatConversation")} aria-live="polite" aria-relevant="additions" className="chat-transcript" onScroll={() => { const el = transcript.current!; follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; setAtBottom(follow.current); }}>
        {!session && !error && <p role="status" className="py-12 text-center text-sm text-muted-foreground">{say("chatLoading")}</p>}
        {session && !session.turns.length && !pendingMessage && <div className="chat-welcome"><span className="chat-welcome-icon"><Sparkles size={30}/></span><p className="eyebrow mt-6">CAREER QUEST AI</p><h3 className="mt-3 text-2xl font-semibold tracking-tight">{say("chatWelcome")}</h3><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">{say("description")}</p><div className="mt-6 grid w-full gap-2">{starters.map((key, i) => <button key={key} type="button" disabled={busy} className="chat-starter" onClick={() => ask(say(key))}><span>{say(mode === "coach" ? (["chatNext", "chatGaps", "chatGoal"] as const)[i] : "start")}</span><ArrowUpRight size={16}/></button>)}</div></div>}
        {session?.turns.map(turn => <div key={turn.id} className="chat-turn"><div className="chat-user-row"><div className="chat-user-bubble"><span className="sr-only">{say("chatYou")}: </span>{turn.message}</div><span className="chat-user-avatar" aria-hidden="true"><UserRound size={16}/></span></div><div className="chat-assistant-row"><span className="chat-bot-avatar" aria-hidden="true"><Sparkles size={16}/></span><article className="chat-answer"><p className="mb-3 text-xs font-semibold tracking-wide text-teal-800">{say("chatAdvisor")}</p>{renderAnswer(turn)}<button type="button" className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand-navy" onClick={() => copy(turn)}>{copied === turn.id ? <Check size={13}/> : <Copy size={13}/>}{say(copied === turn.id ? "chatCopied" : "chatCopy")}</button></article></div></div>)}
        {pendingMessage && <div className="chat-turn"><div className="chat-user-row"><div className="chat-user-bubble">{pendingMessage}</div><span className="chat-user-avatar"><UserRound size={16}/></span></div><div className="chat-assistant-row"><span className="chat-bot-avatar"><Sparkles size={16}/></span><div className="chat-answer">{streamText ? <p className="whitespace-pre-wrap text-sm leading-6">{streamText}<span className="chat-cursor"/></p> : sending ? <div role="status" className="flex items-center gap-3 text-xs text-muted-foreground"><span className="chat-typing" aria-hidden="true"><i/><i/><i/></span>{say(phase)}</div> : <p className="text-xs text-muted-foreground">{say(notice === "stopped" ? "stopped" : "chatInterrupted")}</p>}</div></div></div>}
      </div>
      {!atBottom && <button type="button" className="chat-scroll-bottom" onClick={() => { follow.current = true; transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: "smooth" }); }}><ArrowDown size={14}/>{say("chatLatest")}</button>}
    </div>
    <footer className="chat-footer">
      {session && mode !== "hr" && !session.consultation.answers && <button type="button" className="mb-3 flex items-center gap-2 text-left text-xs font-medium text-teal-800" onClick={() => setContextOpen(true)}><SlidersHorizontal size={14}/>{say("chatPreferences")}<ArrowUpRight size={13}/></button>}
      {session && !session.configured && <p className="mb-2 text-xs text-amber-800">{say("not_configured")}</p>}
      {error && <div role="alert" className="mb-3 flex flex-wrap items-center gap-2 text-xs text-amber-800"><span>{say(error)}</span><button type="button" className="font-semibold underline" disabled={busy} onClick={() => { if (session && submission.current && error !== "stale") void ask(submission.current.message); else { router.refresh(); setReload(n => n + 1); } }}>{say(error === "stale" ? "retry" : "chatTryAgain")}</button></div>}
      {notice && !sending && <p role="status" className="mb-2 text-xs text-muted-foreground">{say(notice)}</p>}
      <form onSubmit={event => { event.preventDefault(); void ask(message); }} className="chat-composer"><label className="sr-only" htmlFor={instanceId}>{say("placeholder")}</label><textarea ref={composer} id={instanceId} value={message} onChange={e => { setMessage(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`; }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void ask(message); } }} placeholder={say("placeholder")} maxLength={2000} rows={1} disabled={busy} />{sending ? <button type="button" className="chat-send" aria-label={say("chatStop")} title={say("chatStop")} onClick={stop}><Square size={15} fill="currentColor"/></button> : <button type="submit" className="chat-send" disabled={!session || busy || !message.trim()} aria-label={say("send")} title={say("send")}><ArrowUp size={19}/></button>}</form>
      <p className="mt-2 text-center text-[10px] text-muted-foreground">{say("chatHint")}</p>
    </footer>
  </section>;
}
