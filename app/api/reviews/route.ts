import { z } from "zod";
import { reviewItemsSchema, previousQuarter } from "@/lib/career/reviews";
import { repository } from "@/lib/server/repository";
import { getActor } from "@/lib/server/session";
import { readBody, sameOrigin } from "@/lib/server/http";
const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), quarter: z.string(), datasetRevision: z.number().int().positive(), planRevision: z.number().int().nonnegative() }).strict(),
  z.object({ action: z.enum(["save", "submit", "reopen"]), id: z.string().uuid(), revision: z.number().int().positive(), datasetRevision: z.number().int().positive(), items: reviewItemsSchema }).strict(),
]);
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Invalid request";
  return Response.json({ error: message === "Forbidden" ? "Forbidden" : message === "Context changed" ? "Context changed" : "Invalid review request" }, { status: message === "Forbidden" ? 403 : message === "Context changed" ? 409 : 400 });
}
export async function GET(request: Request) {
  const actor = await getActor();
  if (!actor) return new Response("Forbidden", { status: 403 });
  try {
    const id = new URL(request.url).searchParams.get("employeeId") ?? actor.employeeId ?? "";
    const store = repository();
    const reviews = store.reviews(actor, id);
    const snapshot = store.read();
    return Response.json({ reviews, datasetRevision: snapshot.revision, planRevision: actor.employeeId === id ? store.planning(id).revision : null, defaultQuarter: previousQuarter(snapshot.data.meta.as_of_date) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  const actor = await getActor();
  if (!sameOrigin(request) || !actor || actor.accessRole !== "employee") return new Response("Forbidden", { status: 403 });
  try {
    const input = command.parse(await readBody(request));
    const store = repository();
    const review = input.action === "create" ? store.createReview(actor, input.quarter, input.datasetRevision, input.planRevision) : store.updateReview(actor, input.id, input.revision, input.datasetRevision, input.action, input.items);
    return Response.json(review, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
