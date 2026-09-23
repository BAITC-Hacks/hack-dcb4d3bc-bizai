import type { AssistantResult } from "./contracts";
export type ChatPhase = "checking" | "thinking" | "validating";
export type ChatEvent = { type: "status"; phase: ChatPhase } | { type: "delta"; text: string } | { type: "result"; result: AssistantResult } | { type: "error"; code: "stale" | "error" };
export function encodeChatEvent(event: ChatEvent) { return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`); }

// Fetch streaming (rather than EventSource) keeps POST authorization and request IDs.
export async function readChatStream(body: ReadableStream<Uint8Array>, onEvent: (event: ChatEvent) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", completed = false;
  function consume() {
    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
      const data = frame.split("\n").filter(line => line.startsWith("data: ")).map(line => line.slice(6)).join("\n");
      if (!data) continue;
      const event = JSON.parse(data) as ChatEvent;
      onEvent(event);
      if (event.type === "result" || event.type === "error") completed = true;
    }
  }
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 2_000_000) throw new Error("Stream frame too large");
      consume();
    }
    buffer += decoder.decode(); consume();
    if (!completed) throw new Error("Incomplete assistant stream");
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export function chatStreamResponse(generate: (emit: (event: ChatEvent) => void, signal: AbortSignal) => Promise<AssistantResult>, parentSignal: AbortSignal, release: () => void) {
  const abort = new AbortController();
  const forwardAbort = () => abort.abort();
  parentSignal.addEventListener("abort", forwardAbort, { once: true });
  if (parentSignal.aborted) abort.abort();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: ChatEvent) => { if (!abort.signal.aborted) controller.enqueue(encodeChatEvent(event)); };
      void (async () => {
        try {
          emit({ type: "status", phase: "checking" });
          const result = await generate(emit, abort.signal);
          abort.signal.throwIfAborted();
          // Only validated, persisted text reaches the wire. No artificial typing delay.
          const text = [result.advice.summary, ...result.advice.insights.map(i => i.text), ...result.advice.questions, ...result.advice.recommendations.map(r => r.reason)].join("\n\n");
          const points = Array.from(text);
          for (let i = 0; i < points.length; i += 120) emit({ type: "delta", text: points.slice(i, i + 120).join("") });
          emit({ type: "result", result });
        } catch (error) {
          if (!abort.signal.aborted) emit({ type: "error", code: error instanceof Error && error.message === "Context changed" ? "stale" : "error" });
        } finally {
          parentSignal.removeEventListener("abort", forwardAbort);
          release();
          try { controller.close(); } catch { /* The consumer may already have cancelled. */ }
        }
      })();
    },
    cancel() { abort.abort(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}
