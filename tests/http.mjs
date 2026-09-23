import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const directory = mkdtempSync(join(tmpdir(), "career-http-"));
const port = process.env.SMOKE_PORT ?? "3101";
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", port], {
  env: { ...process.env, DATABASE_PATH: join(directory, "test.sqlite"), COOKIE_SECURE: "false" }, stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
child.stdout.on("data", data => { logs += data; });
child.stderr.on("data", data => { logs += data; });
const timings = [];
async function request(path, options = {}) {
  const start = performance.now();
  const result = await fetch(base + path, { redirect: "manual", ...options });
  timings.push(performance.now() - start);
  return result;
}
async function login(accessRole, employeeId) {
  const result = await request("/api/session", { method: "POST", headers: { Origin: base, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ accessRole, ...(employeeId ? { employeeId } : {}) }) });
  assert.equal(result.status, 303);
  assert.ok(result.headers.get("location").startsWith(base));
  const cookie = result.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/i); assert.match(cookie, /SameSite=strict/i);
  return cookie.split(";")[0];
}
async function post(cookie, body, origin = base) {
  return request("/api/data", { method: "POST", headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(logs);
    try { await fetch(base); break; } catch { await delay(100); }
  }
  assert.equal((await request("/")).status, 200);
  assert.equal((await request("/employee/dashboard")).status, 307);
  assert.equal((await request("/api/employees/E0001")).status, 403);
  const employee = await login("employee", "E0001");
  for (const path of ["/employee/dashboard", "/employee/learning"]) {
    const response = await request(path, { headers: { Cookie: employee } });
    assert.equal(response.status, 200);
    assert.ok(!(await response.text()).includes("Arman Zhaksylykov"), "Another employee leaked into response");
  }
  assert.equal((await request("/api/employees/E0001", { headers: { Cookie: employee } })).status, 200);
  assert.equal((await request("/api/employees/E0002", { headers: { Cookie: employee } })).status, 403);
  for (const path of ["/hr/dashboard", "/hr/data", "/hr/employees/E0002"]) assert.equal((await request(path, { headers: { Cookie: employee } })).status, 307);
  assert.equal((await post(employee, { mode: "reset", revision: 1 })).status, 403);
  const hr = await login("hr");
  for (const path of ["/hr/dashboard", "/hr/employees/E0001", "/hr/data"]) assert.equal((await request(path, { headers: { Cookie: hr } })).status, 200);
  for (const [locale, words] of Object.entries({
    en: ["Your next chapter.", "Career trajectory", "Development activities", "Development overview", "Data &amp; imports"],
    ru: ["Ваш следующий этап.", "Карьерная траектория", "Активности для развития", "Обзор развития", "Данные и импорт"],
    kk: ["Сіздің келесі кезеңіңіз.", "Мансаптық жол", "Дамуға арналған іс-шаралар", "Даму шолуы", "Деректер мен импорт"],
  })) {
    for (const [path, session, expected] of [
      ["/", "", words[0]], ["/employee/dashboard", employee, words[1]],
      ["/employee/learning", employee, words[2]], ["/hr/dashboard", hr, words[3]],
      ["/hr/data", hr, words[4]], ["/hr/employees/E0001", hr, words[1]],
    ]) {
      const response = await request(path, { headers: { Cookie: `${session}; career_quest_locale=${locale}` } });
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.ok(html.includes(`<html lang="${locale}"`), `Wrong document language: ${path}`);
      assert.ok(html.includes(expected), `Missing ${locale} translation on ${path}: ${expected}`);
      if (path === "/employee/learning" && locale === "kk") {
        assert.ok(html.includes("Ақпараттық қауіпсіздік негіздері"));
        assert.ok(html.includes("Дағдылардың өсуі"));
      }
    }
  }
  const fallback = await (await request("/", { headers: { Cookie: "career_quest_locale=invalid" } })).text();
  assert.ok(fallback.includes('<html lang="en"'));
  const translatedSearch = await (await request("/hr/dashboard?q=" + encodeURIComponent("Бэкенд"), { headers: { Cookie: `${hr}; career_quest_locale=ru` } })).text();
  assert.ok(translatedSearch.includes("Marat Yessenov"));
  const dataset = JSON.parse(readFileSync("case_source/case_1/career_quest_dataset/employees.json", "utf8"));
  for (const profile of dataset.employees) {
    const response = await request(`/api/employees/${profile.employee_id}`, { headers: { Cookie: hr } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).employee.employee_id, profile.employee_id);
  }
  const payload = { employees: JSON.stringify({ meta: dataset.meta, employees: [{ ...dataset.employees[0], employee_id: "JURY_TEST", full_name: "Synthetic Jury Profile" }] }) };
  assert.equal((await post(hr, { mode: "preview", ...payload }, "https://other.example")).status, 403);
  const preview = await post(hr, { mode: "preview", ...payload });
  assert.equal(preview.status, 200);
  const counts = await preview.json(); assert.equal(counts.employeesAdded, 1);
  assert.equal((await post(hr, { mode: "apply", revision: counts.revision, ...payload })).status, 200);
  assert.equal((await request("/hr/employees/JURY_TEST", { headers: { Cookie: hr } })).status, 200);
  assert.equal((await post(hr, { mode: "apply", revision: counts.revision, ...payload })).status, 400);
  const duplicate = await (await post(hr, { mode: "preview", ...payload })).json();
  assert.equal(duplicate.employeesAdded, 0); assert.equal(duplicate.employeesUnchanged, 1);
  assert.equal((await post(hr, { mode: "reset", revision: duplicate.revision })).status, 200);
  assert.equal((await request("/api/employees/JURY_TEST", { headers: { Cookie: hr } })).status, 404);
  assert.equal((await request("/employee/assistant", { headers: { Cookie: employee } })).status, 404);
  console.log(`PASS: six pages in three languages, localized HR search, invalid-locale fallback, 200 profile API reads, session scope, cross-origin protection, jury preview/import/re-import/reset, retired route.`);
  timings.sort((a, b) => a - b);
  console.log(`Local HTTP timings: p95 ${timings[Math.floor(timings.length * 0.95)].toFixed(0)} ms; max ${timings.at(-1).toFixed(0)} ms (${timings.length} requests).`);
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  child.kill("SIGTERM");
  await new Promise(resolve => child.exitCode !== null ? resolve() : child.once("exit", resolve));
  rmSync(directory, { recursive: true, force: true });
}
