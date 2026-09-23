import { createI18n, type Locale } from "../i18n";
import { aiText } from "./copy";
import type { Advice } from "./contracts";
import type { AssistantContext } from "./context";

// The model selects evidence and options. Factual sentences are rendered from source
// values so a valid citation cannot smuggle an invented level, attendance or diagnosis.
export function presentAdvice(advice: Advice, context: AssistantContext, locale: Locale): Advice {
  const { t, formatNumber, formatDate } = createI18n(locale);
  const say = (key: Parameters<typeof aiText>[1]) => aiText(locale, key);
  function factText(id: string): string {
    const fact = context.facts.find(f => f.id === id);
    if (!fact) return "";
    if (id.startsWith("gap:")) {
      const value = fact.value as { assessed: number; level: number; required: number; critical: boolean; assessment_recorded: boolean };
      return `${t(fact.label)}: ${value.assessment_recorded ? `${t("Assessment baseline")} ${formatNumber(value.assessed)}` : say("missingAssessment")}; ${t("Effective level")} ${formatNumber(value.level)}; ${t("Required")} ${formatNumber(value.required)}${value.critical ? ` · ${t("Critical")}` : ""}.`;
    }
    if (id.startsWith("event:")) {
      const value = fact.value as { format: string; duration_hours: number; reasons: string[]; audienceContext?: string };
      return `${t(fact.label)} · ${t(value.format)} · ${formatNumber(value.duration_hours)} ${t("h")}. ${value.reasons.length ? value.reasons.map(reason => reason === "consultationDuration" || reason === "consultationFormat" ? say(reason) : t(reason)).join("; ") : t("Eligible to explore")}. ${value.audienceContext === "target" ? say("targetPolicy") : ""}`;
    }
    if (id.startsWith("history:")) {
      const value = fact.value as { event_id: string; status: string; date: string };
      return `${value.event_id}: ${t(value.status)} · ${formatDate(value.date)}. ${say("historyLimit")}`;
    }
    if (id === "consultation") {
      const answers = context.consultation.answers;
      return answers ? `${say("constraintsTitle")}: ${say("maxHours")} ${answers.maxHours === null ? say("unlimited") : formatNumber(answers.maxHours)}; ${say("formats")} ${answers.formats.length ? answers.formats.map(t).join(", ") : say("anyFormat")}. ${answers.notes ? `${say("notes")}: ${answers.notes}. ` : ""}${say("selfReport")}` : say("constraintsQuestion");
    }
    if (id === "goal") return `${t("Focus goal")}: ${context.focus?.wording ?? say("goalQuestion")}`;
    if (id === "profile") {
      const value = fact.value as { role: string; grade: string };
      return `${say("profile")}: ${t(value.role)} · ${t(value.grade)}.`;
    }
    if (id === "participation") {
      const value = fact.value as { completed: number; no_show: number; dropped: number; declined: number };
      return ["completed", "no_show", "dropped", "declined"].map(status => `${t(status)}: ${formatNumber(value[status as keyof typeof value])}`).join(" · ") + `. ${say("historyLimit")}`;
    }
    if (id.startsWith("milestone:")) return `${t("Outcome")}: ${(fact.value as { outcome: string }).outcome}. ${say("selfReport")}`;
    if (id.startsWith("statement:")) return `${say("statement")}: ${(fact.value as { text: string }).text}. ${say("selfReport")}`;
    return say("assessmentLimit");
  }
  const used = new Set<string>();
  const insights = advice.insights.flatMap(insight => {
    const ids = insight.evidence_ids.filter(id => !used.has(id));
    ids.forEach(id => used.add(id));
    return ids.length ? [{ text: ids.map(factText).filter(Boolean).join("\n"), evidence_ids: ids }] : [];
  });
  // Activity explanations always expose the selected activity, even if the model omits it.
  if (context.eventId && !used.has(`event:${context.eventId}`)) insights.unshift({ text: factText(`event:${context.eventId}`), evidence_ids: [`event:${context.eventId}`] });
  return {
    ...advice,
    questions: !context.focus && !advice.goal_draft && !advice.questions.length ? [say("goalQuestion")] : context.mode !== "hr" && context.readiness.reason === "constraints" ? [say("constraintsQuestion"), ...advice.questions.filter(q => q !== say("constraintsQuestion"))].slice(0, 2) : advice.questions,
    summary: say(!context.focus ? "goalIntro" : context.mode === "hr" ? "hrIntro" : "factsIntro"),
    insights,
    recommendations: advice.recommendations.map(item => {
      const candidate = context.candidates.find(c => c.event_id === item.event_id)!;
      const changes = candidate.contributions.map(change => {
        const name = context.facts.find(f => f.id === `gap:${change.skill_id}`)?.label ?? change.skill_id;
        return `${t(name)} ${formatNumber(change.before)} → ${formatNumber(change.after)} / ${t("Required")} ${formatNumber(change.required)}${change.critical ? ` · ${t("Critical")}` : ""}`;
      });
      return { ...item, reason: `${say("prospective")}: ${changes.join("; ")}. ${t(candidate.format)} · ${formatNumber(candidate.duration_hours)} ${t("h")}. ${say("assessmentLimit")}${candidate.audienceContext === "target" ? ` ${say("targetPolicy")}` : ""}` };
    }),
  };
}
