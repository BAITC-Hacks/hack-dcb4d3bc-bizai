# Previous UI design reference

Extracted from commit `09b9f02f45da3e7d27abe360032936b11584b59d`. Files under `committed/` are byte-for-byte copies from that commit, with original paths preserved. This is a design reference, not a runnable standalone app. Imports still refer to the original application. The active UI is unchanged by this extraction.

## Snapshot limitation

This is the last committed design, not an exact backup of the working tree immediately before the redesign. Uncommitted planning, assistant, completion and review additions are not reconstructed here. Do not replace the current application wholesale with these files: older contracts and placeholder behaviors are present.

## Visual language

| Token | Value / use |
| --- | --- |
| Navy | `#003F7D`; primary controls, headings, chart segments |
| Dark navy | `#002A55`; gradient endpoint |
| Orange / gold | `#F39200`; emphasis, current grade, progress accents |
| Ink | `#0B1F3A`; primary text |
| Paper | `#F6F8FB`; light surfaces |
| Mist | `#E6ECF4`; borders and progress tracks |
| Radius | Base `0.75rem`; larger panels use `rounded-2xl` |
| Card shadow | `0 1px 3px rgba(15,23,42,.05), 0 1px 2px rgba(15,23,42,.06)` |
| Elevated shadow | Navy-tinted 10px / 30px soft shadow |
| Typography | Body explicitly Arial/Helvetica; Tailwind also defines an Inter variable fallback |

`committed/app/globals.css` contains the navy gradient, radial paper background, 40px hero grid and navy-to-orange progress bars. `committed/tailwind.config.ts` contains the full palette, shadows and animation tokens.

## Page composition

- Landing: decorative hero and account entry cards.
- Workspace shell: previous navigation, account context and promotional styling.
- Employee dashboard: gradient profile hero → grade ladder → development map → trajectory / skill table and summary sidebar → participation history.
- Summary sidebar: donut chart, critical gaps, recommendation placeholder and recent learning.
- Activity cards: previous information density and visual treatment.
- HR dashboard: combined summary metrics, gaps, people and participation.

See `committed/components/career/development-panel.tsx` for the original composition; `committed/components/charts/donut.tsx` for the chart.

## Where the flow chart went

The active component is `components/career/development-flow.tsx`. It has now been restored above the skill cards on Skills & strengths, for both employee and HR employee profiles. It renders when a comparison target exists; profiles without a target keep their known-skills view.

Two versions are included:

- `committed/components/career/development-flow.tsx`: original committed version.
- `working-copy/components/career/development-flow.tsx`: current retained component with newer evidence-labeling changes.

The map is a CSS-connected layout, not an interactive React Flow canvas. It branches from the current profile into **critical gaps**, **other skills to develop** and **closed modules**, then leads to the target profile. Branches describe requirement groups, not task order. The component takes `current`, `target`, `gaps` and `goalUnset` props.

Restored placement: Skills & strengths, above the detailed evidence cards, reachable through the existing Skills & strengths link from Overview. The extracted reference files remain unchanged.

## Verification

`manifest.json` records the source commit and SHA-256 of every committed file. All extracted files were compared byte-for-byte with their Git objects. Reference files live outside the app/component build and Tailwind scan paths.
