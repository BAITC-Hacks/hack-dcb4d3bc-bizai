import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { repository } from "./repository";
import type { Actor } from "./access";

export const sessionCookie = "career_quest_session";
export async function getActor(): Promise<Actor | null> {
  const token = (await cookies()).get(sessionCookie)?.value;
  return token ? repository().session(token) ?? null : null;
}
export async function requireActor(role: "hr" | "employee") {
  const actor = await getActor();
  if (!actor) redirect("/");
  if (actor.accessRole !== role) redirect(actor.accessRole === "hr" ? "/hr/dashboard" : "/employee/dashboard");
  return actor;
}
