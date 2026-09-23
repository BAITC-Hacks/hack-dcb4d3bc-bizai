# Implementation status — 2026-09-23

**New design, not yet implemented:** [prototype product direction](prototype-product-direction.md) specifies arbitrary goals, editable milestone plans, HR suggestions, cross-role exploration with transferable evidence and an optional mock assessment path. Current code still limits goals to role/grade, calculates aggregate coverage and checks activity audiences against the current role/grade. The documentation update does not claim those product changes are delivered.

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
- No live AI calls, completion writes, Docker packaging or production SSO. Recommendation state is visibly `Not generated`.
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
