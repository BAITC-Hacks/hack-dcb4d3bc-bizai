import { chatStreamResponse, type ChatEvent } from "@/lib/ai/stream";
import { cookies } from "next/headers";
import { z } from "zod";
import { assistantModes, type Advice, type AssistantResult } from "@/lib/ai/contracts";
import { buildAssistantContext } from "@/lib/ai/context";
import { aiText } from "@/lib/ai/copy";
import { promptVersion, ProviderError, requestAdvice } from "@/lib/ai/provider";
import { presentAdvice } from "@/lib/ai/presentation";
import { localeCookie, parseLocale } from "@/lib/i18n";
import { canReadEmployee } from "@/lib/server/access";
import { AssistantStore } from "@/lib/server/assistant-store";
import { readBody, sameOrigin } from "@/lib/server/http";
import { repository } from "@/lib/server/repository";
import { getActor } from "@/lib/server/session";

export const runtime = "nodejs";
const selection = z.object({ employeeId: z.string().min(1).max(100), mode: z.enum(assistantModes), eventId: z.string().min(1).max(100).nullable().default(null) });
const command = selection.extend({ id: z.string().uuid(), message: z.string().trim().min(1).max(2000), datasetRevision: z.number().int().positive(), planRevision: z.number().int().nonnegative(), consultationRevision: z.number().int().nonnegative().default(0) }).strict();
const runtimeState = globalThis as typeof globalThis & { assistantRequests?: Set<string> };
const pending = runtimeState.assistantRequests ??= new Set<string>();
async function contextFor(input: z.infer<typeof selection>) {
  const actor = await getActor();
  if (!canReadEmployee(actor, input.employeeId) || (input.mode === "hr") !== (actor?.accessRole === "hr")) return null;
  const store = repository();
  const snapshot = store.read();
  const employee = snapshot.data.employees.find(e => e.employee_id === input.employeeId);
  if (!employee) return null;
  if (input.mode === "activity" && !input.eventId) throw new Error("Choose an activity");
  const planning = store.planning(employee.employee_id);
  const audit = new AssistantStore();
  let consultation;
  try { consultation = audit.consultation(employee.employee_id, snapshot.revision, planning.revision); } finally { audit.close(); }
  const context = buildAssistantContext(snapshot, employee, planning, input.mode, input.eventId, consultation, store.reviews(actor!, employee.employee_id));
  const cookie = (await cookies()).get(localeCookie)?.value;
  const locale = cookie ? parseLocale(cookie) : employee.preferred_language;
  return { context, locale, scope: actor!.accessRole === "hr" ? "hr" : `employee:${employee.employee_id}` };
}
export async function GET(request: Request) {
  let audit: AssistantStore | undefined;
  try {
    const url = new URL(request.url);
    const input = selection.parse({ employeeId: url.searchParams.get("employeeId"), mode: url.searchParams.get("mode"), eventId: url.searchParams.get("eventId") });
    const current = await contextFor(input);
    if (!current) return new Response("Forbidden", { status: 403 });
    audit = new AssistantStore();
    const { context, scope, locale } = current;
    return Response.json({ turns: audit.conversation(scope, input.employeeId, context.datasetRevision, context.planRevision, input.mode, input.eventId), datasetRevision: context.datasetRevision, planRevision: context.planRevision, locale, consultation: context.consultation, readiness: context.readiness, configured: Boolean(process.env.OPENAI_API_KEY) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
  finally { audit?.close(); }
}
export async function POST(request: Request) {
  const started = Date.now();
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  let audit: AssistantStore | undefined;
  let lock: string | undefined;
  let streaming = false;
  const release = () => { if (lock) pending.delete(lock); audit?.close(); };
  try {
    const input = command.parse(await readBody(request));
    const current = await contextFor(input);
    if (!current) return new Response("Forbidden", { status: 403 });
    const { context, scope, locale } = current;
    if (context.datasetRevision !== input.datasetRevision || context.planRevision !== input.planRevision || context.consultation.revision !== input.consultationRevision) return Response.json({ error: "Context changed" }, { status: 409 });
    audit = new AssistantStore();
    const existing = audit.get(input.id, scope, input.employeeId);
    if (existing) {
      if (existing.datasetRevision !== context.datasetRevision || existing.planRevision !== context.planRevision || (existing.consultationRevision ?? 0) !== context.consultation.revision || existing.message !== input.message || existing.mode !== input.mode || existing.eventId !== input.eventId) return Response.json({ error: "Request ID reused" }, { status: 409 });
      if (request.headers.get("accept")?.includes("text/event-stream")) {
        streaming = true;
        return chatStreamResponse(async () => existing, request.signal, release);
      }
      return Response.json(existing);
    }
    if (pending.has(scope) || audit.limited(scope)) return Response.json({ error: "Please wait" }, { status: 429 });
    lock = scope; pending.add(scope);
    const history = audit.conversation(scope, input.employeeId, context.datasetRevision, context.planRevision, input.mode, input.eventId);
    // Only this authorized conversation is reused; old dataset/plan revisions cannot bleed in.
    const messages = history.slice(-6).flatMap(turn => [{ role: "user" as const, content: turn.message }, { role: "assistant" as const, content: JSON.stringify({ ...turn.advice, previous_preferences: (turn.consultationRevision ?? 0) !== context.consultation.revision }) }]);
    messages.push({ role: "user", content: input.message });
    for (const turn of [...history.slice(-6), { id: input.id, message: input.message }]) context.facts.push({ id: `statement:${turn.id}`, label: "Attributed chat statement", source: `chat:${scope}:${turn.id}`, value: { text: turn.message, verified: false } });
    async function generate(emit: (event: ChatEvent) => void, signal: AbortSignal) {
      signal.throwIfAborted();
      emit({ type: "status", phase: "thinking" });
      let advice: Advice;
      let reason: AssistantResult["reason"] = null;
      let model: string | null = null;
      let toolCalls: NonNullable<AssistantResult["toolCalls"]> = [];
      try {
        const generated = await requestAdvice(context, messages, locale, { signal });
        signal.throwIfAborted();
        emit({ type: "status", phase: "validating" });
        advice = presentAdvice(generated.advice, context, locale); model = generated.model; toolCalls = generated.toolCalls;
      } catch (error) {
        signal.throwIfAborted();
        reason = error instanceof ProviderError ? error.reason : "unavailable";
        toolCalls = error instanceof ProviderError ? error.toolCalls : [];
        advice = { summary: aiText(locale, "fallback"), questions: !context.focus ? [aiText(locale, "goalQuestion")] : context.readiness.reason === "constraints" ? [aiText(locale, "constraintsQuestion")] : [], insights: [], recommendations: [], goal_draft: null };
      }
      const result: AssistantResult = {
        id: input.id, createdAt: new Date().toISOString(), message: input.message, advice,
        engine: reason ? "rules" : "openai", reason, toolCalls,
        state: !reason && !advice.questions.length && !advice.consultation_draft && !advice.goal_draft && !advice.recommendations.length ? "explained" : !context.focus ? "needs_goal" : context.readiness.reason === "constraints" && input.mode !== "hr" ? "needs_input" : advice.questions.length ? "needs_input" : advice.recommendations.length ? "ready" : advice.insights.length ? "explained" : "no_match",
        evidence: context.facts, activities: context.candidates.map(c => ({ id: c.event_id, title: c.title })),
        consultationRevision: context.consultation.revision, readiness: context.readiness,
        datasetRevision: context.datasetRevision, planRevision: context.planRevision, locale, mode: input.mode, eventId: input.eventId, model, latencyMs: Date.now() - started,
      };
      signal.throwIfAborted();
      audit!.save(scope, input.employeeId, result, promptVersion);
      return result;
    }
    if (request.headers.get("accept")?.includes("text/event-stream")) {
      streaming = true;
      return chatStreamResponse(generate, request.signal, release);
    }
    return Response.json(await generate(() => {}, request.signal), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error && error.message === "Context changed" ? "Context changed" : "Invalid request or unavailable storage" }, { status: error instanceof Error && error.message === "Context changed" ? 409 : 400 });
  } finally { if (!streaming) release(); }
}
