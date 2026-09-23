import { z } from "zod";
import { consultationAnswersSchema } from "@/lib/ai/consultation";
import { AssistantStore } from "@/lib/server/assistant-store";
import { readBody, sameOrigin } from "@/lib/server/http";
import { getActor } from "@/lib/server/session";
import { repository } from "@/lib/server/repository";

export const runtime = "nodejs";
const command = z.object({ datasetRevision: z.number().int().positive(), planRevision: z.number().int().nonnegative(), revision: z.number().int().nonnegative(), answers: consultationAnswersSchema }).strict();
export async function POST(request: Request) {
  const actor = await getActor();
  if (!sameOrigin(request) || actor?.accessRole !== "employee" || !actor.employeeId) return new Response("Forbidden", { status: 403 });
  let audit: AssistantStore | undefined;
  try {
    const input = command.parse(await readBody(request));
    // Initializes the same repository tables used by the transactional revision check.
    const snapshot = repository().read();
    if (!snapshot.data.employees.some(e => e.employee_id === actor.employeeId)) return new Response("Forbidden", { status: 403 });
    audit = new AssistantStore();
    const consultation = audit.saveConsultation(actor.employeeId, input.datasetRevision, input.planRevision, input.revision, input.answers);
    return Response.json(consultation, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error && error.message === "Context changed" ? "Context changed" : "Invalid consultation" }, { status: error instanceof Error && error.message === "Context changed" ? 409 : 400 });
  } finally { audit?.close(); }
}
