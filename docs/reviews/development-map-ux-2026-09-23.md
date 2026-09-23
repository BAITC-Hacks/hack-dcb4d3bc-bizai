# Development map UX re-review

Reviewed the running redesign on port 3003 using the current Russian locale and narrow browser viewport. Exercised search, skill selection, activity handoff and browser Back; inspected implementation for state and layout behavior. No application edits or data mutations in this review.

## Findings

1. **P1 — exploration context is lost on return.** Search for “Облачные”, select Cloud Platforms, open Cloud Certification Prep, then Back. Search resets and API Design becomes selected. State lives only in component useState. Persist selected skill/filter/search in the URL and preserve the origin when opening an activity. Add “Back to Cloud Platforms” to the detail page.
2. **P1 — filters and inspector can contradict each other.** Searching Cloud Platforms hides API Design, but its details remain selected. Reconcile selection with visible results, or explicitly identify a pinned selection outside the filter. Empty results should not silently retain unrelated actions.
3. **P1 — levels and progress use different measures without local labels.** API Design displays effective 3/3 alongside a bar based on assessed 2/3, under Critical gaps. The explanation is distant. Show assessed and effective values together on the node, label the bar, and distinguish “critical: evidence needed” from a learning deficit. Keep criticality a badge independent of status grouping.
4. **P2 — mobile selection has no explicit return affordance.** Selection focuses/scrolls to details below the entire list; there is no “Back to map” control. Use a mobile detail sheet or dedicated detail view with a back action, preserve list position and restore focus to the originating node.
5. **P2 — hierarchy and content are duplicated.** Page title says Skills & strengths while navigation says Development map. Target/module counts repeat above and inside the map; the complete skill-card grid repeats the information below. Make map the page identity and place the full inventory behind a secondary view.
6. **P2 — map is a categorized list rather than a connected plan.** It exposes skill-to-activity options but no existing milestone association, planned/completed state or return path. Show “In your plan” and linked milestones before generic catalog options; distinguish formal requirements from personal actions.
7. **P2 — Russian interface mixes untranslated English action labels and explanatory paragraphs.** This affects the primary task instructions, not just decorative copy. Translate the full interaction, including no-results, missing assessment and evidence-needed states, before locale acceptance.
8. **P2 — search and filter controls are distant from the mobile inspector.** Repeated scrolling interrupts comparisons. Preserve a compact selected-skill header and a clear change-selection action.

## What works

- Selecting Cloud Platforms changes the inspector to the correct 1 assessed / 1 effective / 2 required evidence.
- Its eligible Cloud Certification Prep link opens the correct activity, with milestone adoption controls.
- API Design at effective target still explicitly requires assessment evidence rather than falsely closing the module.
- Target editing and a manual planning fallback are reachable.

## Recommended sequence

1. URL-backed selection and origin-aware return; consistent filter/selection behavior.
2. Explicit evidence states on nodes; criticality separated from readiness status.
3. Mobile detail/back interaction and keyboard focus restoration.
4. Remove duplicate inventory/header content; show existing linked plan work.
5. Complete translations and rerun the journey in all locales.

Acceptance task: select a skill, understand why it remains open, inspect an activity, return to exactly the same skill/filter, and find or create its next plan action without searching again. Repeat with a no-results query, a critical skill needing reassessment, a closed module and an unmapped goal.
