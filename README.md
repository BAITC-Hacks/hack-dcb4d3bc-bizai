# Career Quest · BizAI

Employee development prototype using the supplied synthetic dataset: 200 employees, 40 activities, 60 skills, and 2,743 participation records.

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

The app runs without an external service; live AI assistance needs `OPENAI_API_KEY` in `.env` or `.env.local`. The server loads fixtures from `case_source/case_1/career_quest_dataset/` on its first request and persists them in `.data/career-quest.sqlite`. Keep the supplied dataset directory available locally; no source data is in public assets. Optional settings are in [.env.example](.env.example); copy to `.env.local` when overriding paths. Set `COOKIE_SECURE=true` when serving over HTTPS. Dataset paths resolve relative to the root working directory.

## Docker

Build from the repository root and run with a persistent SQLite volume:

```sh
docker build -t career-quest:local .
docker volume create career-quest-data
docker run -d --name career-quest \
  --restart unless-stopped \
  -p 3000:3000 \
  --mount type=volume,source=career-quest-data,target=/app/.data \
  career-quest:local
```

Run the existing type, lint, unit, and HTTP checks inside the build environment:

```sh
docker build --target test -t career-quest:test .
```

Open `http://localhost:3000`. The image uses Node 22, Next.js standalone output,
and the non-root `node` user (UID/GID 1000). Runtime fixtures are included in the
image; `.env` files, local databases, and Git metadata are excluded. The HTTP
health check requests the entry page, including a database read.

The entire `/app/.data` directory must remain writable and persistent, including
SQLite WAL files. For bind mounts or Kubernetes PVCs, give UID/GID 1000 write
access (for example, Kubernetes `fsGroup: 1000`). Run one application replica
with its own SQLite volume; PostgreSQL and MinIO are not integrated in this
version. Do not mount the PostgreSQL or MinIO data directories into this app.
For Kubernetes, use `Recreate` deployment strategy when attaching this single
SQLite volume, and configure HTTP probes on port 3000.

Runtime settings can be passed with `docker run -e KEY=value` or an env file:

| Variable | Container default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP listen port; update the port mapping if changed |
| `HOSTNAME` | `0.0.0.0` | Listen on container interfaces |
| `DATABASE_PATH` | `/app/.data/career-quest.sqlite` | Persistent SQLite file |
| `DATASET_DIR` | `/app/case_source/case_1/career_quest_dataset` | Seed/reset fixtures |
| `COOKIE_SECURE` | `false` | Set `true` when the external URL uses HTTPS |

If building on an Apple Silicon Mac for an AMD64 server, use
`docker buildx build --platform linux/amd64 --load -t career-quest:local .`.
The container retains the demo account picker described below; containerization
does not add production identity verification.

## Implemented

| Route | Behavior |
| --- | --- |
| `/` | Explicit demo account selection |
| `/employee/dashboard` | Persistent goals and milestones, assessment modules, effective skills, history, AI development assistant |
| `/employee/reviews` | Quarterly self-assessment drafts/submissions, preserved revisions, scoped direct-report inspection |
| `/employee/learning` | Real activity catalog, prerequisites, sessions, eligibility reasons, AI activity explanations |
| `/hr/dashboard` | Searchable profiles, target-gap prevalence, participation by status |
| `/hr/employees/[id]` | Read-only employee inspection and AI development discussion briefs |
| `/hr/data` | Validate/preview/apply jury profiles and history, dataset counts, reset |

Employee access is checked on the server for pages and APIs. SQLite-backed opaque sessions separate `accessRole` from the employee's job role. **The public role picker is demo authentication, not production identity verification.** Anyone with access to the demo can choose HR; use only synthetic data.

Imports accept the original employee JSON envelope and history CSV columns, together or separately. New IDs merge; identical records are unchanged; conflicting duplicates fail. References are validated against the merged dataset. Preview revisions prevent stale writes, and SQLite transactions prevent partial imports. Limits: 2 MB per file in the UI, 5 MB per API request. Reset restores the supplied fixtures and discards imports, personal plans and their action records. Review revisions remain stored under an inactive dataset scope and are not exposed as current reviews after reset.

The business date is `meta.as_of_date` (`2026-10-01`). Effective skills replay completed activity after `last_review_date`; a cap never lowers an assessed skill. Historical CSV `date` is a completion-time proxy, including self-paced enrollment dates, because exact completion timestamps are unavailable. Formal module coverage counts requirements met by the imported assessment baseline / all requirements. This explicitly accepts source assessments as the initial prototype evidence; it does not fabricate a manager approval. Course gains can indicate reassessment is needed but cannot close a module. Missing goals remain unset, with a question; no next grade is inferred.

Employees can save multiple free-form goals, select a focus and optionally map it to a supplied role/grade. Milestones have an outcome, success criterion, actions, evidence and editable state/order. They are employee claims, not skill gains. Plans live separately in SQLite; each save checks dataset and plan revisions and atomically records the actor and before/after state. HR can inspect plans but cannot overwrite them. `POST /api/planning` is employee-only; `GET /api/employees/[id]` now includes the scoped planning state. Its `development.target` and `development.coverage` are nullable when no role target exists, and `coverage` now means closed-module percentage.

Quarterly reviews use the saved role-linked focus and default to the last completed quarter on the dataset clock. Every required target skill needs a 0–5 self-rating and a nonblank business justification before submission. Submitted requirements and evidence are frozen; reopening creates an editable revision. Managers enter through their normal employee account and see only direct reports on the review page. HR inspection is read-only. Submissions are explicitly awaiting calibration; they do not update skills, close modules or promote. Proficiency descriptions are preserved from `skills.json` in newly loaded datasets. Older stored datasets without that field show a missing-scale notice rather than invented descriptions.

## Validate

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:http
npm run test:ai
npm run test:reviews
```

The HTTP suite launches a separate server on port 3101 with a temporary database. Override `SMOKE_PORT` if occupied. It checks six pages, all 200 profile API reads, cross-employee/HR denial, cross-origin denial, preview/import/re-import/reset, and retired routes. Unit tests cover replay, goals, CSV parsing, import conflicts, SQLite persistence and stale writes. The review HTTP suite uses port 3105 (`REVIEW_SMOKE_PORT` override) and checks the new review page in all three languages, manager scope, required justifications, immutable submissions, retries and reset isolation.

## Remaining

The next slice is justified quarterly self-assessment → advisory calibration → manager approval/return → grade modules. Review drafts/submissions and read-only direct-manager access are implemented. AI calibration, manager approval/return, approved per-skill assessment cutoffs, arbitrary natural-language constraint handling and a unified action timeline remain. Demo completion writes are implemented separately. HR tasks/resources, full dataset replacement and one-command packaging follow. The original recommendation path stays usable without requiring a new quarterly review. Production SSO is deferred.

AI assistance now runs on demand from the development page, catalog and HR employee view. The server sends scoped evidence to OpenAI, validates returned choices and citations, and saves conversations and evidence in SQLite. Goal drafts require explicit employee adoption. `OPENAI_MODEL` defaults to `gpt-4.1-mini`; requests have an 8.5-second provider budget and a visible fallback. The key stays server-side. See [AI features and boundaries](docs/ai-assistance.md).

The app uses Next 15.5.26 / React 19.1.9. PostCSS is explicitly overridden to the patched root dependency; retain this until the framework's bundled dependency no longer needs it. See the [official Next.js release/security announcements](https://nextjs.org/blog).

- [Implementation status](docs/implementation-status.md)
- [Repository context](docs/repo-context.md)
- [Current delivery plan](docs/next-stage-plan.md)
- [Quarterly review findings and requirements](docs/quarterly-review-requirements.md)
- [Product memo for the team — Russian](docs/product-memo.ru.md)
- [AI integration and future entry points](docs/ai-assistance.md)

## Languages

Use the **ENG / РУС / ҚАЗ** selector on the entry page or workspace header. English is the default. The selected locale (`en`, `ru`, `kk`) persists in a one-year `career_quest_locale` cookie and applies to server pages, interactive controls, document language, dates, and numbers. Switching reloads the current URL, preserving its route, filter query, and section anchor. Save plan edits before switching; unsaved edits and file selections are lost on reload.

The supplied 40 activity titles/descriptions, 60 skill names, roles, departments, grades, and participation labels have Russian and Kazakh translations. IDs, names, JSON/CSV schemas and stored records remain unchanged. New jury free text without a dictionary entry remains verbatim; no external translation service is called. Structured diagnostic details retain their original text beneath localized import error summaries.

Translation entries live in `lib/i18n/messages.json`. Add both `ru` and `kk` entries when introducing new interface text. `npm test` verifies supplied catalog coverage; `npm run test:http` checks all six pages in all three languages, locale fallback, and localized HR search.
