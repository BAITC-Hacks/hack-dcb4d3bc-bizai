import test from "node:test";
import assert from "node:assert/strict";
import { createI18n, locales, parseLocale } from "../lib/i18n";
import messages from "../lib/i18n/messages.json";
import { loadFixtures } from "../lib/server/database";

test("only supported locales are accepted, with English as default", () => {
  for (const locale of locales) assert.equal(parseLocale(locale), locale);
  for (const invalid of [undefined, "kz", "de", "<script>", "RU"]) assert.equal(parseLocale(invalid), "en");
});

test("Russian and Kazakh cover the full supplied visible catalog", () => {
  const data = loadFixtures();
  const catalog = messages as Record<string, { ru: string; kk: string }>;
  const labels = [...data.events.flatMap(e => [e.title, e.description, e.type, e.format]), ...data.skills.map(s => s.name), ...data.employees.flatMap(e => [e.role, e.grade, e.department]), ...data.history.map(row => row.status)];
  for (const label of labels) for (const locale of ["ru", "kk"] as const) assert.ok(catalog[label]?.[locale], `${locale} is missing ${label}`);
  for (const [key, value] of Object.entries(messages)) {
    assert.ok(value.ru.trim(), `Empty Russian translation: ${key}`);
    assert.ok(value.kk.trim(), `Empty Kazakh translation: ${key}`);
  }
});

test("unknown jury text and identifiers remain verbatim; domain data is not translated in place", () => {
  const data = loadFixtures();
  const before = JSON.stringify(data);
  for (const locale of locales) {
    const { t } = createI18n(locale);
    assert.equal(t("E0001"), "E0001");
    assert.equal(t("An unseen jury role"), "An unseen jury role");
    assert.equal(t(data.employees[0].full_name), data.employees[0].full_name);
    for (const event of data.events) t(event.title);
  }
  assert.equal(JSON.stringify(data), before);
});

test("date-only values retain their business date and numbers use the locale", () => {
  assert.equal(createI18n("en").formatDate("2026-10-01"), "1 Oct 2026");
  assert.match(createI18n("ru").formatDate("2026-10-01"), /1 окт/);
  assert.equal(createI18n("kk").formatDate("2026-10-01"), "1 қаз. 2026 ж.");
  assert.equal(createI18n("ru").formatNumber(1.5, 1), "1,5");
  assert.equal(createI18n("en").formatNumber(1.5, 1), "1.5");
});
