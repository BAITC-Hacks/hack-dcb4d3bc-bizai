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
  -> ask OpenAI for a strict result
  -> validate structure, references and activity/skill selections
  -> render factual statements directly from source values
  -> recheck revisions under a SQLite transaction
  -> save the evidence/output and show the answer

Goal draft -> employee clicks “Use as my focus goal”
  -> validate stored draft + ownership + revisions
  -> save through the existing planning command
```

- `GET /api/assistant`: load scoped conversation and current revisions; no provider call.
- `POST /api/assistant`: `employeeId`, `mode`, optional `eventId`, request UUID, message, dataset and plan revisions.
- `POST /api/assistant/goal`: adopt a saved draft using `turnId`; employee-only and idempotent. The goal ID links back to its AI source. Adoption is an employee decision, not an automatic agent write.

Modes are `coach`, `activity` and `hr`. Employees can use only their own coach/activity scope; HR uses the selected employee's HR scope. Conversations are separated by actor scope, employee, dataset revision, plan revision, mode and selected activity. The latest six turns are shown and the latest three are supplied as conversation context. A changed plan/import/reset makes prior turns unavailable as current advice; old rows remain in the audit table. This is invalidation, not deletion.

Assistant audit rows share the application SQLite database and store the request, source evidence, output, model, prompt version, language, mode, timing and revisions. They never update assessments or imported participation. A changed revision rejects an in-flight response. Requests use UUIDs to avoid duplicate completed calls; one in-flight call per actor scope and six persisted turns per minute limit accidental repeated spending in this single-instance prototype. This is not a production abuse-control system.

## Grounding and remaining limits

Recommendations can select only useful, currently eligible candidates, capped at eight shortlisted choices. The model names an `event_id` and a contributing `skill_id`; code validates that pair and attaches saved-goal, activity and skill-gap references. Unknown references, excluded/duplicate activities, invented role targets and recommendations mixed with unanswered clarification questions are rejected. Missing goals never imply the next grade. Free-form goals without a catalog mapping receive goal/criterion clarification rather than invented activity advice.

Historical completions at/before the last assessment are explicitly labeled as already incorporated into the baseline. Only supplied computed levels and prospective before/after contributions may support numerical claims. A course completion does not certify workplace competence. HR briefs can contain insights and questions but cannot propose employee-owned changes.

The evidence drawer and references beside each fact make the basis inspectable. JSON/schema/reference checks alone do **not** prove a sentence semantically correct. Therefore the published summaries, evidence statements and numerical activity explanations are rendered deterministically from the selected records. The model selects relevant evidence/options and drafts questions and goal proposals; its free-text factual assertions are not published. Questions and proposals remain advisory and need evaluation. Missing assessments are explicitly labeled as missing, not proof of inability. Internal ranking scores are not shown to the model or presented as meaningful user metrics.

The model cannot approve a review, change skill levels, promote, enroll or mark completion. The assistant reuses the domain's current-or-target audience policy, matching a whole role/grade pair and labeling target-only access as a prototype rule rather than employer enrollment permission. A minimal structured readiness gate now checks the saved goal, role mapping, explicitly confirmed duration/formats, and candidate availability. Free-form notes still rely on AI clarification; arbitrary natural-language constraints are not automatic filters. Free-form milestone generation and quarterly calibration remain pending.

Provider failure, timeout, refusal or validation failure returns a labeled rules fallback without fabricated recommendations. Missing-goal clarification and the saved plan remain usable. Invalid credentials produce a distinct configuration message. Output follows an explicit interface locale when selected, otherwise the subject's `preferred_language`; source evidence remains unchanged.

## Verification

`npm test` covers scoped evidence, missing/free-form goals, citation/eligibility validation, provider failure/refusal/timeout, audit persistence and stale revisions. `npm run test:ai` runs an isolated HTTP server with `OPENAI_API_KEY` explicitly empty and a temporary database; it tests access, origin, validation, fallback, retries, goal adoption and reset isolation without paid calls. Build first with `npm run build`.

The existing application HTTP suite remains `npm run test:http`. Live fixture tests use only the original dataset, whose README explicitly states that it contains no real people or companies. Live quality and latency results are recorded in implementation status; they are examples, not a general quality or latency guarantee.

## Confirmed consultation constraints

Before activity recommendations, employees explicitly confirm maximum **total catalog hours per activity** and acceptable formats. A blank duration and no selected formats explicitly mean no restrictions after confirmation; before confirmation, they mean unanswered. Optional notes persist as attributed self-report. They cannot certify skills or rewrite participation history.

`POST /api/assistant/consultation` accepts `{ datasetRevision, planRevision, revision, answers: { maxHours, formats, notes } }`. The employee identity comes from the session. HR can inspect the answers as evidence but cannot overwrite them. SQLite retains each answer revision with the actor and timestamp; identical retries do not create duplicate revisions. Readiness is `awaiting_answer` (goal or constraints), `blocked` (unmapped goal or empty catalog result), or `ready` (eligible for AI comparison, not guaranteed correctness).

Duration and formats filter all candidates before shortlisting. Every published recommendation includes the consultation evidence reference. Changing answers invalidates prior advice, chat context and unaccepted goal drafts, including requests still running. Plan or dataset revision changes require reconfirmation in this prototype; old answers remain auditable, but are not silently reused. The assistant remains available for goal clarification and activity explanations before readiness, but validated recommendations are withheld. API clients should send the current `consultationRevision` returned by `GET /api/assistant`; its default zero only supports an unanswered consultation.

## Chat workspace and global widget

The advisor is now a distinct chat workspace with a continuous transcript, user/assistant bubbles, starter prompts, an expanding composer, Enter/Shift+Enter controls, Stop, retry, copy, automatic scrolling and a latest-message shortcut. Sources, goal adoption and recommendation cards remain attached to each answer. Preferences live in a collapsible context drawer instead of dominating the conversation.

A floating launcher is available throughout authenticated employee and HR workspaces. Employee chat retains the same employee conversation as the full advisor; minimizing and navigation preserve the mounted widget. HR explicitly selects a subject before opening a discussion. The launcher hides on a full advisor page to avoid two visible composers. Context and authorization are still determined by server records, never by the page's text. Landing/account selection intentionally has no employee chat.

`POST /api/assistant` keeps JSON compatibility and negotiates SSE with `Accept: text/event-stream`. Events are `status` (`checking`, `thinking`, `validating`), `delta` and `result`, or a terminal `error`. Status updates begin immediately. Answer text streams only after the structured response is validated, source-rendered and persisted; raw unvalidated provider tokens are not published, and there is no artificial typing delay. Completed request IDs replay the same result. Stream failure preserves the user's message for retry; Stop propagates cancellation to the provider. A response already saved at the moment of cancellation may reappear on reload, and stopping does not undo an adopted goal.

The UI shares updates between mounted surfaces. It shows a bounded six-turn history, consistent with existing storage retrieval. It does not add a separate general-purpose bot, cross-employee memory, arbitrary website access or automatic mutations.
