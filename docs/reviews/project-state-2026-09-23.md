# Project state after the workflow/map merge

Reviewed commit `12fe90a` on 2026-09-23. The working tree was clean at review start. This report does not change application behavior. Validation used a separate checkout of HEAD and disposable databases; the user's live data and development server were left unchanged.

## Assessment

The prototype now has a connected development workflow: saved goal → assessment/effective-skill comparison → eligible activity → linked milestone → recorded completion → employee self-assessment → HR/current-manager decision. The application separates learning gains from formally accepted ratings and does not automatically grant a grade. Its strongest foundation is deterministic state calculation, scoped evidence, transactionally validated writes and preserved review decisions.

The intended AI-assisted quarterly review is still incomplete. The current review path explicitly records `calibration: "not_run"`. The advisor can clarify goals/constraints and recommend catalog activities, but it does not yet calibrate self-ratings or run the requested evidence-challenge loop.

## Confirmed findings

### P2 — filtered map retains unrelated skill actions

Location: `components/career/development-flow.tsx:10–20`.

Selection is stored independently from the search/filter result. On E0001, entering `NO_MATCH_XYZ` produced zero skill nodes while the desktop inspector continued showing API Design and its actions. A normal search for another skill has the same mismatch until the user explicitly selects a result.

Reconcile selection against the visible list, or clearly mark an intentional pinned selection. Empty results should clear/hide unrelated actions. Add a browser check that asserts the inspector belongs to a visible skill.

### P2 — activity exploration loses map context on Back

Location: `components/career/development-flow.tsx:10–12`, with activity links at line 29.

Browser reproduction: search `Cloud`, select Cloud Platforms, open its activity, then browser Back.

```json
{"before":"Cloud Platforms","after":"API Design","search":""}
```

The search, filter and selection only live in component state. Persist them in the URL and carry a return destination into the activity detail page. The explicit activity Back link currently goes to the catalog rather than the originating map.

### P2 — Next action skips milestones awaiting evidence

Location: `components/career/development-workspace.tsx:15–23`.

The active-milestone selector only considers `in_progress` and `planned`. With a saved role-linked goal and a single `evidence_needed` milestone, the overview said:

```text
Make the next step fit your life
```

It should direct the employee to collect/review evidence for that milestone. Include `evidence_needed` in the decision policy and make its priority explicit. This matters because evidence is the step connecting learning to human review.

### P2 — missing-target map prompt bypasses localization

Location: `components/career/development-map.tsx:8`.

In Russian mode, an employee without a role-linked goal still sees `Development map`, the English comparison-target explanation, and `Choose a comparison target`. These strings are literal JSX rather than translation lookups. Route this branch through the existing EN/RU/KK dictionary and include the missing-target state in locale checks.

## What the latest changes delivered

| Area | Current behavior |
| --- | --- |
| Reviews | Required self-rating/justification; immutable submissions; HR or current manager approve/return; explicit final ratings/comment; per-skill accepted baselines |
| Explainability | Published recommendations include current grade, target requirements, projected gains and related participation; alternatives are drawn from real candidates |
| Agent boundaries | Goal adoption and state changes require validated commands; confirmed duration/format constraints gate recommendations; arbitrary notes still depend on model clarification |
| Development journey | Interactive skill map, activity details, activity-to-milestone links and completion handoff |
| Repeatable activities | Completion UUID separates retries from new occurrences; recurring EV_036 supports multiple records; old completion IDs survive migration |
| Access | Default administrator-issued tokens; server-assigned identity; explicit demo-only public account picker |
| Runtime | Single Next.js app and SQLite; standalone Docker packaging; `npm run demo` for synthetic startup |

The architecture is still deliberately small. Domain handlers and SQLite transactions provide the state-change boundary; there is no separate event broker or background manipulation service. That is sufficient for the prototype. A shared visible activity/decision timeline would contribute more to auditability than introducing infrastructure now.

## Requirements still incomplete

- **AI review calibration:** four verdicts including `insufficient_evidence`, confidence/evidence references, challenges, clarification state, and deterministic timeout fallback. Human approval is already in place.
- **Jury dataset replacement:** current initialization seeds fixtures and imports known-schema profiles/history by merging IDs. Append works; replacing the complete dataset is not implemented. Dataset replacement must start a fresh scope for plans, reviews and advice.
- **HR tasks/resources and mentoring:** custom task authoring in the activity schema, employee/role targeting, and internal-first resource recommendations remain pending.
- **Roadmap semantics:** the map groups skills by gap/evidence status; it is not the requested four category tracks or a prerequisite-ordered sequence.
- **Unified audit presentation:** review revisions exist, but “View changes” opens learning history rather than a combined plan/decision/completion timeline.
- **Named HR attribution:** access tokens can restrict HR access, but HR identities still collapse to the shared HR actor; named individual reviewers remain a deployment extension.

The dataset supports explainable gap calculations and evidence-assisted questions. Activity completion, course feedback and self-reported justifications do not independently establish workplace proficiency. Calibration must preserve uncertainty and permit insufficient evidence; authoritative final ratings remain human decisions.

## Recommended next stage

1. Fix the four confirmed UI issues; preserve context through map → activity → plan.
2. Implement one complete calibration loop on a frozen submitted review: validate evidence → ask material questions → store attributed responses → produce advisory verdicts → manager/HR decision. Use the existing database and handlers.
3. Add full known-schema replacement and invalidation/reset semantics before the jury upload demonstration.
4. Add HR task creation and a concise unified audit view; defer extra infrastructure.

## Validation

- 47 unit tests passed.
- ESLint and TypeScript checks passed.
- Production build passed from an isolated checkout with local dependencies.
- General HTTP suite: 260 requests passed.
- Assistant HTTP suite: 40 checks passed, provider disabled.
- Review HTTP suite: 41 checks passed.
- Identity HTTP suite passed: token login, forged roles, account scope, old/demo cookies and logout.
- Browser checks reproduced all four findings using synthetic data.

The first isolated build attempt used a dependency symlink and failed during standalone tracing with `EPERM: operation not permitted, mkdir '/private/var/Users'`. Replacing that test-only symlink with a local dependency copy resolved the build. This was a review-environment issue, not an application regression.

No live OpenAI quality/latency evaluation or Docker image build was run. Passing deterministic tests does not validate the model's comparative judgment or the missing calibration feature.

## Follow-up fixes delivered

The four confirmed UI findings above are fixed in the working tree:

- Map search, filter, selected skill and detail state live in URL parameters. Browser Back and activity-detail “Back to map” preserve context; return destinations are restricted to the employee dashboard map.
- The inspector derives its skill from the filtered results and exposes no unrelated actions when there are no matches.
- `evidence_needed` milestones take priority over in-progress/planned work in the next-action prompt, without claiming a course was completed.
- Missing-target map instructions and the new evidence prompt use EN/RU/KK translations.

Verified with 48 unit tests, lint/type checks, a production build and 260 HTTP requests. Browser checks passed for evidence priority, empty results, browser Back, explicit map return, reload, mobile close/Escape, and missing-target prompts in Russian and Kazakh. Tests used isolated data.

During this follow-up, concurrent commit `3684039` restored the public account picker and removed token login. The token-authentication description in the original snapshot above applies only to `12fe90a`; it no longer describes the latest login behavior. That independent change was preserved.
