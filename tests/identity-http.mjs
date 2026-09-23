import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { SqliteRepository } from "../lib/server/database.ts";

const directory = mkdtempSync(join(tmpdir(), "identity-http-"));
const database = join(directory, "test.sqlite");
const repo = new SqliteRepository(database);
repo.createSession("legacy-token", "hr", null);
repo.createSession("credentials:credentials-token", "hr", null);
repo.close();
const base = `http://127.0.0.1:${process.env.IDENTITY_SMOKE_PORT ?? "3107"}`;
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", new URL(base).port], {
  env: { ...process.env, DATABASE_PATH: database, COOKIE_SECURE: "false" }, stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
child.stdout.on("data", data => { logs += data; });
child.stderr.on("data", data => { logs += data; });
const request = (path, cookie = "") => fetch(base + path, { redirect: "manual", headers: { Cookie: cookie } });
const login = body => fetch(base + "/api/session", { method: "POST", redirect: "manual", headers: { Origin: base, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) });
try {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(logs);
    try { await request("/"); break; } catch { await delay(100); }
  }
  const page = await (await request("/")).text();
  assert.ok(!page.includes('name="accessToken"'));
  assert.ok(page.includes('name="accessRole"'));
  assert.ok(page.includes('name="employeeId"'));
  assert.equal((await login({})).status, 401);
  assert.equal((await login({ accessRole: "admin" })).status, 401);
  assert.equal((await login({ accessRole: "employee", employeeId: "missing" })).status, 400);
  for (const token of ["legacy-token", "credentials-token"]) assert.equal((await request("/api/employees/E0001", `career_quest_session=${token}`)).status, 403);
  const employeeLogin = await login({ accessRole: "employee", employeeId: "E0001" });
  assert.equal(employeeLogin.status, 303);
  assert.ok(employeeLogin.headers.get("location").endsWith("/employee/dashboard"));
  const cookie = employeeLogin.headers.get("set-cookie").split(";")[0];
  assert.equal((await request("/api/employees/E0001", cookie)).status, 200);
  assert.equal((await request("/api/employees/E0002", cookie)).status, 403);
  assert.equal((await request("/hr/dashboard", cookie)).status, 307);
  const hrLogin = await login({ accessRole: "hr" });
  assert.equal(hrLogin.status, 303);
  const hrCookie = hrLogin.headers.get("set-cookie").split(";")[0];
  assert.equal((await request("/api/employees/E0002", hrCookie)).status, 200);
  const logout = await fetch(base + "/api/session", { method: "POST", redirect: "manual", headers: { Cookie: cookie, Origin: base, "Content-Type": "application/x-www-form-urlencoded" }, body: "logout=true" });
  assert.equal(logout.status, 303);
  assert.equal((await request("/api/employees/E0001", cookie)).status, 403);
  console.log("PASS: token-free account picker, invalid accounts denied, employee/HR scope, legacy/credential cookies denied, logout.");
} finally {
  child.kill();
  await new Promise(resolve => child.exitCode !== null ? resolve() : child.once("exit", resolve));
  rmSync(directory, { recursive: true, force: true });
}
