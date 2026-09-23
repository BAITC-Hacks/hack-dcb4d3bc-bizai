# Quarterly assessment proposal: findings and requirements

Reviewed 2026-09-23 against the current code, supplied dataset and earlier product decisions. This records the new requirements and recommended implementation clarifications. Implementation checkpoints are recorded separately below; the complete workflow is not yet delivered.

Confirmed after review: approval updates only reviewed skills and preserves other assessment baselines; closed grade modules indicate eligibility for a separate human promotion decision; calibration includes `insufficient_evidence`. These supersede conflicting earlier suggestions. The original quarterly workflow, manager authority, custom HR tasks and module roadmap are the requested extension; recommendations below fill in missing behavior and must not be confused with existing dataset facts.

## Product consequence

The proposal adds a formal assessment workflow to the development product. The shared core becomes:

```text
Employee justification and self-rating
  -> evidence-backed advisory calibration
  -> line-manager decision
  -> approved skill observations and grade modules
  -> next-step recommendations
  -> learning or new work evidence
  -> subsequent assessment
```

Self-rating, AI advice, manager approval and activity-derived progress are distinct records. Their separation is the central product requirement. The original career-development demo must still work for imported profiles without requiring a new quarterly review first.

## Findings that change the specification

| Finding | Implication |
| --- | --- |
| `feedback_rating` is the participant's rating of an event | Use it for experience/preferences, never as a manager/peer assessment of the employee. |
| History has no workplace artifacts, assessor comments or reason for absence | A completed course or no-show does not prove job-level competence or its absence. Justification is initially self-reported evidence. |
| The dataset has a generic 0–5 proficiency scale, not per-skill assessment rubrics | AI calibration is advisory comparison with stated anchors. Do not claim a validated score-to-level measurement. |
| `employees.skills` is a last-assessment snapshot | Import it as a baseline with source attribution. The dataset does not identify its approver or certify it as a manager-approved review. |
| Current replay uses one employee-wide `last_review_date` | A partial review can lose gains on unreviewed skills or double-count incorporated gains unless assessment cutoffs are explicit. |
| `SK_MENTORING` is one general skill; 26 profiles have an assessed value of at least 3 | Mentoring capability does not establish expertise in each requested skill. Domain expertise needs its own requirement. |
| There are 16 referenced managers and 8 employees with `manager_id = null` | A manager capability, direct-report scope and a designated-reviewer path for department heads are missing. A manager is still an employee for their own development. |
| The skill catalog has 13 categories | The four requested tracks need a complete explicit mapping; their labels do not directly match the source categories. |
| `events.json` has no employee assignments, deadlines, artifact requirements or approver fields | Custom HR tasks need application-owned definitions/assignments around the catalog contract. |
| The app has only employee/HR sessions and no review writes | Quarterly cycles, manager decisions, task authoring and approval permissions are new implementation work. |

The source categories are `engineering`, `frontend`, `quality`, `data`, `product`, `hr`, `sales`, `support`, `communication`, `leadership`, `collaboration`, `thinking`, and `personal_effectiveness`. Preserve them. A proposed display-only mapping is below; this is a product choice, not a taxonomy supplied by the dataset. Unknown categories need a visible fallback and validation notice so no skill disappears.

| Requested track | Source categories (proposed) |
| --- | --- |
| Engineering Skills | `engineering`, `frontend`, `quality`, `data` |
| Leadership | `leadership`, `thinking`, `personal_effectiveness` |
| Communication | `communication`, `collaboration` |
| Domain | `product`, `hr`, `sales`, `support` |

## 1. Review cycle and versions

Proposed records: `ReviewCycle`, per-skill `ReviewItem`, attributed `EvidenceReference`, `CalibrationResult` and `ManagerDecision`. Keep these in the current database; they do not require new services.

Each cycle needs employee, year/quarter, review period, target role/grade, the selected role-profile version, assigned reviewer, revision, status and timestamps. A quarter label alone is insufficient: establish whether the cycle assesses the completed quarter or the current quarter, and use the dataset's business date consistently in the demo. A free-form goal can coexist with this cycle; it must not be forced into a grade.

```text
draft -> submitted -> ai_reviewed -> manager_approved
                                  -> returned -> draft (new revision)
```

`submitted` can cover calibration in progress. Store a separate processing mode/error field. A timeout produces a visibly labeled deterministic fallback; the status name `ai_reviewed` must not imply an LLM ran when it did not. A neutral name such as `calibration_ready` is preferable if revising the proposed enum.

- Each relevant skill requires a 0–5 rating and a nonblank, non-whitespace business justification before submission. UI and server enforce the same rule.
- Preserve what was submitted. Returning a cycle creates an editable new revision; it does not erase the previous employee statement, AI output or manager comment.
- Freeze the evidence snapshot and target requirements for the submitted revision. An answer generated for an old revision cannot be attached to a new submission or approved as current.
- A calibration challenge needs an answer path before manager approval: employee clarification creates a new editable revision, then resubmission reruns calibration. Do not force an employee to wait for a manager return just to answer the agent. Accepted revisions remain immutable.
- Make submit, calibrate and approve idempotent. Concurrent approvals or changed reviewer assignments must not produce two different accepted outcomes silently.
- Do not fabricate an automatic recurring scheduler for the prototype. Manually opening a named quarterly cycle is sufficient unless scheduling is explicitly needed.

## 2. Calibration and evidence sufficiency

The agreed verdict set is `overrated | aligned | underrated | insufficient_evidence`. Never map a timeout, missing record or weak justification to `aligned` just to finish the response. Insufficient evidence produces targeted questions and a visible evidence gap.

A self-rating above the previous assessment may reflect actual growth. It is not automatically overrated. A no-show does not negate demonstrated competence. A strong claim requires evidence connected to the skill and proficiency anchor; a challenge asks for that evidence without asserting the employee is dishonest or incapable.

Example strict result contract with illustrative record IDs:

```json
{
  "review_revision": 2,
  "skill_id": "SK_SYSTEM_DESIGN",
  "verdict": "insufficient_evidence",
  "evidence_status": "insufficient",
  "confidence": null,
  "engine": "llm",
  "evidence_refs": ["review-item:42:justification", "assessment:17"],
  "missing_evidence": ["An independently delivered design and its outcome"],
  "questions": ["Which design tradeoff did you own, and what changed as a result?"],
  "rationale": "The claim describes participation but does not establish independent ownership."
}
```

Every referenced fact must exist in the frozen, authorized evidence bundle. Every submitted skill must have exactly one result or an explicit unavailable state; validate missing, duplicate and unknown skill IDs. Schema-valid JSON alone does not validate the rationale. Material numbers and claims still require source checks.

If retained, model `confidence` is an uncalibrated diagnostic, not probability that the employee's rating is right. It must not change the final rating or determine promotion. Deterministic fallback can expose numeric disagreement with a baseline, missing justification and standard evidence questions. It cannot validate free-text business results or substitute for a human assessment.

Store model/prompt/policy versions, evidence references, processing mode, validation result and latency. Keep the employee's statement, AI advice and manager decision inspectable together. HR edits or later reviewer decisions do not rewrite what the AI originally advised.

Use one total response deadline, including tool calls, output validation and any retry; a 10-second timeout for each separate attempt would violate the 10-second response requirement. Cancel or ignore late results for expired/changed revisions. Keep the deterministic result available to the manager. Insufficient evidence blocks a confident AI conclusion, not the manager's ability to review the case and record a reasoned human decision.

## 3. Approval and skill arithmetic

Use separate concepts:

```text
assessment level: imported baseline or latest approved observation
effective level:  assessment level plus eligible activity gains after its cutoff
module status:   supported by accepted assessment evidence at the required level
```

For new cycles, an AI verdict and a self-rating never directly set the assessment baseline. The manager records final ratings and a comment. Recommended rule: changed ratings have an explicit reason. Approval validates the actor and current review revision on the server.

**Partial-review trap:** imagine System Design is reviewed but Python is not. Advancing a global cutoff to the approval date without updating Python's baseline discards Python gains that previously counted. Adding the new System Design rating while replaying gains it already incorporates double-counts those gains.

**Agreed policy: assess only reviewed skills.** Store per-skill assessment values and evidence cutoffs in application-owned state; preserve other skills' baselines/cutoffs. Do not mutate the raw imported profile or advance its employee-wide cutoff as though all skills had been reviewed. A user-facing latest-review date may advance as metadata, but it must not become the computational cutoff for unreviewed skills.

Record `evidence_as_of` separately from `approved_at`. If submission and approval are days apart, identify whether intervening activities were included before advancing any cutoff. Replay only gains after the assessment's declared evidence cutoff. Preserve an imported provenance label rather than inventing an approval record for the historical assessment.

Illustrative arithmetic, not a claim about a supplied employee: both skills start at 2 on June 1; a June 20 completion adds 1 to each; System Design is assessed at 3 with evidence through July 1; a July 5 completion adds 1 to System Design; approval occurs July 10. All gains have a cap of 5.

| Policy after approval | Effective System Design | Effective Python |
| --- | --- | --- |
| Per-skill cutoff: System Design July 1; Python June 1 | `3 + 1 = 4` | `2 + 1 = 3` |
| Incorrect: move both cutoffs to July 10 | `3` — loses the July 5 gain | `2` — loses the June 20 gain |
| Incorrect: new System Design baseline with old June 1 cutoff | `3 + 1 + 1 = 5` — counts June 20 twice | `3` |

If System Design requires level 4, the correct effective level is 4 but its approved level is 3: the formal module is still open and ready for reassessment. Prevent an older cycle approved later from silently replacing a more recent skill assessment; reject that stale baseline write or require an explicit correction flow outside the initial prototype.

Returns need a mandatory explanation and no skill update. Department heads with no manager need an explicitly designated authorized reviewer; disallow self-approval. If managers change, reassign the pending cycle with attribution and revoke obsolete approval access.

## 4. Grade modules and progress

This updates the earlier blanket rejection of aggregate percentages: the new requested metric is a specifically defined count of closed grade modules. Keep arbitrary personal milestones editable alongside the formal role-based roadmap.

```text
module closed = accepted assessment level >= required minimum
grade coverage = closed modules / all required modules
critical blockers = required critical modules that remain open
```

Label the number as module coverage. With critical skills included in the denominator, 100% total coverage necessarily means those modules are closed; “100% of the other modules” is a different denominator. Show critical blockers explicitly even when noncritical coverage is high.

Completion gains can support recommendations and demonstrate progress toward reassessment without immediately closing an assessment-gated module. The UI should distinguish “effective level meets requirement; approval pending” from “confirmed by assessment.” Imported assessment values can initialize a separate source-labeled baseline according to an explicit acceptance policy; they are not invented manager decisions.

Closing modules marks readiness for a promotion decision. Changing the recorded grade is a separate human decision, confirmed by the user. Module arithmetic is not employer authorization.

Event prerequisites specify skill thresholds, not dependencies between events. Construct a proposed order from how candidate gains can satisfy thresholds. Never infer that one specific course is mandatory merely because it is one way to reach a prerequisite. Preserve alternative paths and allow a truthful catalog gap.

## 5. Mentors and external resources

Recommended mentor rule: enough assessed expertise in the target skill plus `SK_MENTORING >= 3`, excluding self-mentoring. The required expertise level and whether effective evidence can qualify must be explicit. The dataset lacks availability, consent, contact channels and per-skill mentoring history; present candidates as potential mentors, not confirmed appointments or experts validated by the system.

Internal discovery order can be catalog activities, HR-authored tasks and authorized mentor candidates. Expose only directory information intended for employee discovery, not another employee's self-rating, calibration verdict or complete assessment record. Define an opt-in/HR-approved mentor directory before widening employee visibility.

External search results need title, publisher, actual URL, retrieval date, supported relevance and a distinct external-source label. Use reliable primary resources where possible. Search with generic skill/level terms; do not send private business justifications or employee identities to a search engine. External learning suggestions do not receive catalog gains or close a module without an explicit evidence/assessment policy.

External searches plus per-skill model calls may exceed 10 seconds. Prefer a bounded calibration request over a compact evidence bundle, with batch/chunk strategy verified against actual review sizes. Give the user a bounded result/fallback; external enrichment can be a separate visible step. Do not pretend external search completed when it timed out. Provider/timeout behavior needs measurement, not an assumed guarantee.

## 6. Custom HR tasks

Reuse the activity contract for ranking, but separate a definition from assignments to individual employees. Add application-owned metadata: author, definition version, linked skills, success criterion/evidence requested, assigned employees/audience, deadline, status and whether contributions mean rule-based gains or evidence for reassessment.

The judge's original import schema remains supported unchanged. A task assigned by HR is not automatically `mandatory`; decide this explicitly. Mandatory tasks belong in an obligations view and remain outside voluntary development recommendations.

An HR task such as a presentation can collect evidence for a module. Its completion cannot set the final rating. If a synthetic gain rule is explicitly configured, it changes effective skills only and must be disclosed. Do not quietly equate a task's linked skill with a validated gain amount.

Version edited tasks: later changes to requirements, deadline or gain must not alter the meaning of earlier completions. New custom IDs must not collide with imported catalog IDs.

## 7. Recommendation changes

Open modules drive the next-step recommender. Prioritize critical gaps. A challenged self-rating can produce an evidence-collection action or manager discussion before suggesting more training; it is not proof of a larger numerical skill gap.

Separate two intents: `learning` and `evidence_collection`. For example, someone with strong real experience but insufficient recorded proof may need to present a design artifact, not repeat a course. Preserve the employee's ability to edit their development plan while keeping formal review requirements intact.

Calibration compares a claim with evidence; development compares assessed/effective skills with the chosen target. Keep their outputs independent:

| Calibration outcome | Development consequence |
| --- | --- |
| `aligned` at 2, target requires 4 | No calibration challenge, but the target gap still needs a development step. |
| `underrated`, stronger evidence supports the claim | Surface the evidence for the manager; recommend learning only if a remaining target gap exists. |
| `overrated` or `insufficient_evidence` | Ask for a concrete demonstration or missing proof; do not automatically increase the numerical gap or prescribe remedial training. |

“Aligned: no action” therefore means no calibration intervention, not no development recommendation. Level 5 has no next level on the supplied scale. Never suggest training toward an invented level 6 or an activity whose gain cap cannot help the relevant gap.

Behavioral history refines suitable formats, with its source and uncertainty visible. Do not infer personal motives or a calibrated probability of success from missed activities. Approved assessments, new tasks, goal changes and completion events invalidate only the relevant decision context.

## 8. Access and localization

Self-assessment and calibration are visible only to the subject employee, their authorized assigned/direct manager and HR. Implement this on every read/write/tool endpoint. A manager capability is derived from authorized reporting relationships, not merely a `Lead` grade or a client-selected role label. Prevent employee mutation of manager ratings and manager access outside their scope.

Use stable internal enums/IDs with localized labels. Generated questions and explanations use the subject employee's preferred language; preserve original justification text and language. Manager/HR interface locale may differ from the employee's. Existing locale-cookie behavior needs a deliberate precedence rule with profile preference; translation must not change ratings or evidence IDs.

No public rankings or peer comparisons. The role picker remains demo identity selection and must not be described as production authentication.

## Proposed prototype milestone

Build one full quarterly cycle for one employee and their manager, with a role-linked goal: self-assessment → evidence clarification/calibration → manager approve/return → correct skill baseline and modules → a grounded next step. Reuse the existing app, database and evidence panel. Preserve the original import/recommend/complete demo and free-form planning.

Then add one authored HR task, mentor discovery and external-resource enrichment in that order. Do not build every extension before proving approval arithmetic and evidence traceability.

Acceptance must cover missing/whitespace justification, insufficient evidence, both approval and return, stale review revisions, partial assessment replay, duplicate approval/completion, unauthorized reviewers, critical blockers, missing-manager routing, unavailable AI, preferred-language output and no public comparison. Tests should compare real before/after skill values, not only status transitions.

## Source pointers

- [Dataset contract](../case_source/case_1/career_quest_dataset/README.md): assessment date, activity gains, history dates and the meaning of `feedback_rating`.
- [Skill and role catalog](../case_source/case_1/career_quest_dataset/skills.json) and [employee profiles](../case_source/case_1/career_quest_dataset/employees.json): categories, mentoring skill and reporting relationships.
- [Current skill replay](../lib/career/skills.ts) and [current access model](../lib/server/access.ts): global cutoff, implicit target and employee/HR-only authorization.


## Implementation checkpoint — review records

Implemented drafts and submissions on `/employee/reviews` and `/api/reviews`; managers use their employee session and current direct-report relationship, while HR has read-only access. The subject alone edits their self-assessment. One cycle per employee/quarter is opened against the saved target. All required target skills must have integer self-ratings 0–5 and nonblank justifications on submission. Drafts may remain incomplete. Requirements and scale descriptions are frozen at creation; relevant history, catalog rules and assessment baseline are captured at submission with source revision/date. The evidence snapshot may contain history outside the named quarter and must not later be interpreted as proof of performance during that quarter.

Submission and reopening append versions. Identical immediate retries are idempotent; stale changes fail. The original submission survives a new editable revision. Ordinary imports/completions preserve review history, while demo reset starts a new review scope without exposing earlier records. No final ratings or global/per-skill cutoffs are written. AI calibration, approval/return, assigned reviewer overrides for employees without managers, and reviewed-skill overlays remain pending. The current manager can inspect a reassigned report; the stored reviewer ID describes the historical revision, not an authorization grant.


## Delivery checkpoint — 2026-09-23

HR and the current direct line manager now have alternative approval/return authority; this supersedes earlier HR read-only wording. Approval stores final ratings for reviewed skills only, with per-skill cutoffs and immutable decision history. Promotion remains separate. Calibration is not yet implemented and is visibly marked `not_run`; the current approval path is explicitly human-only. See `reviews/hr-approval-implementation.md` for behavior and limitations.
