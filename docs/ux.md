# UX guide

The workspace centers on an employee-owned direction and a concrete next action. Keep intention, learning activity and demonstrated competence distinct in labels, counts and interactions.

## Navigation

| Destination | URL | Primary purpose |
| --- | --- | --- |
| Overview | `/employee/dashboard` | Focus goal, development map, milestones and next action |
| My plan | `/employee/dashboard?view=plan` | Edit/save goals, focus, milestones and evidence |
| Development advisor | `/employee/dashboard?view=advisor` | Ask questions, confirm preferences, inspect sources and adopt drafts |
| Skills & strengths | `/employee/dashboard?view=skills` | Assessed/effective values, target requirements and module status |
| Learning history | `/employee/dashboard?view=history` | Participation records and completion status |
| Learning catalog | `/employee/learning` | Filter/search and inspect activities |
| Activity detail | `/employee/learning?event=EV_001` | Prospective gains, prerequisites, plan adoption and demo completion |
| Quarterly review | `/employee/reviews` | Self-review and direct-report review selection |
| HR employee record | `/hr/employees/E0001` | Same development views plus `?view=reviews`; plans are read-only |

An unknown dashboard `view` falls back to overview. Catalog filters use `tab=all|eligible|in_progress|completed|mandatory`; the default is `eligible`, and search uses `q`. Map-to-activity navigation can preserve `mapQuery`, `mapFilter`, `mapSkill` and `mapDetails` through a validated `returnTo` URL.

## Progress vocabulary

| Concept | Meaning to communicate |
| --- | --- |
| Focus goal | One saved direction; a role/grade mapping is optional for planning |
| Milestone | Employee-defined outcome and success criterion with actions/evidence |
| Effective level | Assessed level plus computed learning gains |
| Assessed level | Human-approved rating, falling back to the imported source assessment |
| Closed module | Assessed level meets a target skill requirement |
| Next-grade preview | Optional exploration until explicitly saved as a goal |

Milestone states are `planned`, `in_progress`, `evidence_needed`, `reached`, `blocked`, `paused`. They are editable employee claims, not an automatic workflow or proof of competence. Marking an activity complete never automatically marks its milestone reached.

## Overview and empty states

The next-action card considers: missing focus → milestone evidence → active milestone → stale advice → unconfirmed preferences → existing recommendations → exploration. An active milestone is selected from `evidence_needed`, then `in_progress`, then `planned` items.

No goal presents goal creation; it must not silently activate the next grade. No role mapping retains the free-form plan but offers no invented target requirements. No milestones presents an outcome/criterion prompt. No catalog matches presents an empty result; it does not relax filters invisibly. Missing assessment/scale information must stay distinguishable from a measured zero or an invented proficiency description.

## Advisor interaction

The full advisor and floating widget share persisted scoped history. HR selects an employee before chatting. The launcher is hidden where the full advisor is already open. Enter sends, Shift+Enter inserts a newline; Stop cancels the request and restores the draft. Copy, retry, source inspection and a preferences drawer are available.

Recommendation readiness requires a saved supported target and explicitly confirmed duration/formats. Blank duration/no formats means unrestricted only **after confirmation**. Duration is total catalog hours per activity, not a weekly time budget. Free-text notes are self-report, not guaranteed hard filters.

Show processing status while waiting. Publish validated results or a visible fallback; never present provider failure as successful advice. Sources and prospective changes should be inspectable before adding an activity or adopting a goal. Plan/dataset/preference changes invalidate old advice and may require reconfirmation.

## Save, error and destructive states

- Plans and review drafts require explicit saves. Do not describe them as autosaved.
- Submitted reviews are frozen. Reopen creates a new editable revision while preserving the submission.
- Approval requires every final skill rating plus a comment; return requires a comment. Calibration remains visibly `not_run`.
- On stale writes, reload and reconcile state instead of silently overwriting another save.
- Import uses preview → apply. Reset restores fixtures and removes current working plans/completions; retained audit records are not a user undo function.

## Languages and responsive checks

`en`, `ru`, `kk` are selected through ENG / РУС / ҚАЗ and stored in a one-year `career_quest_locale` cookie. The document language, UI, dates and numbers follow it. Switching reloads the current URL, preserving route/query/anchor but losing unsaved form edits and file selections. Unknown imported free text stays verbatim; field names/IDs are never translated.

Add Russian and Kazakh entries to [`messages.json`](../lib/i18n/messages.json) for new shared UI text; reviews and AI also use their dedicated copy helpers. Check long translations, keyboard focus/labels, collapsible mobile navigation and widget bounds when changing these surfaces. These are review criteria, not a claim of a completed accessibility audit.

## Known UX limits

“View changes” currently opens participation history, not a unified log of plan/review/advisor actions. Some shared HR overview links retain employee-oriented wording (for example “Edit direction”), even though the destination enforces read-only plans. The current product has demo completion controls, not a course player or enrollment integration. Historical UI review findings are in `docs/reviews/`; this guide does not imply those findings have all been resolved.
