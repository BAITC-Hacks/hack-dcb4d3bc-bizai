import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { SqliteRepository } from "../lib/server/database.ts";

const directory = mkdtempSync(join(tmpdir(), "identity-http-"));
const database = join(directory, "test.sqlite");
const credentials = join(directory, "credentials.json");
const employeeToken = randomBytes(32).toString("hex");
const hrToken = randomBytes(32).toString("hex");
writeFileSync(credentials, JSON.stringify([
  { tokenHash: createHash("sha256").update(employeeToken).digest("hex"), accessRole: "employee", employeeId: "E0001" },
  { tokenHash: createHash("sha256").update(hrToken).digest("hex"), accessRole: "hr", employeeId: null },
]));
const repo = new SqliteRepository(database);
repo.createSession("legacy-token", "hr", null);
repo.createSession("demo:demo-token", "hr", null);
repo.close();
const base = `http://127.0.0.1:${process.env.IDENTITY_SMOKE_PORT ?? "3107"}`;
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", new URL(base).port], {
  env: { ...process.env, AUTH_MODE: "credentials", AUTH_CREDENTIALS_FILE: credentials, DATABASE_PATH: database, COOKIE_SECURE: "false" }, stdio: ["ignore", "pipe", "pipe"],
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
  assert.ok(page.includes('name="accessToken"'));
  assert.ok(!page.includes('name="accessRole"'));
  assert.ok(!page.includes("Marat Yessenov"));
  assert.equal((await login({ accessRole: "hr" })).status, 401);
  assert.equal((await login({ accessRole: "employee", employeeId: "E0001" })).status, 401);
  assert.equal((await login({ accessToken: randomBytes(32).toString("hex") })).status, 401);
  for (const token of ["legacy-token", "demo-token"]) assert.equal((await request("/api/employees/E0001", `career_quest_session=${token}`)).status, 403);
  // Caller-supplied identity fields cannot override the account associated with a token.
  const employeeLogin = await login({ accessToken: employeeToken, accessRole: "hr", employeeId: "E0002" });
  assert.equal(employeeLogin.status, 303);
  assert.ok(employeeLogin.headers.get("location").endsWith("/employee/dashboard"));
  const cookie = employeeLogin.headers.get("set-cookie").split(";")[0];
  assert.equal((await request("/api/employees/E0001", cookie)).status, 200);
  assert.equal((await request("/api/employees/E0002", cookie)).status, 403);
  assert.equal((await request("/hr/dashboard", cookie)).status, 307);
  const hrLogin = await login({ accessToken: hrToken });
  assert.equal(hrLogin.status, 303);
  const hrCookie = hrLogin.headers.get("set-cookie").split(";")[0];
  assert.equal((await request("/api/employees/E0002", hrCookie)).status, 200);
  const logout = await fetch(base + "/api/session", { method: "POST", redirect: "manual", headers: { Cookie: cookie, Origin: base, "Content-Type": "application/x-www-form-urlencoded" }, body: "logout=true" });
  assert.equal(logout.status, 303);
  assert.equal((await request("/api/employees/E0001", cookie)).status, 403);
  console.log("PASS: secure login, no public employee list, forged roles denied, employee/HR scope, legacy/demo cookies denied, logout.");
} finally {
  child.kill();
  await new Promise(resolve => child.exitCode !== null ? resolve() : child.once("exit", resolve));
  rmSync(directory, { recursive: true, force: true });
}
