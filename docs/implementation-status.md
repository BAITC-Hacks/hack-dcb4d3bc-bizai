# Implementation status — 2026-09-23

**Delivery update:** persistent goals/milestones and assessment-based module counts are implemented. An on-demand AI assistant now supports employee goals, activity explanations and HR development briefs, with source-rendered factual statements and explicit goal adoption. Quarterly reviews, manager capabilities and the full consultation constraint/state machine remain pending. Details and validation are at the end of this document.

The subsequent [quarterly review extension](quarterly-review-requirements.md) adds justified self-assessments, advisory calibration, scoped manager approval and formal grade modules. Approval updates reviewed skills only; insufficient evidence is an allowed verdict; module closure does not change the recorded grade. These workflows are also not implemented.

The first slice (the six-route foundation from phases 1–3) now lives at the repository root, committed as `3d34cb4`; UI/localization followed in `8a04d07`. The original nested checkout was initially retained as a local reference and is now absent from the workspace. It is not an application dependency, submodule, or import target. Future staging must use explicit root application/documentation paths, never `git add .` or `git add -A`.

## Delivered

- Reused the starter's button/card/badge/input primitives and palette, with Career Quest branding. The active app contains none of the old onboarding routes, browser store, Buddy, Python module, media, flowchart, chat/RAG, or sentiment logic.
- Six pages, three API handlers, server-only repository access, opaque SQLite sessions, and server role/employee scope checks.
- Original data contracts with calendar/range/reference validation, CSV parsing, nullable blank cells, atomic merge imports, duplicate conflict handling and stale-preview protection.
- Effective skill replay, explicit/cross-role/default targets, critical gaps, activity eligibility and real HR participation/gap aggregates.
- SQLite single-instance persistence via Node's built-in driver. A transaction locks before reading the revision; two writers cannot both apply the same preview.
- Native Node test suite plus an isolated HTTP integration suite. Root TypeScript/Tailwind/lint inputs are positive allowlists, so local reference code is outside the active build without naming it in exclusion rules.

## Decisions and limits

- The original checkout was not installed or built. Its baseline was inspected only; validation applies to the new root app.
- No production auth: the openly selectable demo accounts intentionally permit HR selection. Server scoping prevents reading another employee under an employee session, but does not establish a person's identity.
- Historical completion timestamps remain unavailable. The documented CSV date proxy applies only to historical replay; future completion writes must record their own timestamps.
- Voluntary non-repeatable duplicate completions are rejected. Mandatory annual compliance repetitions in the supplied history are preserved. Club `EV_036` remains repeatable.
- Conflicting employee updates require a later explicit replacement workflow; the current importer rejects conflicts and accepts new or identical rows.
- Completion writes, quarterly calibration/approval, Docker packaging and production SSO remain pending. On-demand AI assistance is available; see [AI features and boundaries](ai-assistance.md).
- SQLite stores a validated dataset snapshot as JSON for this small dataset. A normalized repository adapter can replace it without moving business logic into the browser.

## Next slice

Follow [the current delivery plan](next-stage-plan.md): establish assessment/goal/plan state and manager access; implement bounded calibration and consultation; prove approval/return, per-skill replay, module status and the next development step. Keep the original unseen-profile recommendation/completion path usable. HR-authored tasks and sourced resources, full replacement imports and one-command packaging follow.

## Foundation verification (historical run)

- `npm run typecheck`, `npm run lint`, `npm run build`: pass.
- `npm test`: 8 tests pass.
- `npm run test:http`: 225 requests pass; local HTTP p95 6 ms, maximum 27 ms. These are local response measurements, not browser interaction latency or deployment benchmarks.
- Dependency installation audit: zero known vulnerabilities after updating CSV parsing and applying the PostCSS override.
- Nested reference checkout: unchanged; outer index: no staged changes.

These results belong to the foundation run; the localization run is recorded below. The current requirements/documentation review did not rerun application tests or certify new review workflows.

## UI restoration

The user requested retaining substantially more of the starter's look and layout. Restored its split landing/role-selector composition, patterned background, full-height grouped sidebar, account header, navy dashboard hero, grade rail, two-column cards, SVG donut, HR KPI cards and gap bars, and tabbed activity-card catalog. Navigation labels and contents use Career Quest; career/HR section shortcuts stay within the six routes. Mobile navigation is collapsible. That restoration did not modify the original checkout.

Activity cards now use a compact tabletop-inspired frame: title/type band, duration badge, skill effects with caps, prerequisite chips, sessions, and eligibility footer. All details remain visible; no expansion control or reward/game logic was added.

## Trilingual interface

English, Russian, and Kazakh are available from a persistent header selector on the landing page and every workspace. Shared translation helpers drive server-rendered pages and client controls; the document language, UTC date-only formatting, and numeric formatting follow the selected locale. All supplied activity titles/descriptions, skills, job roles, departments, grades and statuses are translated. The domain dataset and import/API field values stay untouched. Unknown jury text and raw diagnostic detail remain verbatim.

Verification: 12 domain/localization tests pass; all six routes pass in each language through the HTTP suite (245 requests, including existing access/import checks). Browser verification covers language switching and persistence across navigation.

### Interactive development map

Restored the KMG-style React Flow presentation in the shared development panel (employee dashboard and HR profile). Scoped effective skills branch from the current profile toward target requirements; green means met and amber means a gap. The map now uses a responsive grouped layout: critical gaps, other gaps, and met requirements. All skills stay visible, with a wider two-column development branch on desktop and stacked groups on mobile; pagination and canvas controls were removed. Critical badges and EN/RU/KK text use the current data and locale. The graph represents requirements, not task dependencies or a promotion decision. Original reference checkout remains untouched.

Potential follow-ups from the reference: learning timeline/session calendar, mentoring milestones, guided tour, and course player (requires lesson/quiz content and completion persistence).

## Slice 1a — personal planning and assessment-module semantics

Implemented employee-owned planning through `/api/planning`, with HR read-only inspection. Multiple goals preserve imported versus employee origin; free-form goals need no role mapping. Milestones store outcomes, criteria, actions, evidence and state; employees can edit, reorder, pause or remove them. Saves check dataset/state revisions under a SQLite write transaction and append attributed before/after action records. Raw imported assessments, employment and history are unchanged. Fixture reset also clears personal planning state and its log.

Missing goals no longer imply next grade. The API returns a null target and null coverage without a role mapping. HR gap aggregates use the actual focused target. Formal modules use an explicit initial acceptance policy: imported assessment levels are source-labeled baseline evidence, not invented manager decisions. Effective gains remain separate; reaching a threshold through learning shows reassessment needed. Coverage is closed required modules / all required modules. Unknown/free-form targets retain their plan and skill evidence without invented requirements or advice.

This is **not completion of slice 1**: review/evidence contracts, manager permissions, per-skill approved overlays, structured milestone dependencies, full consultation readiness and four-track mapping remain. That planning slice did not implement calibration, approval, recommendations, activity completion, HR suggestions or full replacement. AI assistance was added subsequently, as described below. Action records are stored but a unified user-facing change timeline is pending.

Verification on the integrated implementation: typecheck, lint and production build pass; 15 domain/localization/planning tests pass. Isolated HTTP suite passes 251 requests, including plan ownership, origin rejection, stale revision, persistence readback and null-target behavior plus existing import/access/localization checks. Browser inspection verified the Russian HR plan view and disabled editing. No live AI calls were made.

## AI assistance — employee, catalog and HR

Added a shared assistant on the employee development page, in the catalog and on HR employee profiles. OpenAI receives an authorized, bounded evidence bundle and returns a strict result. The model selects relevant evidence/activities and drafts questions and goal proposals. Code renders the published factual sentences, levels and prospective gains from source records, preventing unsupported free-text assertions about competence or past gain effects.

Missing goals trigger clarification. Role-linked recommendations must name an eligible activity and a skill it can actually improve; source links are attached from those validated IDs. Goal drafts are applied only after employee adoption through the existing planning command. HR briefs are advisory and cannot change a person's plan or ratings. Conversations/evidence are persisted in the same SQLite database with actor scope and dataset/plan revisions. Changed context rejects an in-flight response; repeated completed request IDs are idempotent.

The API key stays server-side. Provider calls use the Responses API, `store: false`, an 8.5-second maximum budget, and explicit fallback states. No provider call occurs on page load. New assistant labels support EN/RU/KK, and explanations respect an explicitly selected locale or the employee's preference. See [the AI implementation map](ai-assistance.md) for deferred calibration, task-authoring and import-assistance opportunities.

Live synthetic-fixture checks succeeded after the local key was replaced: goal clarification in about 3.5 seconds, English recommendations in 3.3 seconds, Russian HR briefs in 5.2 seconds, and Kazakh activity explanations in 4.9 seconds. Earlier responses exposed citation and historical-gain errors; those findings led to validated event/skill binding and deterministic publication of factual statements. These sampled timings are not a latency or model-quality guarantee.

Browser verification completed the Russian goal draft → explicit adoption → updated plan → grounded recommendation flow against a separate fixture database. The draft took 2.7 seconds and recommendations 5.6 seconds; the page showed actual prospective skill changes and the source drawer. Unit/integration checks cover the fallback and guardrails separately from model quality.

Final integrated verification: 23 unit tests and 23 assistant HTTP checks pass; the existing application suite passes all 251 requests. Type checking, lint and the production build pass. The assistant HTTP suite disables the provider and uses a temporary database. A scan of 35 built browser JavaScript bundles found no occurrence of the configured API key.

## Consultation readiness — confirmed constraints

Added a minimal persisted consultation gate before recommendations. Employees explicitly confirm a maximum total duration per activity and acceptable formats; blank duration and no selected formats mean unrestricted only after confirmation. Optional notes retain employee attribution and do not become verified assessment evidence. The server filters the full catalog before shortlisting and rejects recommendations until a goal, supported target, confirmed choices and useful eligible candidates exist. An unmapped goal or empty result has a visible limitation.

Consultation edits append actor/timestamp revisions in the same SQLite database. Identical retries are idempotent; stale writes and in-flight advice are rejected. Current chat history, goal-draft adoption and HR recommendation status honor consultation revisions. Plan/dataset changes require reconfirmation; old revisions remain auditable. EN/RU/KK controls expose the two hard constraints and optional notes. Arbitrary natural-language conditions still depend on clarification and are not implemented as deterministic filters.

Verification for this slice: 28 unit tests, 38 assistant HTTP checks and 256 application HTTP requests pass. Production build, lint/type checks and whitespace checks pass. HTTP checks run against temporary databases with the provider disabled. This slice did not rerun live model or interactive browser checks; earlier live timings describe the previous assistant version.

## Quarterly review foundation — records and manager inspection

Added `/employee/reviews` with draft creation, partial saves, strict submission and employee-initiated reopening. The employee's saved role-linked focus supplies the required skill set; a completed quarter defaults from the dataset business clock. All required skills need a 0–5 integer self-rating and nonblank business justification before submission. Requirements and scale descriptions are frozen at creation. Submission captures the subject's relevant history, activity rules, baseline assessments and demo completions with dataset/date metadata. Evidence is not restricted to the quarter and must not be interpreted as period-specific proof without its dates.

Every change appends a version and actor/timestamp; retries are idempotent and stale edits fail. Reopening preserves the original submitted record. A review-specific dataset scope survives normal dataset revision increments but rotates on demo reset, leaving old rows inaccessible through current review reads. Managers use their employee identity and current `manager_id` relationships for direct-report read access only; HR can inspect reviews in employee profiles. Neither can edit employee self-ratings. An absent manager is surfaced without assigning one. The source `proficiency_scale` now survives dataset parsing; older persisted snapshots without it display a missing-scale notice.

This delivers the record/access foundation, not calibration or approval. Submissions remain visibly awaiting calibration. No skill baseline, cutoff, module or grade changes. Assigned-reviewer overrides, manager return/approval and reviewed-skill overlays remain next.

Verification: 32 unit tests, 25 review HTTP checks, 38 assistant HTTP checks and 256 existing application HTTP requests pass. Production build includes lint and type validation; whitespace checks pass. Review HTTP checks cover all three interface locales, authorized manager versus unrelated employee, write ownership, missing justification, immutable submission, reopening/retries and reset isolation. No live model calls or interactive browser tests were run for this slice.
