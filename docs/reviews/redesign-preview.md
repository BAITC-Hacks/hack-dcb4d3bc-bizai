# Workflow preview — first slice

Branch: `codex/workflow-redesign`. Separate worktree and SQLite database. Run on port 3003; session and locale cookies are isolated from port 3002. Dependencies reuse the installed node_modules through an ignored symlink. No API credentials were copied.

Implemented: next-action workspace, visible milestones, advice-to-activity links, focused activity detail, persistent activity adoption into an existing or new milestone, recorded completion receipt, and a next action to review evidence after linked learning is complete. Development map remains under Skills & strengths.

Activity adoption adds optional `activityIds` to milestones, validates catalog references on the server, and uses existing ownership and revision guards. It does not enroll, complete, grant skill levels, or automatically mark a milestone reached. Manual actions remain supported. Recommendation provenance and a dedicated idempotent adoption command are still future work; stale plan saves are rejected rather than silently retried.

This is a working first slice, not the finished redesign. HR queues, calibration/approval, full navigation consolidation and translation of new preview copy remain pending. Existing locales work; new labels currently fall back to English. AI has no provider credentials in this worktree and can show its normal unconfigured state.

Validation: production build (including lint/typecheck), unit suite and browser activity adoption/completion journey. The preview database contains E0001's demonstration milestone “Design a resilient service” and one EV_005 demo completion created during the browser check. Main workspace data was not changed.

## Interactive development map

The map is now embedded on Overview and promoted in primary navigation. Skill buttons open a contextual inspector with imported assessment provenance/date, effective level, target requirement, completed participation, eligible gain-producing activities and exclusion reasons for other matching activities. Learning-ready skills link to review preparation; missing catalog options retain a manual planning path. Search and state filters support exploration; keyboard buttons and mobile focus/scroll expose the inspector. Target editing links to the owned plan. Activity links lead to the existing adoption form, not automatic enrollment.

Verified production build and browser selection of Cloud Platforms → Cloud Certification Prep → milestone adoption controls. HR reuses the map with read-only evidence and an advisor link rather than employee mutation actions. New map copy currently uses English fallback where translations are absent.

## Main integration

Merged after the connected-flowchart iteration. Preview-only session/locale cookie names were excluded from the merge; main retains its existing cookie contract. Newer main changes for optional next-grade previews and review approvals were preserved. The map now reads recorded-skill availability and assessment dates from approved per-skill observations when present, rather than labeling all assessments as imported. Earlier notes about missing manager decisions describe the preview baseline, not the merged application.
