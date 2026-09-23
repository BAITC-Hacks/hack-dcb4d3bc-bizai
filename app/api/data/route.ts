import { z } from "zod";
import { mergeImport } from "@/lib/career/import";
import { repository } from "@/lib/server/repository";
import { getActor } from "@/lib/server/session";
import { isHr } from "@/lib/server/access";
import { readBody, sameOrigin } from "@/lib/server/http";

const schema = z.object({ mode: z.enum(["preview", "apply", "reset"]), employees: z.string().optional(), history: z.string().optional(), revision: z.number().int().positive().optional() });
export async function POST(request: Request) {
  if (!sameOrigin(request) || !isHr(await getActor())) return new Response("Forbidden", { status: 403 });
  try {
    const input = schema.parse(await readBody(request));
    const store = repository();
    if (input.mode === "preview") {
      const snapshot = store.read();
      const result = mergeImport(snapshot.data, input);
      return Response.json({ revision: snapshot.revision, ...result.summary });
    }
    if (!input.revision) throw new Error("Preview the current dataset before applying");
    return Response.json(input.mode === "reset" ? store.reset(input.revision) : store.import(input, input.revision));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Import failed" }, { status: 400 });
  }
}
