export type Actor = { accessRole: "employee" | "hr"; employeeId: string | null };
export function canReadEmployee(actor: Actor | null, employeeId: string) {
  return !!actor && (actor.accessRole === "hr" || actor.employeeId === employeeId);
}
export function isHr(actor: Actor | null) { return actor?.accessRole === "hr"; }
