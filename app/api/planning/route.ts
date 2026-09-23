import { z } from "zod";
import { getActor } from "@/lib/server/session";
import { repository } from "@/lib/server/repository";
import { readBody, sameOrigin } from "@/lib/server/http";
const command = z.object({ datasetRevision: z.number().int().positive(), revision: z.number().int().nonnegative(), plan: z.unknown() });
export async function POST(request: Request) {
  const actor = await getActor();
  if (!sameOrigin(request) || actor?.accessRole !== "employee" || !actor.employeeId) return new Response("Forbidden", { status: 403 });
  try {
    const input = command.parse(await readBody(request));
    return Response.json(repository().savePlanning(actor, actor.employeeId, input.datasetRevision, input.revision, input.plan));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Save failed";
    const invalid = error instanceof z.ZodError || /Unknown target role profile|Edited goals/.test(message);
    const status = message.includes("changed;") ? 409 : invalid ? 400 : message === "Employee not found" ? 404 : message === "Forbidden" ? 403 : 500;
    return Response.json({ error: status === 500 ? "Could not save plan" : message }, { status });
  }
}
