# Next stage: explainable development plans

Review date: 2026-09-23. This is the current delivery sequence, updated for the subsequent quarterly-assessment request. The [product direction](prototype-product-direction.md) and [quarterly review requirements](quarterly-review-requirements.md) define intended behavior; the [explainability design](explainability-design.md) defines evidence and agent boundaries. The separate [Russian team memo](product-memo.ru.md) summarizes product features.

## Review conclusion

The six-route foundation is delivered at the repository root in commit `3d34cb4`. The next milestone now links a quarterly assessment to development: an employee justifies skill ratings, receives advisory calibration, obtains a manager's approve/return decision, sees the affected grade modules, and receives an evidence-backed next step. Keep the original unseen-profile → goal → recommendation → completion scenario usable without requiring a new review first.

The immediate dependency is the assessment/evidence contract and manager access, alongside persistent goal/plan state. Approval updates only reviewed skills, promotion remains a separate human decision, and calibration can return `insufficient_evidence`. Connecting an LLM to the current profile screen alone would preserve obsolete defaults and cannot safely update assessment baselines.

## What the review found

| Finding | Evidence | Consequence |
| --- | --- | --- |
| Foundation is implemented | Root app, SQLite repository, six pages and three API handlers | Do not repeat the starter-trimming phase or move the app again. |
| Missing goals still default to next grade | `lib/career/skills.ts`, `development()`; `tests/domain.test.ts` explicitly tests that default | Replace the default with goal clarification and change the test expectation. |
| Progress is still aggregate coverage | `development()` returns `coverage`; the development panel renders it | Introduce milestone outcomes/evidence. Preserve per-skill levels and imported course completion percentages. |
| Goal data is still role/grade-shaped | `employeeSchema.career_goal` | Keep the jury schema stable. Store free-form employee goals and editable plans separately. |
| Activity audiences use current employment only | `lib/career/eligibility.ts` | Implement the documented, disclosed target-context policy for cross-role exploration; preserve real prerequisites. |
| Import UI supports merge and fixture reset | `app/api/data/route.ts`: `preview`, `apply`, `reset` | A full judge-supplied dataset replacement is still missing. Reset is not replacement. |
| Durable consultation/audit state is absent | `lib/server/database.ts` currently creates dataset and session tables | Add the minimum persistent goal, plan, consultation, decision and action records needed for the loop. |
| AI and completion are not implemented | No relevant API handlers; the UI explicitly shows `Not generated` | These are the central next-stage deliverables, not optional UI enhancements. |
| Quarterly reviews and manager permissions are new | The actor type has only employee/HR; there are no review/approval records | Add direct-report access, review revisions, per-skill observations and explicit evidence cutoffs before approval writes. |
| Older sequencing is stale | Trimming plan still describes phases 1–3 as future work | Use this plan for current ordering and retain trimming details as history. |
| Latest UI/localization changes are in the working tree | Locale modules, dictionaries, page changes and a new locale test | Preserve them. Recheck compatibility during integration; this review does not certify their runtime behavior. |

The old status sentence saying nothing had been committed was stale; the foundation has a commit. Earlier verification results describe the foundation run, not a fresh test of today's working tree.

## Ordered delivery slices

### 1. Establish assessment, goal and plan state

Define the smallest persistent review cycle, per-skill self-rating/justification, evidence references, calibration result and manager decision. Add authorized manager capabilities without removing that person's own employee workspace. Cover absent managers and prevent self-approval. Keep source data immutable and new approved observations in an overlay with per-skill evidence cutoffs; unreviewed skills keep their baselines.

Add application-owned goals, focus selection, milestone plans and a small consultation state. Preserve original goal wording and the origin of imported goals. A valid existing goal can be used immediately; an absent goal must produce a question. A free-form goal can be saved without a role mapping.

Personal milestones need an outcome, success criterion, origin, state, optional evidence/dependencies and editable actions. The employee can edit, reorder, pause or remove them. Edits do not alter assessments or history and do not grant skills. Replace the old aggregate partial-skill-coverage UI with personal milestones and a separate formal grade roadmap. The newly requested grade metric is closed required modules / all required modules, with critical blockers visible; it is not the old partial-coverage formula or a promotion probability.

**Exit:** an employee without a goal is asked; free-form goals/edits persist; a review with any missing justification cannot be submitted; a manager can access only authorized reports; assessment facts and self-reports remain distinct. No activity advice is published before readiness.

### 2. Implement the evidence and consultation loop

Add a bounded calibration request returning one validated result per submitted skill. Verdicts are `overrated`, `aligned`, `underrated` and `insufficient_evidence`. Preserve the submitted review/evidence revision. A challenge requests concrete missing proof; the model cannot set final ratings. On timeout, display a deterministic comparison/evidence-check result with its mode labeled. Model confidence is not a calibrated probability.

Use one agent with typed tools for current context, candidate comparison, evidence retrieval and validated state updates. Keep a deterministic readiness check with `checking`, `awaiting_answer`, `ready`, and `blocked` states. Ask one or two questions only when their answers could change the decision.

Build evidence from a consistent dataset/state/goal/plan version. Preserve source IDs, assessed versus computed skills, relevant participation rows, explicit constraints, self-reports, candidate exclusions, supported gains and the selection policy. Prioritize the chosen goal and critical gaps where relevant. Compare alternatives before publishing the rationale.

For role-linked jury cases, return 1–3 eligible, useful activities with at least three relevant explanation factors. Free-form goals remain valid even when the catalog cannot support activity advice. Show a precise limitation and retain goal/plan editing or an HR suggestion path.

Choose/configure a provider behind a small server adapter; provider choice must not change the evidence contract. Validate selected IDs and material claims. Keep operational failure distinct from missing employee information. UI facts must remain usable during an AI error, and per-response latency must fit the brief's limits.

**Exit:** an unseen profile receives a grounded comparison after any necessary clarification. Every material fact is inspectable, an unsupported answer is withheld, and a relevant state change makes an older answer visibly stale.

### 3. Approve assessments and close the development loop

Implement manager approve/return with comments, revision checks and idempotency. Update only the reviewed skill observations and their declared evidence cutoffs. A return preserves the earlier submission and creates a new editable revision. Activity gains already included in an assessment must not be counted again; gains for unrelated skills must not disappear.

Formal modules close against accepted assessment evidence at the required level. Effective activity-derived progress can show that reassessment is warranted without falsely claiming approval. All modules closed means eligibility for a human promotion decision, not an automatic job-record change. Keep critical blockers visible and map all 13 source categories deliberately to the requested tracks.

Add idempotent completion commands with their own completion timestamps. Preserve historical replay semantics and recompute skills from the assessment baseline plus eligible subsequent completions. Keep simulated/business dates distinct from operational timestamps so the fixed dataset clock does not accidentally exclude a new demo completion.

Record state changes and their action/actor evidence together. Synchronously recompute affected skills, milestones and candidates; invalidate old recommendations. Complete an activity once even if a request is retried. A personal milestone marked reached is attributed self-report; a catalog completion applies its actual gain rules. Neither implies the whole goal was achieved.

Expose a compact before/after timeline and HR missing-step reasons: awaiting information, prerequisites unmet, catalog gap, not generated, and operational failure. Add attributed HR suggestions that the employee can adopt, edit or dismiss; they must not overwrite the adopted plan automatically.

Let next steps address either learning or evidence collection. A challenged self-rating is a reason to clarify or demonstrate a capability, not an automatic numerical penalty or a requirement to repeat a course.

**Exit:** a completion changes the correct skill evidence once, the employee can inspect why, HR sees the update, and an HR suggestion stays separate from the employee's adopted plan.

### 4. Add internal interventions and bounded external enrichment

Add one HR-authored activity/task with skill links, assignment scope, deadline and an explicit contribution type: learning gain or evidence for assessment. Keep authored definitions and employee assignments versioned without changing the original import contract. HR assignment does not automatically make a task mandatory, and completing a task cannot set an approved skill rating.

Mentor candidates need both general mentoring ability and sufficient domain expertise, with a defined directory/permission boundary. Internal records lack availability and per-skill mentoring histories. External resources follow internal search and carry real URLs, publishers and retrieval metadata; they receive no invented skill gain. Resource search can be a separate visible step to keep calibration responses within the 10-second budget.

**Exit:** a manager challenge can be addressed through an internal evidence task; mentor suggestions do not expose private reviews; any external material is sourced and distinguished from company requirements.

### 5. Complete imports and prove both demonstration paths

Extend the existing importer to explicit full-package replacement as well as employee/history merge. Preserve the known input formats. Validate the complete staged result before activation, keep source/version references, and invalidate all affected context on activation. Dataset-scoped goals, conversations and self-reports must not leak across unrelated replacement datasets with reused employee IDs.

Keep the existing shell and routes where practical. Embed conversation, modules, evidence and review forms in development screens; add only the smallest manager work queue/detail surface needed for scoped approval. Integrate current locale support. Questions/explanations use the subject employee's preferred language, with a defined precedence for explicit locale selection.

Finish one-command packaging, configuration instructions, a repeatable demo/reset path, and focused acceptance checks. The final record must distinguish tests actually run on the integrated tree from historical results.

**Exit:** a clean launch accepts unfamiliar profiles and a replacement package, supports the full interaction, and handles invalid input, no candidates, missing goals and provider failure visibly.

## Demonstration that defines completion

1. Import an unseen employee with a missing goal. No next grade is silently assigned.
2. Establish the employee's goal through conversation. Show what is known and which material question remains.
3. Inspect/edit a milestone and compare the recommended activity with a rejected alternative using actual evidence.
4. Change a relevant preference or career target. Preserve skill evidence and employee edits; explain the changed recommendation.
5. Record completion, retry the request, and inspect one skill change and the affected milestone/decision history.
6. Inspect the employee as HR and add an attributed suggestion that the employee can accept or dismiss.
7. Exercise an unsupported goal, no eligible useful activity, and an AI failure. Each must leave an honest, useful interaction.
8. Submit a justified quarterly self-assessment; inspect a challenge or insufficient-evidence result, return/edit/resubmit, and approve as the assigned manager. Verify all three viewpoints are preserved.
9. Verify partial approval changes only reviewed skill baselines, repeated approval adds no duplicate effect, and closing modules never changes the recorded grade automatically.

Use the role-linked case for the original multi-factor recommendation criterion. Include a separate arbitrary-goal case to prove the broader product direction without inventing employer requirements.

## Boundaries for this milestone

One app, one database, synchronous domain handlers, one agent, stored action/decision evidence. No new service topology or separate audit product. No full event sourcing, broker, SAP integration, production SSO, reward economy, public ranking, attrition prediction, automated promotion, or generated skill testing.

Mock assessments remain a later option requiring a real task/rubric/result contract. Current-role/target-role audience matching is a disclosed prototype mobility policy, not inferred real enrollment permission. Existing data ambiguities, including historical self-paced completion dates, remain visible.

## Review method

Read all six existing design/status documents and the README, then checked the relevant current types, development/eligibility functions, database, access/session/import APIs, UI references and test expectations. The subsequent quarterly proposal was checked against the actual skill categories, mentoring field and manager relationships. This turn edits documentation only. Application tests, builds, browser behavior and live AI calls were not run as part of the review.
