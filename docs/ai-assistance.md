# AI assistance in Career Quest

Implemented 2026-09-23. One server-side OpenAI adapter serves three interfaces; no separate agent service or vector database is needed for this structured dataset.

## Where AI belongs

| Interface | AI responsibility | Deterministic boundary | Status |
| --- | --- | --- | --- |
| Employee development page | Clarify an aspiration, draft a goal, explain critical gaps, compare useful activities | Employee accepts a goal draft; code checks targets, eligibility, gain caps and revisions | Implemented |
| Activity catalog | Explain a selected activity, its prerequisites and relevant alternatives | Explain excluded activities without enrolling or recommending them | Implemented |
| HR employee profile | Draft a development discussion brief and evidence questions | Read-only advice; no employee ranking, rating or employment decision | Implemented |
| Quarterly self-assessment | Improve the clarity of a business justification, challenge missing proof, return advisory calibration | Preserve the employee's wording; never fabricate outcomes or set final ratings | Review records and human approval/return are implemented; AI calibration is pending |
| Manager review | Compare self-rating, calibrated opinion and accepted evidence; draft discussion points | A human sets the final rating and approval | Human decisions implemented; AI review assistance pending |
| HR task authoring | Draft an outcome, skill links and evidence criteria | HR validates and publishes; code validates catalog references and contributions | Depends on task definitions/assignments |
| Dataset initialization | Explain validation failures in ordinary language | Parsing, reference checks, atomic activation and skill arithmetic stay in code | Optional later enhancement |

AI is invoked by a person's request, not on page load. Existing plan editing and evidence remain usable without a key or when the provider fails.

## Configuration

Put the key in the ignored `.env` or `.env.local` file, never a `NEXT_PUBLIC_*` variable:

```dotenv
OPENAI_API_KEY=your-key
OPENAI_MODEL=gpt-4.1-mini
OPENAI_TIMEOUT_MS=8500
```

Restart the server after changing environment settings. The app uses the [Responses API with strict structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), native server-side `fetch`, and `store: false`. This disables Responses storage; it is not a claim of zero provider retention. No additional SDK dependency is required. The timeout is capped at 8.5 seconds, leaving time for validation and persistence within the intended 10-second request budget. There are no automatic provider retries. Real deployment latency still needs measurement.

Only the subject's relevant role, grade, saved focus/milestones, skill gaps, relevant participation records, candidate activities and a short conversation window are sent. Names, contact information and other employee profiles are omitted from the evidence builder. The employee's own free text can contain information they choose to include. The UI discloses the OpenAI request before submission.

## Request and action flow

```text
Authenticate and authorize the subject
  -> read dataset + saved plan revisions
  -> compute gaps, eligibility and prospective gains
  -> assemble evidence IDs + attributed chat statements
  -> ask OpenAI for a conversational structured reply
  -> optionally execute one round of scoped read-only tools
  -> validate structure, references and activity/skill selections
  -> preserve the conversational opening; render evidence/activity cards from source values
  -> recheck revisions under a SQLite transaction
  -> save the evidence/output and show the answer

Goal draft -> employee clicks “Use as my focus goal”
  -> validate stored draft + ownership + revisions
  -> save through the existing planning command
```

- `GET /api/assistant`: load scoped conversation and current revisions; no provider call.
- `POST /api/assistant`: `employeeId`, `mode`, optional `eventId`, request UUID, message, dataset and plan revisions.
- `POST /api/assistant/goal`: adopt a saved draft using `turnId`; employee-only and idempotent. The goal ID links back to its AI source. Adoption is an employee decision, not an automatic agent write.

Modes are `coach`, `activity` and `hr`. Employees can use only their own coach/activity scope; HR uses the selected employee's HR scope. Conversations are separated by actor scope, employee, dataset revision, plan revision, mode and selected activity. The latest six turns are shown and supplied as conversation context. Preference changes preserve this transcript but mark earlier answers as stale and hide their actionable proposals/recommendations. Current preferences override earlier conversation state. A changed plan/import/reset makes prior turns unavailable as current advice; old rows remain in the audit table. This is invalidation, not deletion.

Assistant audit rows share the application SQLite database and store the request, source evidence, output, model, prompt version, language, mode, timing, revisions and executed tool names/arguments/evidence IDs. They never update assessments or imported participation. A changed revision rejects an in-flight response. Requests use UUIDs to avoid duplicate completed calls; one in-flight call per actor scope and six persisted turns per minute limit accidental repeated spending in this single-instance prototype. This is not a production abuse-control system.

## Grounding and remaining limits

Recommendations can select only useful, currently eligible candidates, capped at eight shortlisted choices. The model names an `event_id` and a contributing `skill_id`; code validates that pair and attaches saved-goal, activity and skill-gap references. Unknown references, excluded/duplicate activities, invented role targets and recommendations mixed with unanswered clarification questions are rejected. Missing goals never imply the next grade. Free-form goals without a catalog mapping receive goal/criterion clarification rather than invented activity advice.

Historical completions at/before the last assessment are explicitly labeled as already incorporated into the baseline. Only supplied computed levels and prospective before/after contributions may support numerical claims. A course completion does not certify workplace competence. HR briefs can contain insights and questions but cannot propose employee-owned changes.

The evidence drawer and references beside each fact make the basis inspectable. JSON/schema/reference checks alone do **not** prove a sentence semantically correct. The conversational opening is now model-authored, with validated source references for personal factual claims. Evidence statements and numerical activity explanations remain deterministic. Reference validation cannot establish that every interpretation in the opening is correct; conversational prose, questions and proposals still require quality evaluation. This is a deliberate change from replacing every opening with a template. Missing assessments are explicitly labeled as missing, not proof of inability. Internal ranking scores are not shown to the model or presented as meaningful user metrics.

The model cannot approve a review, change skill levels, promote, enroll or mark completion. The assistant reuses the domain's current-or-target audience policy, matching a whole role/grade pair and labeling target-only access as a prototype rule rather than employer enrollment permission. A minimal structured readiness gate now checks the saved goal, role mapping, explicitly confirmed duration/formats, and candidate availability. Free-form notes still rely on AI clarification; arbitrary natural-language constraints are not automatic filters. Free-form milestone generation and quarterly calibration remain pending.

Provider failure, timeout, refusal or validation failure returns a labeled rules fallback without fabricated recommendations. Missing-goal clarification and the saved plan remain usable. Invalid credentials produce a distinct configuration message. Output follows an explicit interface locale when selected, otherwise the subject's `preferred_language`; source evidence remains unchanged.

## Verification

`npm test` covers scoped evidence, missing/free-form goals, citation/eligibility validation, provider failure/refusal/timeout, audit persistence and stale revisions. `npm run test:ai` runs an isolated HTTP server with `OPENAI_API_KEY` explicitly empty and a temporary database; it tests access, origin, validation, fallback, retries, goal adoption and reset isolation without paid calls. Build first with `npm run build`.

The existing application HTTP suite remains `npm run test:http`. Live fixture tests use only the original dataset, whose README explicitly states that it contains no real people or companies. Live quality and latency results are recorded in implementation status; they are examples, not a general quality or latency guarantee.

## Confirmed consultation constraints

Before activity recommendations, employees explicitly confirm maximum **total catalog hours per activity** and acceptable formats. A blank duration and no selected formats explicitly mean no restrictions after confirmation; before confirmation, they mean unanswered. Optional notes persist as attributed self-report. They cannot certify skills or rewrite participation history.

`POST /api/assistant/consultation` accepts `{ datasetRevision, planRevision, revision, answers: { maxHours, formats, notes } }`. The employee identity comes from the session. HR can inspect the answers as evidence but cannot overwrite them. SQLite retains each answer revision with the actor and timestamp; identical retries do not create duplicate revisions. Readiness is `awaiting_answer` (goal or constraints), `blocked` (unmapped goal or empty catalog result), or `ready` (eligible for AI comparison, not guaranteed correctness).

Duration and formats filter all candidates before shortlisting. Every published recommendation includes the consultation evidence reference. Changing answers invalidates prior actionable advice and unaccepted goal drafts, including requests still running; the transcript remains visible and earlier messages are marked as using previous preferences. Plan or dataset revision changes require reconfirmation in this prototype; old answers remain auditable, but are not silently reused. The assistant remains available for goal clarification and activity explanations before readiness, but validated recommendations are withheld. API clients should send the current `consultationRevision` returned by `GET /api/assistant`; its default zero only supports an unanswered consultation.

## Chat workspace and global widget

The advisor is now a distinct chat workspace with a continuous transcript, user/assistant bubbles, starter prompts, an expanding composer, Enter/Shift+Enter controls, Stop, retry, copy, automatic scrolling and a latest-message shortcut. Sources, goal adoption and recommendation cards remain attached to each answer. Preferences live in a collapsible context drawer instead of dominating the conversation.

A floating launcher is available throughout authenticated employee and HR workspaces. Employee chat retains the same employee conversation as the full advisor; minimizing and navigation preserve the mounted widget. HR explicitly selects a subject before opening a discussion. The launcher hides on a full advisor page to avoid two visible composers. Context and authorization are still determined by server records, never by the page's text. Landing/account selection intentionally has no employee chat.

`POST /api/assistant` keeps JSON compatibility and negotiates SSE with `Accept: text/event-stream`. Events are `status` (`checking`, `thinking`, `validating`), `delta` and `result`, or a terminal `error`. Status updates begin immediately. Answer text streams only after the structured response is structurally validated, paired with source-rendered cards and persisted; raw unvalidated provider tokens are not published, and there is no artificial typing delay. Completed request IDs replay the same result. Stream failure preserves the user's message for retry; Stop propagates cancellation to the provider. A response already saved at the moment of cancellation may reappear on reload, and stopping does not undo an adopted goal.

The UI shares updates between mounted surfaces. It shows a bounded six-turn history, consistent with existing storage retrieval. It does not add a separate general-purpose bot, cross-employee memory, arbitrary website access or automatic mutations.


## Conversational engine and scoped tools — 2026-09-23

The assistant responds to the last message instead of forcing recommendations whenever readiness is `ready`. Greetings, thanks and explanations can have no questions, insights or recommendations. Its `intent` identifies conversation, explanation, clarification, recommendation, preferences or goal work. Readiness still gates recommendation **actions**, not ordinary conversation. The provider schema disallows recommendation arrays when unready or in HR mode; repository validation remains independent.

Two [Responses API function tools](https://developers.openai.com/api/docs/guides/function-calling) are available:

- `inspect_evidence({ ids })`: retrieve up to 12 authorized records.
- `compare_activities({ event_ids })`: inspect up to three known activities, their actual eligibility and related participation.

Neither tool accepts an employee identity, executes arbitrary code, makes external requests or writes state. Unknown names/IDs fail validation. The server allows one tool round with at most three calls, then requests a final answer with tools disabled. Both model requests share one 8.5-second deadline; no automatic retries. Executed calls are recorded with the saved answer, including when generation subsequently falls back. The existing `gpt-4.1-mini` default remains configurable through `OPENAI_MODEL`.

When the user states both total activity duration and acceptable formats, the assistant can return `consultation_draft`. The inline proposal supports confirmation or editing and uses the existing version-checked consultation endpoint. It does not save itself. An unresolved follow-up suppresses the proposal; an unchanged proposal is removed. HR cannot propose employee-owned preferences. A new goal still requires separate employee adoption.

Grounded cards are still mandatory for structured recommendations. Summary references are included in the evidence drawer, and tool traces are expandable under technical details. Ordinary conversation does not replace a still-current recommendation in the development overview.

Validation: 57 unit tests, lint/type validation, production build, 40 assistant HTTP checks, 41 review HTTP checks and 260 general HTTP requests passed. Browser checks covered editable preference proposals, no write before confirmation, saved preferences, transcript continuity, stale proposal suppression, a follow-up using the new revision and mobile fit. No provider calls occurred in these automated/browser tests.

Live language checks used a wholly invented two-activity profile, not repository employee data. After prompt/contract iteration, six scenarios completed on both GPT-4.1 and GPT-4.1 mini: greeting, explanation before preference confirmation, tool-assisted comparison, scheduling clarification, a preference follow-up, and Russian support without a course list. The final mini sample took 1.8–4.9 seconds. Early variants produced invalid outputs and excessive questioning, prompting the stricter intent/empty-array contract. These small samples do not establish general quality or latency guarantees; in particular, attendance-based feasibility interpretations can still be overstated and need ongoing evaluation.

Automatic approval review rejected the initial plan to send repository employee context for evaluation. The successful live checks instead used invented values defined in the evaluation script; no repository employee records were exported for this work.

### Fast conversational replies

The chat provider defaults to 1–2 short sentences and a 1,200-token output ceiling (previously 1,800). It receives shortlisted activity and participation facts upfront to avoid redundant tool round trips; scoped tools remain available for missing details. The default model remains `gpt-4.1-mini`. The shared 8.5-second deadline, confirmation gates, evidence validation and publication checks are unchanged. This reduces requested output and avoidable lookups, but does not guarantee a fixed response time.

### Complete employee evidence

Every request includes the full employee profile and a deterministic `career_path` fact: current role/grade and the immediately following grade only when that same-role profile exists. This is a possible direction, not a saved goal or promotion decision. The assistant must use these facts rather than asking the employee to repeat them.

The existing read-only `inspect_evidence` tool now exposes all catalog skills (imported, approved and effective values separately), all planning goals/milestones, every activity-history row for the subject, role requirements, proficiency definitions, catalog activity details, and authorized quarterly review revisions including self-assessments and human decisions. Detailed records are retrieved on demand; their IDs and labels are indexed in the initial request. Reviews are loaded through the repository's actor-scoped access check. Historical review revisions are snapshots, not current assessments. Catalog-only activities remain ineligible for recommendation unless independently shortlisted by the existing rules.

Verification: 59 unit tests, typecheck and lint passed. A live test using a wholly invented Junior Backend Engineer profile and the Russian “next career step” exchange recognized the Middle target and asked about timeframe/responsibilities instead of re-asking role/grade. This is a behavioral check, not a guarantee of every model response.
