import { z } from "zod";
import { AssistantStore } from "@/lib/server/assistant-store";
import { getActor } from "@/lib/server/session";
import { repository } from "@/lib/server/repository";
import { readBody, sameOrigin } from "@/lib/server/http";

export async function POST(request: Request) {
  const actor = await getActor();
  if (!sameOrigin(request) || actor?.accessRole !== "employee" || !actor.employeeId) return new Response("Forbidden", { status: 403 });
  let audit: AssistantStore | undefined;
  try {
    const { turnId } = z.object({ turnId: z.string().uuid() }).strict().parse(await readBody(request));
    audit = new AssistantStore();
    const turn = audit.get(turnId, `employee:${actor.employeeId}`, actor.employeeId);
    const draft = turn?.advice.goal_draft;
    if (!turn || !draft || turn.engine !== "openai") return new Response("Not found", { status: 404 });
    const store = repository();
    const current = store.planning(actor.employeeId);
    const goalId = `ai-${turn.id}`;
    const target = draft.target_role && draft.target_grade ? { target_role: draft.target_role, target_grade: draft.target_grade } : null;
    const existing = current.plan.goals.find(g => g.id === goalId);
    if (existing && existing.wording === draft.wording && JSON.stringify(existing.target) === JSON.stringify(target)) return Response.json({ saved: true });
    if (store.read().revision !== turn.datasetRevision || current.revision !== turn.planRevision || audit.consultation(actor.employeeId, turn.datasetRevision, turn.planRevision).revision !== (turn.consultationRevision ?? 0)) return Response.json({ error: "Context changed" }, { status: 409 });
    // The employee explicitly adopts this draft. The AI turn ID preserves its source.
    store.savePlanning(actor, actor.employeeId, turn.datasetRevision, turn.planRevision, {
      ...current.plan, focusId: goalId,
      goals: [...current.plan.goals, { id: goalId, wording: draft.wording, target, origin: "employee" }],
    });
    return Response.json({ saved: true });
  } catch (error) { return Response.json({ error: "Could not save goal" }, { status: error instanceof Error && /changed/.test(error.message) ? 409 : 400 }); }
  finally { audit?.close(); }
}
