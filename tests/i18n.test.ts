import test from "node:test";
import assert from "node:assert/strict";
import { createI18n, locales, parseLocale } from "../lib/i18n";
import messages from "../lib/i18n/messages.json";
import { loadFixtures } from "../lib/server/database";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { eligibility } from "../lib/career/eligibility";

test("literal UI translation keys have Russian and Kazakh entries", () => {
  const missing = new Set<string>();
  function check(expression: ts.Node) {
    if (ts.isStringLiteral(expression) && !Object.hasOwn(messages, expression.text)) missing.add(expression.text);
    if (ts.isConditionalExpression(expression)) {
      check(expression.whenTrue);
      check(expression.whenFalse);
    }
  }
  function walk(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(path)) {
        const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
        function visit(node: ts.Node) {
          if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "t") node.arguments.forEach(check);
          ts.forEachChild(node, visit);
        }
        visit(source);
      }
    }
  }
  for (const directory of ["app", "components", "lib"]) walk(directory);
  assert.deepEqual([...missing].sort(), [], "Untranslated UI copy");
});

test("dynamic eligibility reasons and milestone states are localized", () => {
  const data = loadFixtures();
  const reasons = new Set(data.employees.flatMap(employee => data.events.flatMap(event => eligibility(employee, event, data))));
  for (const locale of ["ru", "kk"] as const) {
    const { t } = createI18n(locale);
    for (const reason of reasons) assert.notEqual(t(reason), reason, `${locale}: ${reason}`);
  }
  for (const locale of locales) {
    const { t } = createI18n(locale);
    for (const state of ["planned", "in_progress", "evidence_needed", "reached", "blocked", "paused"]) {
      assert.notEqual(t(state), state, `${locale}: ${state}`);
    }
  }
});

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
