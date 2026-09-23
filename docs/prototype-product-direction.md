# Prototype product direction

Confirmed by the user on 2026-09-23. This supersedes conflicting proposals in the earlier corporate discovery checklist. It records product decisions and implementation guidance; the full behavior described here is not implemented yet.

**Subsequent extension:** [quarterly review requirements](quarterly-review-requirements.md) adds justified self-assessments, advisory calibration, manager approval and formal grade modules. Approval affects reviewed skills only; calibration may return `insufficient_evidence`; closed modules indicate eligibility for a separate promotion decision. The requested closed-module ratio is an exception to the earlier percentage restriction for formal grade roadmaps. Arbitrary goals and employee-owned plans remain supported. Use [the next-stage plan](next-stage-plan.md) for delivery order and [the Russian memo](product-memo.ru.md) for the team overview.

## Purpose

Make development decisions understandable: what the system knows, what it does not know, why it suggests an action, how the employee can change it, and what happens afterward. Explainability, visibility and observability are the product core. SAP SuccessFactors is inspiration only; integration, parity and certification are outside the prototype scope.

Use natural language to make the evidence readable. Every material recommendation, requirement, calculated effect and completion claim must have a valid basis. AI-generated prose is not a source of truth.

## Confirmed product decisions

| Area | Direction |
| --- | --- |
| Goals | Employees can create arbitrary goals, accept suggestions, edit goals or change direction. A role/grade target is optional. |
| Plan ownership | The system and HR can suggest plans. The employee can change, reorder, remove, pause or replace milestones and actions at will. |
| Progress | Personal plans use meaningful milestones and evidence. Formal grade roadmaps additionally show closed required modules / all required modules, with critical blockers; neither indicates promotion probability. |
| Skill evidence | Use the supplied mock assessments and event-gain rules for the initial prototype. Preserve their provenance and limitations. |
| HR | Authorized HR can view all employee development information held by the prototype and add attributed recommendations. |
| Career mobility | Cross-role exploration and changes of direction are first-class. Existing skill evidence transfers across goals. |
| Testing | A course-free way to demonstrate a skill is a possible extension; it needs an explicit assessment definition and scoring basis. |
| Reliability | Always return an understandable state and an available interaction. Never fill missing evidence with invented advice. |

## Arbitrary goals, grounded plans

Retain the employee's original wording. Goals can concern a role change, a specific capability, a project outcome, or another aspiration. Do not force every goal into a catalog role or the 0–5 skill scale. Multiple goals may coexist; the employee chooses the focus for recommendations.

```text
Employee goal, in their own words
  -> candidate interpretation, linked to known evidence where possible
  -> clarify only ambiguities that change the proposed plan
  -> employee-editable milestones with explicit success criteria
  -> catalog actions or user/HR-authored actions, with attribution
  -> evidence of progress and an explanation of changes
```

A suggested goal must reference something real, such as an imported aspiration, an employee statement, a role requirement or an observed gap. Present it as a choice, not an inferred personal ambition. A valid imported goal is usable without asking the employee to repeat it.

For a goal outside the supplied roles or skills, keep the goal and support planning. Do not invent a role profile, a skill threshold, a course or a completion guarantee. The system can help the employee define what success would look like; it must label that criterion as employee-defined, not as an employer requirement. Planning questions are grounded in the actual missing information.

User-authored milestones and HR suggestions can be retained even when they have no catalog mapping. Their text is an attributed proposal, not verified guidance; do not assign predicted skill gains or imply endorsement without evidence. Arbitrary text remains data, never instructions to the recommendation engine.

For role-linked goals, use actual target requirements and critical gaps. For other goals, explain the supported link from an action to the employee's stated criterion, and identify any unverified part. The original jury role-profile scenarios must still satisfy their multi-factor explanation requirement; never invent a next-grade requirement just to fill an explanation slot for an unrelated goal.

## Personal milestones and formal grade modules

A milestone describes an outcome, what counts as reaching it, and the evidence available. It is not merely a renamed course. Several activities may contribute to one milestone; one activity may contribute to several milestones.

Proposed milestone information:

- A short outcome statement and explicit success criterion.
- Origin: employee, HR, AI suggestion or imported requirement.
- Optional skill/role references and dependencies.
- State: suggested, planned, in progress, evidence needed, reached, blocked or paused.
- Supporting facts and actions, plus unresolved conditions.
- Attribution of any manual completion claim.

Show ordinary-language labels such as “Already demonstrated,” “Next step,” “Evidence needed” and “No matching activity available.” Keep per-skill levels and gaps available as evidence. Course `completion_pct` remains part of the import contract; the rejected percentage is the aggregate career-readiness indicator.

The later quarterly-review request introduces a separate formal module for each required skill of a chosen role/grade. Its completion depends on accepted assessment evidence, not a personal checkbox or course completion alone. The module-count ratio is allowed; it does not restore the old formula based on partial skill coverage. Formal requirements cannot be edited away by changing a personal plan.

An employee can edit the plan at will. Edits cannot rewrite imported history or create assessed skills. If a removed step was a prerequisite, explain the affected milestones and recompute supported options. Reordering a list does not satisfy a prerequisite. Replanning proposes changes; it must not silently restore a step the employee removed.

Marking a personal milestone reached records an attributed employee claim. A milestone claiming a specific assessed skill level requires the relevant evidence. Completing one activity does not imply completion of every linked milestone or the overall goal.

## Mobility and transferable skills

Changing the intended profession must not reset skills, require a promotion sequence, or hide other professions. Show what carries over and which target requirements still lack evidence. Reuse the same `skill_id` evidence across role profiles; similar names alone do not establish equivalent skills.

Keep recorded current employment separate from chosen career direction. A new aspiration changes the development plan immediately; it does not silently rewrite the imported job record or certify a new professional qualification.

The following is a proposed implementation policy for the user's mobility requirement, not a claim about the original case's enrollment rules:

1. Allow exploration of all supplied role profiles, and free-form goals outside them.
2. Evaluate catalog audience against either the recorded current role/grade or an explicitly chosen target role/grade. Match a complete pair; do not combine the current role with an unrelated target grade.
3. If an activity is available under the target context only, explain that it is included through the prototype's career-transition policy and show its catalog audience. Do not claim real employer enrollment permission.
4. Continue checking actual skill prerequisites, session availability, completion/repeatability rules, active participation and voluntary status. Do not infer missing target grades or grant prerequisite waivers.
5. Explain catalog gaps and let employees/HR contribute a proposed next action. Do not invent an external provider or assert the new action's effectiveness.

This explicitly replaces the earlier current-role-only design proposal. Keep source audience data unchanged and record the policy version used in each decision so the extension is visible to the jury.

## Demonstrating a skill without taking a course

The supplied dataset includes skill definitions, generic proficiency descriptions and some course assessment scores. It does not include test items, answer keys, per-skill assessment rubrics or a score-to-level conversion. Existing course scores cannot independently establish a new skill level without such a rule.

If included, the assessment extension must have:

- A named skill and the limited capability being assessed.
- A versioned mock task/question set, answer key or rubric, and explicit pass criteria.
- A declared mapping from the result to the skill evidence it supports.
- An attempt record, scoring evidence, result and timestamp.
- A clear label that it is prototype assessment evidence, not a validated professional certification.

A passed assessment supplies a skill observation, not a course gain. Establish the affected skill's assessment baseline/cutoff and apply only subsequent eligible activity gains; do not double-count previous learning or increment the skill on repeated submissions. Preserve old evidence and surface conflicting assessment results instead of silently treating the highest score as truth.

An LLM may draft tasks, but drafting does not validate the rubric or prove that a quiz measures a proficiency level. Do not advertise an available test until it exists and has a supported scoring path. Until then, use the case's existing evidence and show “assessment not available” where relevant. Assessments are optional scope and must not delay the core explanation/milestone loop.

## HR visibility and recommendations

Authorized HR can inspect every employee's prototype development record: goals, plan versions, skills, participation, accepted self-reports, relevant conversation records, recommendation evidence, assessment results and change history. This supersedes the earlier read-only HR-detail proposal. Employee access remains scoped to their own record.

HR can add or revise its own attributed suggestions, comments and proposed milestones/actions. Those proposals remain distinguishable from AI suggestions, source facts and the employee's adopted plan. The employee can accept, change or dismiss a suggestion; recommendation authority does not imply forcing plan changes or rewriting skill evidence.

Show employees who can see their development information. Broad HR visibility covers application records, not credentials, raw provider secrets or hidden model reasoning. Expose stored explanations and decision evidence.

## Explainability, visibility and observability

Each recommendation or supported next step should answer:

| User question | Product response |
| --- | --- |
| What did you understand about my goal? | Original goal and the interpretation used for this plan. |
| Why this step? | Relevant milestone, source evidence, constraints and supported expected effect. |
| Why not that alternative? | Actual eligibility failure or selection tradeoff; no invented motives. |
| What do you not know? | Specific missing evidence and whether it affects the decision. |
| What changed? | Before/after facts, actor, action and affected milestones/recommendations. |
| What is happening now? | Real states such as checking evidence, waiting for an answer, preparing suggestions, complete or failed. |
| Who made this claim? | Source record, employee statement, HR suggestion, computation or model proposal. |

Use progressive detail: a short explanation, expandable evidence and a change timeline. Do not make users understand database schemas or model traces to understand their plan.

The underlying record should retain action/decision IDs, actor, timestamps, dataset/state/goal/plan versions, evidence references, policy version, validation outcome and relevant latency/failure information. Record recommendation changes and the reason that triggered them. Users see meaningful outcomes; debugging details can remain expandable and access-scoped. These are observed actions and supported rationale, not hidden chain-of-thought.

## “Always work” without unsupported output

This is a behavioral contract, not a promise that every goal has a known route or that infrastructure never fails.

| Situation | Useful, truthful response |
| --- | --- |
| Enough evidence and an eligible useful activity | Publish validated suggestions with milestones and source-backed effects. |
| Material information missing | Ask a focused question and retain the editable plan. |
| Goal outside the catalog | Preserve the goal; identify the unsupported part and offer to define a personal milestone or request HR input. |
| No suitable activity or assessment | Explain the exact catalog/prerequisite limitation; show existing evidence and allow a user/HR-authored proposal. |
| AI output fails validation | Withhold the invalid advice; explain the issue and keep deterministic facts and editing usable. |
| AI unavailable | Keep the plan, evidence and edits usable; offer retry and, only where sufficient evidence exists, clearly labeled rule-based suggestions. |
| Data or permissions unavailable | Explain the operational/access problem; do not recast it as missing employee competence. |

A next interaction need not be a course recommendation. “Choose how you want to define success” can be useful when the evidence supports no educational advice. No silent switch from evidence-backed output to generic career tips.

Use typed claims, referenced evidence, rule-derived values and controlled rendering for material facts. Natural-language generation can help clarify input and propose supported wording; validate before publication and fall back to factual templates when necessary. A second model saying “looks correct” is not a factual guarantee. Unsupported interpretations and invented motives must not appear as guidance.

## Acceptance examples for the next implementation

1. An employee creates a free-form goal with no role/grade. The system preserves it, clarifies only material ambiguities and does not invent standards or courses.
2. A role-linked goal produces milestone suggestions linked to actual requirements and at least three relevant explanation factors where required by the case.
3. An employee changes career direction. Shared skill evidence is preserved; requirements and candidates update; target-context audience policy is disclosed.
4. An employee removes or reorders a suggested action. Their edit persists and dependent milestones explain any resulting blocker.
5. HR sees the complete authorized development record and adds an attributed suggestion. It does not silently replace the employee's plan.
6. A mock activity completion updates its rule-derived skills and supported milestones exactly once. The timeline explains the change and recommendations become stale or refresh appropriately.
7. An unsupported goal, missing catalog route, invalid model answer and AI outage each produce an honest state with an appropriate remaining interaction.
8. If a mock assessment is implemented, passing it records limited skill evidence without requiring a course or double-counting past gains; an unsupported test/skill mapping grants no level.

## Implementation status boundary

This turn updates design documentation only. Existing application code still has role/grade-shaped goals, current-role-only audience checks and an aggregate coverage calculation. Arbitrary goals, editable milestone plans, HR-authored recommendations, target-context eligibility and skill assessments need implementation. See [implementation status](implementation-status.md) for the delivered foundation.
