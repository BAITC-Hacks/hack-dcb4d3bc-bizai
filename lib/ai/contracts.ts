import { z } from "zod";
import { grades } from "../career/types";

export const assistantModes = ["coach", "activity", "hr"] as const;
export type AssistantMode = typeof assistantModes[number];
const references = z.array(z.string().max(140)).min(1).max(8);
export const goalDraftSchema = z.object({ wording: z.string().min(1).max(2000), target_role: z.string().max(500).nullable(), target_grade: z.enum(grades).nullable() }).strict();
export const adviceSchema = z.object({
  summary: z.string().min(1).max(1200),
  questions: z.array(z.string().min(1).max(350)).max(2),
  insights: z.array(z.object({ text: z.string().min(1).max(600), evidence_ids: references }).strict()).max(4),
  recommendations: z.array(z.object({ event_id: z.string().max(100), skill_id: z.string().max(100), reason: z.string().min(1).max(600), evidence_ids: z.array(z.string().max(140)).max(8) }).strict()).max(3),
  goal_draft: goalDraftSchema.nullable(),
}).strict();
export type Advice = z.infer<typeof adviceSchema>;
export type Evidence = { id: string; label: string; source: string; value: unknown };
export type AssistantResult = {
  id: string; createdAt: string; message: string; advice: Advice;
  engine: "openai" | "rules"; reason: "timeout" | "unavailable" | "invalid_output" | "not_configured" | "authentication" | null;
  state: "needs_goal" | "needs_input" | "ready" | "explained" | "no_match";
  evidence: Evidence[]; activities: { id: string; title: string }[];
  consultationRevision?: number;
  readiness?: import("./consultation").Readiness;
  datasetRevision: number; planRevision: number; locale: "en" | "ru" | "kk";
  mode: AssistantMode; eventId: string | null; model: string | null; latencyMs: number;
};
