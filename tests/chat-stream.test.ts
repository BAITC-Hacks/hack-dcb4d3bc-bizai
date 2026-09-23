import test from "node:test";
import assert from "node:assert/strict";
import { chatStreamResponse, encodeChatEvent, readChatStream, type ChatEvent } from "../lib/ai/stream";
import type { AssistantResult } from "../lib/ai/contracts";
const result: AssistantResult = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), message: "Help", advice: { summary: "Даму бағыты 👋", insights: [], questions: ["What is your goal?"], recommendations: [], goal_draft: null }, engine: "rules", reason: "not_configured", state: "needs_goal", evidence: [], activities: [], datasetRevision: 1, planRevision: 0, locale: "kk", mode: "coach", eventId: null, model: null, latencyMs: 1 };

test("SSE parser handles UTF-8 split across arbitrary network chunks", async () => {
  const bytes = encodeChatEvent({ type: "result", result });
  const stream = new ReadableStream<Uint8Array>({ start(c) { for (let i = 0; i < bytes.length; i += 3) c.enqueue(bytes.slice(i, i + 3)); c.close(); } });
  const events: ChatEvent[] = [];
  await readChatStream(stream, e => events.push(e));
  assert.deepEqual(events, [{ type: "result", result }]);
});

test("stream exposes progress first and publishes only a completed validated result", async () => {
  let finish!: (value: AssistantResult) => void;
  const completed = new Promise<AssistantResult>(resolve => { finish = resolve; });
  let released = 0;
  const response = chatStreamResponse(async emit => { emit({ type: "status", phase: "thinking" }); return completed; }, new AbortController().signal, () => released++);
  const events: ChatEvent[] = [];
  const read = readChatStream(response.body!, e => events.push(e));
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.deepEqual(events.map(e => e.type), ["status", "status"]);
  finish(result); await read;
  assert.equal(events.at(-1)?.type, "result");
  assert.equal(events.filter(e => e.type === "delta").map(e => e.text).join(""), "Даму бағыты 👋\n\nWhat is your goal?");
  assert.equal(released, 1);
});

test("stale persistence failure streams an error without publishing any answer text", async () => {
  const events: ChatEvent[] = [];
  const response = chatStreamResponse(async () => { throw new Error("Context changed"); }, new AbortController().signal, () => {});
  await readChatStream(response.body!, e => events.push(e));
  assert.deepEqual(events, [{ type: "status", phase: "checking" }, { type: "error", code: "stale" }]);
});

test("consumer cancellation aborts work and releases the request lock", async () => {
  let signal: AbortSignal | undefined, release!: () => void;
  const released = new Promise<void>(resolve => { release = resolve; });
  const response = chatStreamResponse(async (_emit, activeSignal) => {
    signal = activeSignal;
    return new Promise((_resolve, reject) => activeSignal.addEventListener("abort", () => reject(new DOMException("Stopped", "AbortError")), { once: true }));
  }, new AbortController().signal, release);
  const reader = response.body!.getReader(); await reader.read(); await reader.cancel(); await released;
  assert.equal(signal?.aborted, true);
});

test("an incomplete stream is not treated as a saved answer", async () => {
  await assert.rejects(readChatStream(new ReadableStream({ start(c) { c.enqueue(encodeChatEvent({ type: "delta", text: "partial" })); c.close(); } }), () => {}), /Incomplete/);
});
