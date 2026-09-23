import { z } from "zod";

export const activityFormats = ["online", "offline", "self_paced"] as const;
export const consultationAnswersSchema = z.object({
  maxHours: z.number().positive().max(10000).nullable(),
  formats: z.array(z.enum(activityFormats)).max(3).refine(v => new Set(v).size === v.length),
  notes: z.string().trim().max(2000),
}).strict();
export type ConsultationAnswers = z.infer<typeof consultationAnswersSchema>;
export type Consultation = { revision: number; answers: ConsultationAnswers | null };
export const emptyConsultation: Consultation = { revision: 0, answers: null };
export type Readiness = { state: "awaiting_answer" | "ready" | "blocked"; reason: "goal" | "unmapped" | "constraints" | "catalog" | null };
export function consultationReadiness(hasGoal: boolean, hasTarget: boolean, consultation: Consultation, candidateCount: number): Readiness {
  if (!hasGoal) return { state: "awaiting_answer", reason: "goal" };
  if (!hasTarget) return { state: "blocked", reason: "unmapped" };
  if (!consultation.answers) return { state: "awaiting_answer", reason: "constraints" };
  if (!candidateCount) return { state: "blocked", reason: "catalog" };
  return { state: "ready", reason: null };
}
export function constraintReasons(event: { format: string; duration_hours: number }, consultation: Consultation): string[] {
  const answers = consultation.answers;
  if (!answers) return [];
  return [
    ...(answers.maxHours !== null && event.duration_hours > answers.maxHours ? ["consultationDuration"] : []),
    ...(answers.formats.length && !answers.formats.some(f => f === event.format) ? ["consultationFormat"] : []),
  ];
}
