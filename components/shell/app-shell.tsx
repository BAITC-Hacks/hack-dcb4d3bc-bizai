import { getActor } from "@/lib/server/session";
import { repository } from "@/lib/server/repository";
import { WorkspaceShell } from "./workspace-shell";

export async function AppShell({ role, children }: { role: "hr" | "employee"; children: React.ReactNode }) {
  const actor = await getActor();
  const { data } = repository().read();
  const employee = role === "employee" ? data.employees.find(e => e.employee_id === actor?.employeeId) : null;
  return <WorkspaceShell role={role} name={employee?.full_name ?? "HR workspace"} position={employee ? `${employee.grade} ${employee.role}` : "People & development"} date={data.meta.as_of_date}>{children}</WorkspaceShell>;
}
