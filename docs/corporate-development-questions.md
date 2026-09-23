# Corporate career development: discovery questions

Prepared 2026-09-23 for the Career Quest team. This is a discussion checklist, not a new specification or an approved SAP integration plan.

## Resolution after user feedback

This checklist is retained as discussion history. [Prototype product direction](prototype-product-direction.md) supersedes its conflicting suggested positions; do not treat the questions below as unanswered blockers.

| Topic | User direction |
| --- | --- |
| Corporate/SAP positioning | A prototype centered on explainability, visibility and observability. SuccessFactors is inspiration only; integration research is deferred. |
| Goals and suggestions | Arbitrary employee-authored goals, with grounded suggestions. Role/grade targets are optional. |
| Progress | Editable milestones, not aggregate percentages. |
| Skill evidence | Use the case's mock assessments and gains initially. Course-free skill testing is a possible explicit extension, not existing dataset capability. |
| Plan authority | The employee can alter the suggested plan at will. |
| HR visibility and input | HR can view all employee development records in the prototype and add attributed recommendations. |
| Career mobility | Make cross-role paths visible and supported; preserve transferable skills. The current-role-only audience proposal is superseded by the mobility policy described in the product direction. |
| Unsupported guidance | Never invent a requirement, skill proof, activity or outcome. Missing support leads to a clear limitation and a useful remaining interaction. |

The remaining assessment rubric and detailed mobility policy are implementation design work, not reasons to reopen these product decisions. Corporate deployment questions are deferred beyond this prototype.

## Starting point

The current [explainability design](explainability-design.md) already establishes: career goals and critical gaps first; ask when a goal or material context is missing; preserve attribution of self-reports; validate changes through domain handlers; and show traceable recommendations. Those decisions are not reopened here. The older suggestion to silently default a missing goal to the next grade is superseded.

The case and dataset remain authoritative for hackathon behavior. The dataset prescribes completion gains and missing-skill semantics, but does not identify SAP as its source or define a real employer's promotion policy.

SAP's published development-planning model links career aspirations, role requirements, development goals and actions. Its current overview also describes AI career guidance, so “we recommend courses with AI” alone does not establish a differentiated product. Development goals can cover multiple skills and learning activities; a one-skill-per-goal schema is an MVP simplification, not a SAP requirement. [SAP Career Development Planning overview](https://learning.sap.com/courses/explore-sap-successfactors-solutions/understanding-sap-successfactors-career-development-planning_ce60ee0b-79f8-48e0-a5b3-e20b9d4f5a54)

Priority: **P0** changes the product or acceptance criteria; **P1** informs corporate pilot design. Suggested positions below are proposals unless explicitly described as existing decisions. Corporate extensions must not silently replace the case's rules.

## Product decisions for our team

### 1. P0 — Who is the first corporate customer?

**Question:** Are we targeting an employer already using SuccessFactors, an employer with a different HR/LMS stack, or one managing development in spreadsheets?

**Why it matters:** This determines whether we sell an extension, an integration-neutral service, or a standalone application.

**Suggested position:** Demonstrate a standalone dataset-driven product and describe a future integration boundary. Do not assume the case sponsor uses SAP.

### 2. P0 — What value would remain if the customer already had SAP career guidance?

**Question:** Which problem can we demonstrate solving especially well: auditable recommendations, explanation of rejected alternatives, clarification of missing context, or discovery of gaps in the learning catalog?

**Why it matters:** SAP already documents overlapping career-guidance capabilities. Feature similarity does not prove either integration compatibility or differentiation.

**Suggested position:** Lead with evidence-backed decisions: “Why this activity, why not the alternative, and what changed after completion?” Validate that value with an HR stakeholder.

### 3. P0 — What is a development goal in our product?

**Question:** Is it a numeric target such as “System Design 2 → 4,” a demonstrated outcome such as “independently review a service architecture,” or an outcome supported by several skill targets and activities?

**Why it matters:** A career aspiration, a development goal, and an activity are different objects. Conflating them makes course completion look like career-goal attainment.

**Suggested position:** Use a named objective with a measure of success, linked skill targets and linked activities. For the demo, calculate success only from the supplied skill rules; do not claim an unobserved workplace outcome.

### 4. P0 — What exactly does the progress percentage measure?

**Question:** Should we show the share of skill requirements fully met, partial skill coverage, or both? How do we keep unmet critical skills visible?

**Concrete difference:** For two requirements of level 4, current levels of 3 and 3 yield 0/2 requirements fully met but 6/8 = 75% partial coverage.

**Suggested position:** Show per-skill gaps and critical blockers first. If an aggregate is shown, name and document its formula; never label it a promotion probability. Keep employee role readiness distinct from the agent's readiness to recommend.

### 5. P0 — What outcome would make a pilot successful?

**Question:** Is the first measurable outcome employee acceptance of useful recommendations, voluntary completion, assessed reduction in critical gaps, or less HR effort resolving missing next steps?

**Why it matters:** These are different outcomes with different measurement periods. The synthetic dataset cannot validate retention improvements or real training effectiveness.

**Suggested position:** For the hackathon, demonstrate factual correctness, explainability and the completion loop. For a corporate pilot, select one primary outcome with a baseline and observation period.

## Questions for an HR or learning-and-development stakeholder

### 6. P1 — Who owns the career matrix?

**Question:** Who defines and approves role requirements, critical skills and allowed career transitions, and what should happen to an active plan when those requirements change?

**Why it matters:** These are employer policies, not values an LLM should invent.

**Suggested position:** Version approved matrices and recalculate affected plans while retaining the source of earlier recommendations.

### 7. P0 — What evidence establishes a skill level?

**Question:** How should manager assessments, self-reports, completed training and work evidence be distinguished, and who can resolve disagreements between them?

**Why it matters:** A skill assessment, a claim about a skill and a completed activity have different evidential value.

**Suggested position:** Preserve assessed, self-reported and rule-calculated values separately. Apply the case's completion gains in the demo; make any corporate reassessment policy an explicit extension.

### 8. P1 — How much authority does the manager have?

**Question:** Can a manager suggest goals, approve training time or cost, change a plan, or approve completion—and which of those actions require employee agreement?

**Why it matters:** `manager_id` gives us a reporting relationship, not a defined permission model or approval workflow.

**Suggested position:** Keep the current employee/HR MVP boundary. Add manager capabilities only around an identified pilot need; distinguish advice from approval.

### 9. P1 — Which career information is private?

**Question:** Can managers and HR see exploratory career aspirations, reasons for declining activities and conversational answers, or only agreed goals and relevant progress?

**Why it matters:** A corporate hierarchy does not by itself specify access to every personal statement.

**Suggested position:** Define visibility by field and actor. Preserve useful operational constraints without assuming every explanation needs to be shared.

### 10. P0 — What prevents participation in practice?

**Question:** Which constraints materially affect whether someone can attend—working time, release from duties, travel, accessibility, language, budget or session capacity—and which can we retrieve rather than ask about?

**Why it matters:** The dataset does not contain most of these constraints. A no-show does not establish either its cause or lack of motivation.

**Suggested position:** Ask only when the answer can change the recommendation; persist it with attribution. Do not require a fixed intake questionnaire.

### 11. P0 — What should HR do after seeing a gap?

**Question:** For each blocker, is the useful next action to add a learning offering, clarify a target, arrange an assessment, resolve access, or discuss a participation constraint?

**Why it matters:** “No recommended step” mixes catalog limitations, missing information and operational failures. It is not itself an engagement diagnosis.

**Suggested position:** Show the reason and the appropriate follow-up. Measure actionable skill-gap prevalence against an explicit current-role or target-role denominator.

## Clarifications for the case organizers

These confirm interpretations of underspecified acceptance criteria; they do not require pausing independent development.

### 12. P0 — How are cross-role goals intended to interact with event audiences?

**Question:** When a career goal names another role, should `target_roles` and `target_grades` be checked strictly against the employee's current position, or is there a defined exception for transitions?

**Why it matters:** Otherwise a legitimate aspiration can have no eligible activity in the supplied catalog.

**Current working interpretation:** Enforce the current audience and prerequisites, and expose unsupported transitions as catalog limitations. Do not quietly relax the input rules.

### 13. P0 — How will incomplete-context and no-candidate cases be judged?

**Question:** Will the jury accept a focused clarification question or a justified empty result when the goal is absent or no useful eligible activity exists, and is the 10-second limit measured per system response excluding time waiting for a person?

**Why it matters:** The brief asks for 1–3 recommendations but also explicitly asks HR to identify people without a step.

**Current design:** Ask for missing material information, return a reasoned blocker when appropriate, and bound each AI response. Never manufacture a recommendation to fill three cards.

### 14. P0 — What convention should resolve missing historical completion times?

**Question:** For self-paced records, can `date` be used as the historical proxy when deciding whether completion occurred after `last_review_date`, or is another convention intended?

**Why it matters:** The README defines that date as enrollment or assignment. Exact completion chronology cannot be recovered from the file.

**Current working interpretation:** Document the proxy and record explicit completion timestamps for new actions.

### 15. P0 — What does “relevant” mean when multiple recommendations are defensible?

**Question:** Are jury profiles evaluated against one expected activity or against eligibility, critical-gap contribution, multiple-factor evidence and a defensible tradeoff?

**Why it matters:** The supplied data does not label a unique best recommendation.

**Current policy:** Career-goal progress and critical gaps come first among feasible candidates; participation history, effort and explicit preferences refine the choice. Validate explanations against actual source records.

## Questions before promising an actual SAP integration

### 16. P1 — What environment and integration scope are actually available?

**Question:** Does a prospective customer provide a SuccessFactors test tenant, enabled modules and authorized access—and what is the smallest useful flow: read profiles and learning history, publish proposed development goals, or exchange completions?

**Why it matters:** Conceptual similarity does not establish that the required interfaces and permissions exist in a customer's configuration.

**Suggested position:** Keep the present claim at “workflow inspired by enterprise development planning.” Label a future mock adapter as a mock until tested against an authorized tenant.

### 17. P1 — Which system owns each fact and resolves conflicts?

**Question:** Where are identity, role requirements, assessments, goals and completion records authoritative, and how do updates reconcile employee IDs, skill identifiers, rating scales, unknown values and concurrent edits?

**Why it matters:** The case's “missing skill = 0” rule must not automatically become the semantics of an external HR system. Duplicate completions must not add duplicate gains.

**Suggested position:** Define field-level mappings and ownership before write-back. Begin with an auditable import boundary and prove correction and idempotency behavior.

### 18. P1 — What evidence is sufficient to approve a corporate deployment?

**Question:** Which concrete requirements apply to identity, role-scoped access, audit retention, model processing, hosting and data deletion, and who at the customer signs off on them?

**Why it matters:** “Corporate-ready” needs an agreed deployment contract. The current demo account selector is not production authentication.

**Suggested position:** Establish requirements with an actual pilot customer. Do not imply that borrowing SAP terminology supplies these capabilities.

## Original discussion order (historical)

Start with questions **1–4, 7 and 12–13**. They establish positioning, goal semantics, progress semantics, evidence boundaries and the most consequential acceptance ambiguities. Record each answer with an owner and whether it is confirmed, assumed or deferred.

Use the real profile example already documented in [the explainability design](explainability-design.md): `E0137`, missing goal, and an eligible-activity comparison conditional on the employee selecting Senior Backend Engineer. It exercises clarification, critical gaps, history and evidence without inventing motives or silently selecting a career goal.
