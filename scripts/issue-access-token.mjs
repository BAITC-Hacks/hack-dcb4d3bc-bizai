import { randomBytes, createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const [accessRole, employeeId] = process.argv.slice(2);
if (!["hr", "employee"].includes(accessRole) || (accessRole === "employee" ? !employeeId : !!employeeId)) {
  throw new Error("Usage: node scripts/issue-access-token.mjs employee E0001 | hr");
}
const path = process.env.AUTH_CREDENTIALS_FILE ?? ".data/access-tokens.json";
let records = [];
try { records = JSON.parse(readFileSync(path, "utf8")); }
catch (error) { if (error.code !== "ENOENT") throw error; }
if (!Array.isArray(records)) throw new Error("Credential file must contain an array");
const token = randomBytes(32).toString("hex");
records.push({ tokenHash: createHash("sha256").update(token).digest("hex"), accessRole, employeeId: employeeId ?? null });
mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, JSON.stringify(records, null, 2) + "\n", { mode: 0o600 });
console.log(`Access token for ${employeeId ?? "HR"} (shown once):\n${token}`);
