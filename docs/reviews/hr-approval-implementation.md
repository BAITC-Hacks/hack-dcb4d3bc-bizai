# HR approval: implementation and original gap analysis

Checked 2026-09-23 for `/hr/employees/E0001?view=reviews` against the application code and current local review records. The implementation below was delivered on 2026-09-23; the original gap analysis is retained for context.

## Delivered behavior

HR and the current direct line manager are alternative approvers. Self-approval is rejected. Submitted reviews can become `approved` or `returned`; the employee must reopen and resubmit a returned review. Approval requires every final rating and a comment. Return requires only a comment. Both append immutable decision revisions, with HR attributed as `hr_demo` in this prototype.

AI calibration remains unimplemented and is explicitly marked `not_run`; approval is a human-only decision. The API supplies `canDecide`, and the transaction independently authorizes the actor. Identical command retries return the saved result; concurrent or stale decisions fail.

Accepted ratings are stored separately from source data, scoped to the reviewed skills. Frozen business-date cutoffs and included demo-completion IDs prevent counting the same gains twice; later demo completions and unreviewed skills preserve their progress. Historical records dated on/before an accepted cutoff are treated as absorbed, including subsequently imported backdated records. Raw employee profiles, global imported review dates, and grades remain unchanged. Development views and advisor evidence use the accepted baseline. Reset starts a new assessment scope.

Verification: 41 unit tests, 41 review HTTP checks, 40 assistant HTTP checks, and 260 application HTTP requests pass. Production build passes. Browser verification uses an isolated database; the real E0001 review is not approved by this change.

## Original investigation (superseded by delivery above)

## Current failure

E0001 has a submitted 2026-Q3 review, revision 2, covering 15 target skills. Its recorded reviewer is E0050 and the submission has a frozen evidence bundle. The missing approval controls are not caused by the lack of a submitted review.

- `components/career/review-panel.tsx` offers employee create/save/submit/reopen only. HR and managers can inspect, but there is no decision form.
- `app/api/reviews/route.ts` rejects all non-employee POSTs. Its command schema has no approve/return action.
- `lib/career/reviews.ts` supports only `draft` and `submitted`, without a decision record.
- `lib/server/database.ts` can append employee revisions, but cannot atomically record an approval and approved skill observations.
- `lib/career/skills.ts` calculates assessment-backed module closure directly from imported `employee.skills`. Adding an approval status alone would leave development progress unchanged.

The earlier specification assigned approval to the line manager and HR read-only inspection. The new request requires an explicit HR capability. Resolve whether HR is a co-equal approver, a fallback when there is no manager, or a second sign-off stage. The first option is the smallest prototype implementation, but these policies produce different authorization and state transitions and must not be conflated.

## Smallest coherent implementation

Reuse the current review page, API, database and revision log. No new service, scheduler or event broker.

### 1. Server-derived capabilities

Return capabilities with each review response: `canEditSelfAssessment`, `canApprove`, `canReturn`, and a localized reason when an action is unavailable. The UI renders capabilities; the repository independently rechecks them inside the write transaction.

If HR and the line manager are alternative approvers, authorize HR or the employee's **current** direct manager, excluding employee self-approval. Do not use grade, client-selected role labels or a historical reviewer ID alone as permission. Keep managers' own employee workspace. Existing HR sessions identify a demo role, not a named human: audit must state `hr_demo` rather than invent an HR identity. Production attribution would require named HR sessions.

### 2. Decision controls

On the submitted review show, per skill:

- submitted self-rating and original business justification;
- accepted assessment baseline and frozen history/evidence;
- AI calibration result when available, or an explicit “not run” state;
- final rating input, initially blank so a human must make the decision.

Require a decision comment for approval and return. Require exactly one valid 0–5 final rating for every reviewed skill before approval. Never enable approval for a draft, a returned review awaiting resubmission, or a superseded version. Return leaves ratings untouched and gives the employee a new editable revision with the return comment visible.

HR must not fabricate a missing employee self-assessment. An employee without a submitted review sees a precise next-step explanation instead of an enabled approval button.

### 3. Typed decision command

Illustrative command contract:

```json
{
  "action": "approve",
  "employeeId": "E0001",
  "id": "<review-id>",
  "revision": 2,
  "datasetRevision": 1,
  "commandId": "<uuid>",
  "ratings": [{ "skillId": "SK_API_DESIGN", "finalRating": 3 }],
  "comment": "Decision rationale based on the reviewed evidence"
}
```

The actual ratings array must cover the complete frozen skill set; the single item above illustrates its shape. Return carries the same identity/revision fields and a required comment, without applied final ratings.

Store a distinct `ReviewDecision` with decision type, actor type/id, reviewed submission revision, comment, final ratings, timestamp, command ID and evidence cutoff. Preserve employee statements and calibration records as separate opinions. Repeated command ID + identical payload returns the same outcome; conflicting reuse fails.

### 4. Atomic domain handler

Within `BEGIN IMMEDIATE`:

1. Resolve the current dataset scope, review revision and current reporting relationship.
2. Authorize the decision and enforce the transition.
3. Validate the full rating set, comment, idempotency key and assessment freshness.
4. Append the decision/review revision.
5. For approval only, write application-owned approved observations for the reviewed skills.
6. Increment the relevant context version so cached/in-flight advice becomes stale.
7. Commit all writes together; rollback every write on error.

Approval becomes a terminal human-approved state. Return becomes a visible returned state from which the employee creates/edits a new draft revision. A newer submission must invalidate any calibration attached to the earlier revision. An older quarter must not silently overwrite a newer accepted assessment just because it was approved later.

### 5. Per-skill assessment overlay

Do not overwrite the imported profile or advance its global `last_review_date` for a partial review. Store an observation per reviewed skill:

```text
employee + skill + final rating
review/decision source + approver + approved_at
evidence_as_of + evidence revision
included application completion IDs
```

Use one shared assessment resolver for skill calculation, module closure, cards and assistant evidence. The latest accepted observation replaces the baseline only for that skill. Other skills retain their previous assessment value and cutoff.

Historical CSV gains replay after that skill's evidence cutoff. Demo completions use their captured IDs or a clearly defined operational cutoff; the synthetic business date alone cannot distinguish completions before and after submission. Completions incorporated in an approved rating must not be counted again. Completions after the frozen submission remain eligible for replay, even if the approval occurs later. Newly imported backdated history must have an explicit policy rather than silently changing the meaning of an accepted assessment.

```text
Reviewed skill: approved 3 + post-submission completion 1 = effective 4
Unreviewed skill: original 2 + existing completion 1 = effective 3
Module closure: approved/accepted assessment >= required level
Promotion: separate human decision; recorded grade stays unchanged
```

Update both the displayed assessment source/date and the assistant's evidence references. Imported values must not be relabeled as manager-approved values. A profile-level “latest review” date can be displayed as metadata, but must not drive replay for unreviewed skills.

### 6. Calibration boundary

The review foundation has no actual calibration implementation. Do not label a submitted review `ai_reviewed` merely to enable approval, and do not fabricate `aligned` results.

The full earlier workflow requires bounded calibration against the frozen submission, returning one `overrated`, `aligned`, `underrated` or `insufficient_evidence` result per skill, with source references. A timeout produces a labeled rules fallback. Insufficient evidence is not an automatic penalty and does not prevent a reasoned human decision.

If approval ships before calibration, present this explicitly as a **human-only approval path with AI not run**, not as completion of the agreed AI-assisted review workflow. Whether to expose that interim path is a product decision, independent of whether HR has approval authority.

## Acceptance checks

- E0001's submitted review exposes the correct authorized action and can be approved with 15 final ratings and a comment.
- Drafts, unrelated employees, self-approval, obsolete managers, stale revisions and incomplete/duplicate/unknown skill IDs are rejected server-side.
- Concurrent or repeated approval applies exactly once; conflicting retries fail.
- Return preserves the employee submission and decision comment; resubmission preserves the prior revision.
- Approval updates reviewed assessments only. Included gains are not repeated; later gains and all unreviewed skill gains survive.
- An older review cannot replace a newer accepted assessment.
- Skill cards, module counts and AI context use the same accepted observations; all modules closed never changes the employee's grade.
- Reset/replacement cannot expose old decisions for reused employee IDs.
- EN/RU/KK controls, manager and HR access, failure states and the actual browser approval flow are verified on an isolated database before touching the user's E0001 review.

## Recommended delivery sequence

Confirm HR authority and the interim human-only/calibration boundary. Implement capabilities, decision command and the approved-skill overlay together; then wire the decision form and audit display. Test arithmetic and permissions before demonstrating approval. Add bounded calibration as the next connected operation, never as a fabricated status.
