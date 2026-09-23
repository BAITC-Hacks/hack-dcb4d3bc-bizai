# Career Quest: case-source compliance review

Reviewed 2026-09-23 against the Career Quest section of the source DOCX and `case_source/case_1/career_quest_dataset/README.md`. Voice Router is a separate case and is out of scope. Review includes the working tree, including uncommitted approval changes; HEAD was `61b43c8`. Existing files were not edited by this review. Other work was changing files during the review, so verification describes the versions observed during these runs.

**Verdict: partially compliant.** The application builds and its existing checks pass. Profiles, data import, ordinary completion and HR reporting are implemented. Recommendation explainability and recurring completion have concrete gaps. Identity enforcement is deliberately demo-only. Passing the existing tests does not establish the jury's recommendation-quality criteria.

## Follow-up implementation (2026-09-23)

The five findings below document the reviewed version. The subsequent implementation addresses them:

- Published recommendations attach and render current grade, target requirements, projected gaps and related participation, with a grounded alternative comparison.
- Candidate participation includes activities sharing skills; full aggregate counts and bounded record samples reach the model.
- Ready coaching with no clarification question rejects zero recommendations.
- Completion operations have IDs independent of event IDs. EV_036 supports repeated gains; retries remain idempotent. Existing completion IDs survive the transactional SQLite migration.
- Login defaults to random administrator-issued access tokens with server-side role assignment. Public account selection requires `AUTH_MODE=demo`; legacy and other-mode cookies are rejected. The secure entry page omits employee names.

Also added optional next-grade previews and explicit goal drafting for employees without a goal, plus `npm run demo` for one-command synthetic startup. Goals still require employee adoption; previews do not mutate saved plans.

Verification: 46 unit tests; typecheck; lint; production build; main, assistant, review and new identity HTTP suites passed. Local HTTP p95 was 13 ms and maximum 276 ms. Live provider quality/latency and Docker execution remain unverified. See README for the changed login setup and required completion `commandId`.

## Findings

### 1. [P1] Published recommendations do not enforce the required three-factor explanation

Requirement: §7 requires an explanation grounded in at least three factors from grade, skill gaps, participation history and next-level requirements.

Locations: `lib/ai/context.ts:54–71`, `lib/ai/presentation.ts:43–62`.

`validateAdvice()` accepts a recommendation with empty evidence IDs and adds goal, consultation, event and gap references. It requires neither current-grade nor participation evidence. `presentAdvice()` then replaces the model's reason with projected gains, format and duration; model insights also become fact lists, losing their comparative explanation.

Reproduced using E0137 with a saved Backend Engineer / Senior target and confirmed unrestricted constraints:

```text
candidate: EV_006
input: insights = [], recommendation.evidence_ids = []
validation: accepted
published: System Design 2 → 3 / Required 4; API Design 3 → 4 / Required 4;
           Observability 2 → 3 / Required 3; In person; 12 h
grade evidence: absent
participation evidence: absent
```

Gap values and target thresholds cover two required categories; activity duration and format do not supply the missing third category. Citations to a saved goal do not explain how grade or participation affected selection.

Fix: require structured decision factors covering at least three specified categories, then render those factors from source values. Preserve a grounded comparison explaining why this activity was chosen over an alternative. Test the final published response, not only citation validity.

### 2. [P1] History about similar activities is discarded before the model sees it

Requirement: §7 explicitly anticipates profiles where repeated missed similar activities should affect the recommendation.

Location: `lib/ai/context.ts:45–47`.

History evidence is restricted to the exact event IDs in the considered shortlist. Related activities developing the same skill are omitted; the overall participation counter cannot identify which skill or activity family had the failures.

Actual supplied-data example:

```text
E0165 candidates: EV_036 Public Speaking Club, EV_040 Structured Problem Solving
EV_023 Data Storytelling & Visualization develops SK_PUBLIC_SPEAKING
R001032: EV_023 dropped — omitted from model evidence
R001835: EV_023 dropped — omitted from model evidence
```

E0184 also loses related EV_010 declined/dropped records while EV_009 is a candidate for their shared CI/CD skill. This does not prove a particular live model would choose incorrectly; it proves relevant evidence is unavailable to it.

Fix: include bounded history grouped by shared skills/activity family, with IDs supporting the pattern. Distinguish observed participation from inferred motives. Add jury-style behavioral fixtures and assert that relevant history reaches the model.

### 3. [P2] Ready advice can successfully contain zero next steps

Requirement: §7 requires 1–3 relevant activities when the system can recommend a next step.

Locations: `lib/ai/contracts.ts:12`, `lib/ai/context.ts:54–76`.

```text
E0137 with saved Senior target and confirmed constraints:
readiness = ready; candidates = 6
{ summary: "Ready", questions: [], insights: [], recommendations: [], goal_draft: null }
validateAdvice(...) → accepted
```

The schema applies only `max(3)` and the validator checks only existing items. The successful empty result can therefore be saved/displayed despite available candidates and no unresolved question. The provider unit test also treats this empty result as valid.

Fix: for ready coach requests with no clarification question, enforce 1–3 recommendations, or require a structured and evidenced abstention reason. Keep HR briefs and activity explanations exempt from that coach-specific rule.

### 4. [P2] Recurring club completion can only grant one application-recorded gain

Requirement: dataset README explicitly permits repeated EV_036 participation; each completion applies its catalog gain up to its cap.

Locations: `lib/server/database.ts:59–60`, table definition at `lib/server/database.ts:33`; contrast `lib/career/eligibility.ts:17`.

Every employee/event pair has one completion record. Any later completion returns the old record as a retry, including the recurring club.

Reproduced with an isolated in-memory repository:

```text
E0001 / EV_036 / SK_PUBLIC_SPEAKING
catalog: gain = 1, max_level = 4
before                  0
after first completion  1
after second completion 1  [repeated: true]
still eligible          true
```

Fix: distinguish a completion operation/session ID from the event ID. Keep retries idempotent for the same operation while allowing another EV_036 occurrence. Continue prohibiting new completions for nonrepeatable events.

### 5. [P1 for an internal deployment] Callers can mint their own HR or employee identity

Requirement: §9 calls for employee/HR separation and engagement privacy.

Location: `app/api/session/route.ts:15–23`.

```text
POST /api/session
accessRole=hr
→ authenticated HR session, without identity verification
```

Server authorization correctly scopes an already-issued employee session, but anyone can choose HR or another employee through the public picker. The README explicitly discloses this demo design. Thus role-scoping tests pass, while the privacy boundary is not enforced against a user changing identity.

Fix before internal use: derive role and employee ID from verified identity; gate demo identity selection behind an explicit demo mode. For a synthetic hackathon demo, record this as an accepted limitation rather than claiming complete privacy compliance.

## Requirement coverage

| Case requirement | Assessment | Evidence / boundary |
|---|---|---|
| Profile: role, grade, skills, completed activities | Implemented | Employee/HR views; 200 profile API reads pass. |
| Trajectory and available next steps for an arbitrary employee | Partial | 66/200 supplied employees have no career goal. `initialPlan()` leaves focus empty; `development()` has no target requirements and the assistant has no candidates. A saved role-linked target is an extra prerequisite. |
| AI selection of 1–3 activities | Partial | Actual provider integration and constrained candidates exist. Findings 2–3; live quality not evaluated in this review. |
| Explanation using at least three specified factors | Incomplete | Finding 1; related-history loss in finding 2. |
| Completion updates skills and trajectory | Implemented for ordinary eligible activities | Capped effective levels and trajectory gap bars update; repeatable club fails as in finding 4. Formal module coverage intentionally waits for assessment approval. |
| HR skill-gap prevalence, missing-next-step status, activity participation | Implemented with scope limits | HR dashboard supports all three. Gap statistics include selected role targets only; recommendation status distinguishes not requested, stale, clarification and no supported step. |
| Jury profile/history upload in supplied format | Implemented | Preview, references, merged validation, duplicate handling, stale-write checks, transactional apply and reset tested. |
| Snapshot date, assessment cutoff, missing skills and gain caps | Implemented | Uses dataset date 2026-10-01; replay/caps/missing-as-zero tests pass. |
| Employee/HR separation and privacy | Demo only | Scoped routes/APIs pass tests; identity is self-selected, finding 5. |
| No public performance rankings or mandatory-process rewards | Satisfied in reviewed paths | Source-order HR list; mandatory activities excluded from voluntary recommendations; no reward mechanism observed. |
| UI ≤2 seconds | Local HTTP evidence only | 260 requests: p95 14 ms, maximum 310 ms. This measures local response latency, not browser interaction/rendering or deployment load. |
| AI recommendation ≤10 seconds | Budget implemented; live result unverified | Provider budget capped at 8.5 s; route reserves time. Timeout can return an empty fallback, not a recommendation. |
| One-command launch | Partial | README documents install/start or build/volume/run commands, not one clean-checkout launch command. Dockerfile exists; no container build was run in this review. |
| Repository and reproducible README | Present, with stale approval descriptions | README still describes HR inspection as read-only and approval as remaining work, while the working tree implements HR/manager decisions. Update after the ongoing approval work settles. |
| Optional gamification | Not required | Its absence is not a compliance defect. |
| Optional Russian/Kazakh localization | Implemented and smoke-tested | Catalog coverage tests and localized page HTTP checks pass. |

## Product-policy differences to resolve before the demo

- **Missing goals:** the case describes next-grade requirements as an input and an arbitrary-profile demonstration. The implementation intentionally avoids inferring a next grade. Offer an explicitly labeled, optional next-grade exploration/confirmation path; do not silently turn it into a personal goal. Free-form goals without a role mapping likewise cannot produce catalog recommendations.
- **Progress terminology:** effective skills and trajectory bars move after ordinary completion, so the basic progression loop exists. The overview's “Closed modules” count and API `coverage` use assessed values and remain unchanged until approval. Make both measures visible so the jury can see the required immediate progress without implying automatic promotion.
- **Default setup:** no API key means no AI recommendations. Failure fallback also returns `recommendations: []`. This is honestly disclosed, but the required AI scenario needs working provider configuration; “app starts” alone is insufficient.

## Verification performed

```text
npm test              PASS: 41 tests
npm run typecheck     PASS
npm run lint          PASS
npm run build         PASS
npm run test:http     PASS: 260 requests; p95 14 ms; max 310 ms
npm run test:ai       PASS: 40 checks; explicitly no provider calls
npm run test:reviews  PASS: 41 checks
```

HTTP suites initially hit sandbox `listen EPERM` errors, then passed when rerun with permission to bind loopback ports. They used temporary test databases. Additional direct domain probes reproduced findings 1–4 and counted missing goals; no production application data was changed.

Not verified: live LLM choices/explanations on jury profiles, actual provider response latency, browser interaction/visual quality, Docker clean-build launch, production identity or load behavior. No claim that the provided synthetic tests predict hidden jury outcomes.
