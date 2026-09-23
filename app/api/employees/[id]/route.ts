import { focusTarget } from "@/lib/career/planning";
import { getActor } from "@/lib/server/session";
import { canReadEmployee } from "@/lib/server/access";
import { repository } from "@/lib/server/repository";
import { development } from "@/lib/career/skills";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!canReadEmployee(await getActor(), id)) return new Response("Forbidden", { status: 403 });
  const { data } = repository().read();
  const employee = data.employees.find(e => e.employee_id === id);
  if (!employee) return new Response("Not found", { status: 404 });
  return Response.json({ employee, planning: repository().planning(id), development: development({ ...employee, career_goal: focusTarget(repository().planning(id).plan) }, data), history: data.history.filter(row => row.employee_id === id) }, { headers: { "Cache-Control": "private, no-store" } });
}
