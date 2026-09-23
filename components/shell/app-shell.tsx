import { AdvisorWidget } from "@/components/career/advisor-widget";
import { getI18n } from "@/lib/i18n/server";
import { getActor } from "@/lib/server/session";
import { repository } from "@/lib/server/repository";
import { WorkspaceShell } from "./workspace-shell";

export async function AppShell({ role, children }: { role: "hr" | "employee"; children: React.ReactNode }) {
  const { t } = await getI18n();
  const actor = await getActor();
  const { data } = repository().read();
  const employee = role === "employee" ? data.employees.find(e => e.employee_id === actor?.employeeId) : null;
  return <WorkspaceShell role={role} name={employee?.full_name ?? t("HR workspace")} position={employee ? `${t(employee.grade)} · ${t(employee.role)}` : t("People & development")} date={data.meta.as_of_date}>{children}<AdvisorWidget employeeId={employee?.employee_id ?? null} employees={role === "hr" ? data.employees.map(e => ({ id: e.employee_id, name: e.full_name })) : []}/></WorkspaceShell>;
}
