import { z } from "zod";
import { getActor } from "@/lib/server/session";
import { repository } from "@/lib/server/repository";
import { readBody, sameOrigin } from "@/lib/server/http";
const command = z.object({ eventId: z.string().min(1).max(100), datasetRevision: z.number().int().positive(), planRevision: z.number().int().nonnegative() });
export async function POST(request: Request) {
  const actor = await getActor();
  if (!sameOrigin(request) || actor?.accessRole !== "employee" || !actor.employeeId) return new Response("Forbidden", { status: 403 });
  try {
    const input = command.parse(await readBody(request));
    return Response.json(repository().completeActivity(actor, input.eventId, input.datasetRevision, input.planRevision));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Completion failed";
    const status = message.startsWith("Context changed") ? 409 : error instanceof z.ZodError || message.includes("not eligible") || message.includes("not found") ? 400 : 500;
    return Response.json({ error: status === 500 ? "Completion failed" : message }, { status });
  }
}
