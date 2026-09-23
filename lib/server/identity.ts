import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";
import type { Actor } from "./access";

export function demoAuthEnabled() { return process.env.AUTH_MODE === "demo"; }
// Changing modes invalidates existing cookies, including sessions issued by older builds.
export function sessionKey(token: string) { return `${demoAuthEnabled() ? "demo" : "credentials"}:${token}`; }
const credentialsSchema = z.array(z.object({
  tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  accessRole: z.enum(["employee", "hr"]),
  employeeId: z.string().min(1).nullable(),
}).strict()).refine(rows => new Set(rows.map(row => row.tokenHash)).size === rows.length)
  .refine(rows => rows.every(row => row.accessRole === "hr" ? row.employeeId === null : row.employeeId !== null));

export function verifyAccessToken(token: unknown): Actor | null {
  // Random 256-bit tokens, not human passwords. Store only their SHA-256 digests.
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return null;
  try {
    const path = process.env.AUTH_CREDENTIALS_FILE ?? ".data/access-tokens.json";
    const credentials = credentialsSchema.parse(JSON.parse(readFileSync(path, "utf8")));
    const digest = createHash("sha256").update(token).digest("hex");
    const entry = credentials.find(row => row.tokenHash === digest);
    return entry ? { accessRole: entry.accessRole, employeeId: entry.employeeId } : null;
  } catch { return null; }
}
