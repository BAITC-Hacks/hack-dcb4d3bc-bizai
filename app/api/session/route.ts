import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { repository } from "@/lib/server/repository";
import { sessionCookie } from "@/lib/server/session";
import { sameOrigin } from "@/lib/server/http";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const form = await request.formData();
  const accessRole = form.get("accessRole");
  const employeeId = form.get("employeeId");
  const logout = form.get("logout") === "true";
  const store = repository();
  if (!logout && accessRole !== "hr" && accessRole !== "employee") return new Response("Invalid access role", { status: 400 });
  if (!logout && accessRole === "employee" && (typeof employeeId !== "string" || !store.read().data.employees.some(e => e.employee_id === employeeId))) return new Response("Unknown employee", { status: 400 });
  const jar = await cookies();
  const old = jar.get(sessionCookie)?.value;
  if (old) store.deleteSession(old);
  const response = NextResponse.redirect(new URL(logout ? "/" : accessRole === "hr" ? "/hr/dashboard" : "/employee/dashboard", request.headers.get("origin")!), 303);
  if (logout) { response.cookies.delete(sessionCookie); return response; }
  const token = randomBytes(32).toString("hex");
  store.createSession(token, accessRole as "hr" | "employee", accessRole === "employee" ? employeeId as string : null);
  response.cookies.set(sessionCookie, token, { httpOnly: true, sameSite: "strict", secure: process.env.COOKIE_SECURE === "true", path: "/", maxAge: 8 * 60 * 60 });
  return response;
}
