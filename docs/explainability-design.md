# Dataset-grounded explainability design discussion

Status: agreed explainability architecture, extended by the latest [prototype product direction](prototype-product-direction.md). Goals are arbitrary and employee-owned; critical role gaps apply when relevant. Plans use editable milestones, HR can view development records and add suggestions, and cross-role mobility is supported. No application code has been changed as part of this discussion.

The product core is an explainable decision grounded in an uploaded dataset, with a visible record of changes and their consequences. UI trimming should follow a proof that this core works.

## Confirmed boundaries and prototype scope

- Judge uploads use the known schema, with append or full replacement.
- The agent recommends and proposes actions. Deterministic handlers validate and apply changes.
- Chat can contribute attributed self-reported evidence. It does not overwrite verified participation records or silently become verified fact.
- Rank feasible activities by contribution to the employee's chosen goal and, for role-linked goals, critical gaps first. History, effort, and preferences refine the choice. Explicit feasibility constraints remain binding; the proposed target-context audience policy is documented in the product direction.
- Ask for a missing or materially ambiguous goal before recommending. A valid goal already supplied in the dataset is usable evidence; do not ask for it again without a reason.
- The agent checks readiness, asks focused questions, updates structured working state through validated tools, and repeats until it can justify recommendations or explain a blocker. It must not manufacture certainty or fill missing evidence itself.
- Keep the prototype simple: one application, one database, synchronous domain handlers, a durable action log, and stored recommendation evidence.
- Use event names to describe domain changes and trigger recalculation inside the app. Defer a message broker, distributed services, background projection infrastructure, and full event sourcing.
- Initial audit UI: “Why this?”, “Why not the alternative?”, source records, and before/after skill changes. Historical model replay is outside the initial scope.

## What the data can support

| Claim | Available evidence | Limit |
| --- | --- | --- |
| Current recorded skill and target gap | Assessed skills, review date, role profiles, later completed activities | Historical self-paced completion timestamps are absent; replay uses a declared date proxy |
| Eligibility | Current role/grade, prerequisites, mandatory flag, history, future sessions | No calendar conflicts, venue/travel details, capacity, or budget |
| Skill change on completion | Event `gain` and `max_level` | A rule-defined simulation, not measured causal evidence of real learning |
| Participation pattern | Status, format, dates, initiating actor, optional ratings | A no-show does not explain its cause or prove a preference |
| Relative suitability | Above facts plus an explicit selection policy and goal | No labeled best recommendations, promotion outcomes, or validated completion-probability model |
| Audit of an answer | Source references, rule versions, state version, recorded decision and output | Citation alone does not establish that a sentence follows from its source |
| Arbitrary goal or personal milestone | Original employee wording and attributed success criteria; catalog links where supported | A personal objective does not establish an external requirement, validated skill or guaranteed outcome |
| Transferable skill | The same skill ID appearing in current evidence and another role profile | Similar names alone do not establish skill equivalence; a changed aspiration does not rewrite current employment |

Conclusion: the dataset is sufficient for traceable, multi-factor recommendation decisions. It does not independently establish a unique optimal decision, explain motives, or validate real-world promotion predictions.

## A concrete case from the supplied data

Employee `E0137` is a Middle Backend Engineer with assessed System Design level 2. No completed post-review activity changes that level under the documented replay policy. The profile has no career goal, so the agent must ask before recommending. The comparison below is conditional on the employee choosing Senior Backend Engineer; it does not supply that answer on their behalf.

```text
Profile: E0137, skills.SK_SYSTEM_DESIGN = 2
Conditional target after user answer: Backend Engineer / Senior
Role requirement: SK_SYSTEM_DESIGN = 4, marked critical

EV_006: eligible; System Design 2 -> 3; offline; 12 hours
EV_007: eligible; System Design 2 -> 3; online; 8 hours

R002489: E0137 no_show for EV_006 on 2026-06-22, assigned_by = hr
```

Once the goal is established, an explanation may state that `EV_007` addresses a critical gap, meets the current prerequisites, takes fewer hours, and offers a different format from an activity previously missed. It must not assert that remote work means online preference, that the previous absence was caused by the format, or that level 3 satisfies the level-4 target. Apply the agreed career-goal/critical-gap priority to the full candidate effects; ask about the prior no-show only if its cause could materially alter the choice.

The same profile has one speaking-club no-show, `R002092`. Calling this "three repeated speaking misses" would be fabricated. Evidence retrieval must not turn the illustrative example in the brief into a supposed fact about an actual employee.

## Initialization proposal

```text
Upload
  -> retain immutable source files, hashes, upload identity and dataset version
  -> parse the supported JSON envelopes / CSV schema
  -> validate types, IDs, references, dates and cross-file metadata
  -> report errors, warnings and unresolved policy conflicts
  -> normalize records while preserving source file + record ID + field location
  -> establish the assessment baseline and participation facts
  -> compute versioned skills, eligibility and history summaries; compute target gaps where a goal exists
  -> activate the complete dataset version atomically
  -> expose authorized query tools and evidence to the agent
```

The brief promises additional profiles/history in the existing schema. Arbitrary files, schema discovery, and agent-invented business rules are additional scope, not a demonstrated requirement.

Do not train a model or create a free-text summary as the authoritative context. For these structured inputs, context can be assembled on demand from indexed records and computations. Generated summaries are disposable, versioned views with links back to their inputs.

Support a clear distinction between a full replacement and an append/merge into an existing dataset. Stage an entire import before activating it; an agent must not combine new employee records with old skill catalogs accidentally. Validate appended references against the combined dataset, since a partial upload may legitimately reference existing employees/managers.

IDs should be scoped by dataset. Re-uploading identical records must not duplicate gains. Corrections need explicit supersession/provenance. An imported assessment can replace a previous baseline, so replay logic must specify which completions are already reflected in it.

The supplied CSV records one participation status per record, not every historical state transition. Import it as observed historical facts. Do not synthesize an enrollment → start → completion lifecycle or missing completion timestamps and present that as an observed event history.

## Event-driven behavior proposal

Distinguish catalog activities (`EV_006`) from internal domain events (`ActivityCompletionRecorded`).

```text
User action or agent-proposed command
  -> authorize + validate
  -> one transaction: update state + append action record
  -> recompute affected skills/gaps/candidates synchronously
  -> agent reads evidence bound to the resulting state version
  -> validate recommendation claims
  -> store decision record and publish response
```

Proposed internal events: `DatasetActivated`, `CareerGoalChanged`, `PlanEdited`, `MilestoneEvidenceRecorded`, `HRRecommendationAdded`, `ActivityCompletionRecorded`, `AssessmentImported`, `ParticipationReasonReported`, `RecommendationRecorded`; optionally `AssessmentAttemptScored` if mock testing is implemented. Derived changes need not each become independent authoritative events; calculated skills and gaps can reference the action record that caused the update. A completion button is sufficient to exercise the prototype's required progress loop; do not infer completion merely from a discussion of an activity. User edits do not grant skill levels or silently alter source history.

A separate domain layer lives in the same application and database. For the prototype, the database state is authoritative and the action log is its transactional audit companion. Imported source snapshots plus versioned computations support rebuilding the derived context. Do not claim the audit log alone can reconstruct every historical state.

Bind agent evidence to a dataset and state version. If a completion/import happens during generation, mark the older recommendation stale rather than publish it as current. Repeated completion requests must not duplicate gains. A stored old answer remains inspectable without calling the model again.

Full event sourcing introduces ordering, concurrency, schema-version, and replay work. The [Azure event-sourcing guidance](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing) describes those tradeoffs. The prototype only needs the narrower transactional state-and-audit design above.

## What strict grounding would mean

Separate these evidence classes in tool results and the UI:

- Imported fact: a profile value or participation record.
- Derived fact: a result with source references and a versioned computation.
- Policy: a chosen priority/default, such as prioritizing critical gaps.
- Self-report: an attributed employee statement, if accepted.
- Inference: a hypothesis that exceeds the recorded facts.
- Unknown: information absent or ambiguous in the dataset.

The agent reads authorized, typed tools such as `get_employee_context`, `compare_candidates`, `simulate_completion`, and `get_evidence`. If actions are allowed, it proposes commands to the same handlers used by the UI. It does not directly update skills, silently redefine eligibility, or turn its previous prose into source evidence.

For each decision, store the dataset/state version, policy/computation version, goal/plan versions and their origins, candidate facts, selected and rejected alternatives, cited evidence, model/prompt version, validation result, and the published answer. This is an observable decision record, not a claim to expose the model's private internal reasoning.

Event logging provides traceability of state changes. It does not by itself prevent unsupported text. Strict factual guarantees require constraining material claims to validated fields/reason codes and rendering those facts deterministically. Any free-form interpretation needs separate checks and uncertainty labels; matching a citation ID alone is insufficient.

For meaningful explainability, demonstrate both "Why this activity?" and "Why not that activity?" The recorded comparison must reflect the selection policy used before the answer, rather than generating a plausible explanation after an unrelated ranking.

## Agent readiness loop

```text
inspect current evidence
  -> check requirements for a justified recommendation
  -> if a material answer is missing: ask, persist working state, wait
  -> validate and record the answer with attribution
  -> recompute affected candidate evidence
  -> check readiness again
  -> recommend, or explain why no supported step exists
```

The loop has four small states: `checking`, `awaiting_answer`, `ready`, `blocked`. Asking a question suspends execution until the answer arrives. Resume from persisted structured state rather than rebuilding the employee context from chat prose.

Example working state, with illustrative version IDs:

```json
{
  "employee_id": "E0137",
  "dataset_version": "upload-1",
  "state_version": 12,
  "status": "awaiting_answer",
  "goal": null,
  "self_reports": [],
  "blockers": ["career_goal_missing"],
  "candidate_evidence_ids": [],
  "pending_question": "What would you like to achieve or change?"
}
```

This is ordinary application state, not hidden chain-of-thought or an editable replacement for the source dataset. The agent proposes typed patches. The domain layer checks allowed fields, actor identity, references, and evidence origin before storing them. Computed skill levels, eligibility, source facts, and readiness are not arbitrary agent-editable fields.

Readiness is a code-checked contract:

1. The employee's goal and enough of its intended meaning are known, with an imported or user-provided source. A role/grade target is optional; no silent next-grade default or forced role mapping. A free-form goal can be saved before catalog mapping exists.
2. Required profile, assessment, catalog, and history inputs are valid enough for the affected decision. Source ambiguities are handled by a declared policy or surfaced as blockers if they materially affect it.
3. Relevant milestone criteria, effective skills, any applicable role requirements/critical gaps, candidate eligibility and supported effects have been computed from one current dataset/state/goal/plan version. Do not invent thresholds or gains for unmapped goals.
4. No unresolved constraint or conflicting answer would materially change feasibility or the proposed choice. Optional preferences need not all be filled in.
5. To publish an activity recommendation, at least one useful next step has evidence supporting the applicable explanation factors. Missing history is recorded as missing rather than invented; it does not automatically prevent explaining grade, gaps and target requirements for a role-linked goal. Unsupported goals still permit editing, grounded clarification and attributed HR input, without fabricated activity advice.

After readiness, the agent compares candidates under the agreed policy and proposes 1–3 recommendations. Validate selected IDs, feasibility, numerical claims, and evidence references before publishing. If state changed during generation, re-check against the new state. `ready` means the information supports a justified decision; it does not mean the employee already meets the target grade or that future outcomes are certain.

Ask one or two questions per turn, chosen for their effect on the decision. Do not turn this into a fixed questionnaire or require every optional preference. For example, ask about an earlier no-show when recommending a similar session could repeat the same obstacle; do not assume the obstacle exists or require the employee to justify every absence.

Stop conditions: wait when an answer is required; show missing evidence if the user does not know; return `blocked` with a concrete reason when the catalog offers no useful eligible activity. A failed tool call is an operational error, not missing employee context. Bound automated tool/retry loops and never keep questioning solely to reach a fabricated confidence score.

The readiness checklist and blocker list can be visible in the same evidence panel as the recommendation. The prototype needs one agent with a few tools and a persisted state object, not multiple specialist agents.

Prototype defaults that do not need further architecture decisions: recalculate automatically after a confirmed action; do not automatically enroll people or assert completion; allow a missing-evidence/no-useful-step result; store the published answer and its evidence; provide one source/decision panel instead of a separate observability product. Attribution of self-reports must be preserved when correcting them.

## Proposed proof before trimming

Use an isolated test dataset and an employee not hard-coded in application logic. Verify import → missing-goal question → attributed answer → readiness check → candidate comparison → claim-level evidence → completion command → refreshed gaps → revised decision. Include an already-known goal (no redundant question), an unanswered material question (no premature recommendation), a repeated command, an invalid reference, and a concurrent dataset-version change. Keep model quality tests distinct from deterministic arithmetic/access/import tests.

The next implementation slice should exercise this readiness contract and one complete decision example before investing in route cleanup or UI polish. Extend the proof with an arbitrary goal, milestone edits, a disclosed target-context career transition, an attributed HR suggestion, and a useful response when no supported activity exists. Mock testing remains optional; no assessment claim is valid without its explicit rubric and result evidence.
