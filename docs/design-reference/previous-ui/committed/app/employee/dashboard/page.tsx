import { redirect } from "next/navigation";
import { requireActor } from "@/lib/server/session";
import { repository } from "@/lib/server/repository";
import { DevelopmentPanel } from "@/components/career/development-panel";
export default async function Page() {
  const actor = await requireActor("employee");
  const { data } = repository().read();
  const employee = data.employees.find(e => e.employee_id === actor.employeeId);
  if (!employee) redirect("/");
  return <DevelopmentPanel employee={employee} data={data}/>;
}
