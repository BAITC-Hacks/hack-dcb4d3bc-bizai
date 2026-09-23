import messages from "./messages.json";

export const locales = ["en", "ru", "kk"] as const;
export type Locale = typeof locales[number];
export const localeCookie = "career_quest_locale";
export function parseLocale(value: unknown): Locale {
  return locales.includes(value as Locale) ? value as Locale : "en";
}
const dictionary: Record<string, { ru: string; kk: string }> = messages;
const englishLabels: Record<string, string> = { completed: "Completed", in_progress: "In progress", no_show: "No show", dropped: "Dropped", declined: "Declined", overdue: "Overdue", self_paced: "Self-paced", online: "Online", offline: "In person", course: "Course", workshop: "Workshop", mentoring: "Mentoring", certification: "Certification", meetup: "Meetup", compliance: "Compliance", onboarding: "Onboarding" };
const intlLocale = { en: "en-GB", ru: "ru-RU", kk: "kk-KZ" };
export function createI18n(locale: Locale) {
  return {
    locale,
    // Unknown imported free text stays verbatim; translations never mutate domain values.
    t(text: string | undefined): string {
      if (!text) return "";
      return locale === "en" ? englishLabels[text] ?? text : dictionary[text]?.[locale] ?? text;
    },
    formatDate(value: string) {
      // Some ICU builds expose kk-KZ but render placeholder month names such as M10.
      if (locale === "kk") {
        const [year, month, day] = value.split("-").map(Number);
        const months = ["қаң.", "ақп.", "нау.", "сәу.", "мам.", "мау.", "шіл.", "там.", "қыр.", "қаз.", "қар.", "жел."];
        return `${day} ${months[month - 1]} ${year} ж.`;
      }
      return new Intl.DateTimeFormat(intlLocale[locale], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
    },
    formatNumber(value: number, decimals?: number) {
      return new Intl.NumberFormat(intlLocale[locale], decimals === undefined ? {} : { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
    },
  };
}
export type I18n = ReturnType<typeof createI18n>;
