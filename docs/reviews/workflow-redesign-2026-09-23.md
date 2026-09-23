# Workflow redesign proposal

Source audit: 2026-09-23. Compared current components and API contracts with prototype-product-direction.md, quarterly-review-requirements.md and next-stage-plan.md. This is a proposed interaction design, not a claim of implemented behavior. No fresh browser usability test or live AI run was performed for this audit.

## Diagnosis

The app organizes records into destinations, but does not carry the user's intent between them. A different sidebar alone cannot fix this. Preserve the current domain calculations, localization and persistence; change how users choose, execute and understand actions.

| Current evidence | User consequence | Proposed change |
| --- | --- | --- |
| DevelopmentPanel overview CTA depends on whether a focus goal exists | Same “Find my next step” action regardless of pending questions, stale advice or ongoing work | Derive a next-action summary from actual goal, consultation, decision and plan state |
| AssistantPanel recommendation cards render title, reason and sources only | User must find the activity elsewhere and remember why it mattered | Open activity details directly; offer explicit adoption into a selected milestone |
| milestoneSchema stores actions/evidence as text | No reliable relationship between recommended activity and personal plan | Add optional structured activity references while preserving manual actions and arbitrary goals |
| Catalog renders selected activity chat alongside the full catalog | Discussion competes with browsing; selection context is fragmented | Dedicated activity detail with relevance, eligibility, expected change and contextual questions |
| CompletionButton refreshes; catalog lists recent changes | User sees changed numbers but must reconstruct the next step | Completion receipt with actual before/after, linked milestone, evidence status and onward action |
| DevelopmentFlow is informational; SkillCards are separate | A visible gap is not connected to something the user can do | Select a skill to inspect its evidence and eligible relevant activities; distinguish learning from reassessment |
| HR dashboard statuses are derived from AI decisions | Attention is framed as system status rather than an HR task | Reasoned queues with a concrete action, employee context and resolution state |
| Reviews show all skill fields and JSON revision history | Long form and technical history obscure work remaining | Cycle summary, incomplete-skill navigation, human-readable revision comparison |
| Review API supports create/save/submit/reopen only | Submitted reviews cannot complete the specified approval journey | Implement calibration and approve/return before exposing those actions |

## Proposed information architecture

Employee primary destinations:

1. **My development**: focused goal, current milestone, next action, recent changes. Plan editing and advisor are contextual actions in this workspace rather than competing starting points.
2. **Skills & evidence**: retain the development map; selecting a requirement opens baseline provenance, computed learning gains, formal module status and available next actions.
3. **Activities**: browse and search; focused activity detail is shared by catalog, recommendation and milestone entry points.
4. **Reviews**: draft, submitted and eventually calibrated/returned/approved cycles. Managers receive a scoped “Team reviews” queue inside this destination.

Keep history as a view within My development/Skills & evidence, with stable deep links. Preserve existing URLs through redirects or equivalent view resolution when navigation changes.

HR: **Attention**, **People**, **Insights**, **Data**. Attention must group actionable causes, not score/rank employees. Operational AI failures and missing evidence are distinct; a failed provider is not an employee performance issue. Do not label a queue “approval required” before the actor has permission and a supported approval operation.

## First end-to-end slice: choose a useful next step

Goal → resolve material preferences → inspect recommendation → open activity → adopt into milestone → record demo completion → inspect receipt → choose next action.

- Use an existing valid goal without asking the employee to re-enter it.
- If advice is stale, explain the changed input and offer refresh; do not adopt from an obsolete context.
- Activity detail shows why it supports the selected goal, relevant constraints, actual eligibility and expected effective gains. No course-to-promotion claim.
- Adoption asks for the milestone (or creates an employee-confirmed outcome/criterion); it is separate from enrollment or completion.
- Persist the activity reference and decision attribution, with dataset/plan revision checks and retry-safe mutation. Preserve free-text actions.
- Completion applies existing gain rules once. A linked milestone does not become reached automatically. The receipt says whether formal assessment evidence still needs updating.
- If no activity fits, preserve the goal and allow a manual action. Provider failure leaves plan editing and catalog facts usable.

Acceptance: complete this sequence without manually searching for a recommended title or copying identifiers. Reload retains adopted work. Retry creates no duplicate action/completion. Target or dataset changes cannot silently apply an old recommendation. Free-form goals remain valid.

## Second slice: make evidence actionable

Retain the flow chart as a requirement map, not a fake chronological course roadmap. Each skill opens one evidence view:

- Imported/latest approved assessment, source and date.
- Computed effective level and contributing completions.
- Requirement and criticality for the selected target.
- Module closure state based on assessment evidence.
- Relevant learning options or an evidence/reassessment path when supported.

Acceptance: a user can explain why a module remains open after a course, and can inspect the source behind each displayed level. No invented reassessment endpoint or arbitrary score-to-level conversion.

## Third slice: complete reviews and HR interventions

UI work possible now: cycle summary, draft progress, missing-item navigation, reviewer names and readable version history. Preserve explicit save and clearly communicate unsaved work.

Backend-dependent work: bounded calibration with insufficient_evidence, frozen revision handling, authorized approve/return, per-skill observation overlays/cutoffs, and attributed HR proposals with employee accept/edit/dismiss. Do not decorate missing operations with inactive primary buttons.

Acceptance: employee statement, advisory result and human decision remain inspectable separately; approvals only change reviewed skills; repeated approval has no duplicate effect; managers cannot approve themselves or unrelated employees. Closing modules never changes the employment grade automatically.

## Delivery order

1. Build the first connected employee slice and its activity detail/receipt; this gives the largest immediate functional improvement.
2. Connect the existing map to a unified evidence view.
3. Improve review authoring while implementing calibration/decision contracts; then expose manager queues and HR proposals.
4. Consolidate primary navigation once those journeys work. Apply final visual polish to the resulting screens.

Avoid another broad cosmetic rewrite. Validate each slice with a concrete task, empty/stale/error states, mobile and keyboard behavior, and regression checks for existing domain rules.
