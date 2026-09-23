# Career Quest · BizAI

Six-route employee development foundation using the supplied synthetic dataset: 200 employees, 40 activities, 60 skills, and 2,743 participation records.

## Run

Node.js **22.13+** is required for built-in SQLite. Run from the repository root:

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). Choose an employee or the HR workspace. For a production build:

```sh
npm run build
npm start
```

No external service or API key is needed. The server loads fixtures from `case_source/case_1/career_quest_dataset/` on its first request and persists them in `.data/career-quest.sqlite`. Keep the supplied dataset directory available locally; no source data is in public assets. Optional settings are in [.env.example](.env.example); copy to `.env.local` when overriding paths. Set `COOKIE_SECURE=true` when serving over HTTPS. Dataset paths resolve relative to the root working directory.

## Implemented

| Route | Behavior |
| --- | --- |
| `/` | Explicit demo account selection |
| `/employee/dashboard` | Current profile, target, effective skills, critical gaps, history |
| `/employee/learning` | Real activity catalog, prerequisites, sessions, eligibility reasons |
| `/hr/dashboard` | Searchable profiles, target-gap prevalence, participation by status |
| `/hr/employees/[id]` | Read-only employee inspection |
| `/hr/data` | Validate/preview/apply jury profiles and history, dataset counts, reset |

Employee access is checked on the server for pages and APIs. SQLite-backed opaque sessions separate `accessRole` from the employee's job role. **The public role picker is demo authentication, not production identity verification.** Anyone with access to the demo can choose HR; use only synthetic data.

Imports accept the original employee JSON envelope and history CSV columns, together or separately. New IDs merge; identical records are unchanged; conflicting duplicates fail. References are validated against the merged dataset. Preview revisions prevent stale writes, and SQLite transactions prevent partial imports. Limits: 2 MB per file in the UI, 5 MB per API request. Reset restores the supplied fixtures and discards imports.

The business date is `meta.as_of_date` (`2026-10-01`). Effective skills replay completed activity after `last_review_date`; a cap never lowers an assessed skill. Historical CSV `date` is a completion-time proxy, including self-paced enrollment dates, because exact completion timestamps are unavailable. Target coverage is capped achieved requirement units / required units, not promotion probability. An absent goal defaults to the next grade; Leads without goals show current-role requirements and an unset-goal notice.

## Validate

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:http
```

The HTTP suite launches a separate server on port 3101 with a temporary database. Override `SMOKE_PORT` if occupied. It checks six pages, all 200 profile API reads, cross-employee/HR denial, cross-origin denial, preview/import/re-import/reset, and retired routes. Unit tests cover replay, goals, CSV parsing, import conflicts, SQLite persistence and stale writes.

## Remaining

AI recommendations, enrollment/completion writes, recommendation invalidation, complete HR missing-step classification, and Docker launch remain phases 4–5. The UI labels recommendations as **Not generated**. No model calls or data transmission to an external AI service are implemented. Production SSO is deferred.

The app uses Next 15.5.26 / React 19.1.9. PostCSS is explicitly overridden to the patched root dependency; retain this until the framework's bundled dependency no longer needs it. See the [official Next.js release/security announcements](https://nextjs.org/blog).

- [Implementation status](docs/implementation-status.md)
- [Repository context](docs/repo-context.md)

## Languages

Use the **ENG / РУС / ҚАЗ** selector on the entry page or workspace header. English is the default. The selected locale (`en`, `ru`, `kk`) persists in a one-year `career_quest_locale` cookie and applies to server pages, interactive controls, document language, dates, and numbers. Switching reloads the current URL, preserving its route, filter query, and section anchor. Unsaved file selections must be selected again after a switch.

The supplied 40 activity titles/descriptions, 60 skill names, roles, departments, grades, and participation labels have Russian and Kazakh translations. IDs, names, JSON/CSV schemas and stored records remain unchanged. New jury free text without a dictionary entry remains verbatim; no external translation service is called. Structured diagnostic details retain their original text beneath localized import error summaries.

Translation entries live in `lib/i18n/messages.json`. Add both `ru` and `kk` entries when introducing new interface text. `npm test` verifies supplied catalog coverage; `npm run test:http` checks all six pages in all three languages, locale fallback, and localized HR search.
