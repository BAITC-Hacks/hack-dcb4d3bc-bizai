# Documentation

Current behavior is documented against the repository on 2026-09-23. These guides describe the implementation; they do not certify a running deployment or live AI quality.

| Read this | To do this |
| --- | --- |
| [Getting started](getting-started.md) | Run, configure, validate and operate a local instance |
| [Architecture](architecture.md) | Find ownership boundaries, data stores, APIs and invariants |
| [UX](ux.md) | Understand navigation, terminology and state handling |
| [User flows](user-flows.md) | Walk through employee, manager and HR tasks |
| [AI assistance](ai-assistance.md) | Understand evidence, preferences, provider calls and fallbacks |
| [Deployment](../deploy/README.md) | Work with the checked-in Docker/k3s/CI setup |
| [Implementation status](implementation-status.md) | See current capabilities and historical validation records |

## Product context and historical material

[Repository context](repo-context.md) is the original analysis. [Delivery plan](next-stage-plan.md), [quarterly review requirements](quarterly-review-requirements.md), [product direction](prototype-product-direction.md), [explainability design](explainability-design.md), [open product questions](corporate-development-questions.md) and the [Russian product memo](product-memo.ru.md) capture requirements and intent, including work that is still pending.

Files under `reviews/` are dated findings, not a consolidated current specification. [Previous UI reference](design-reference/previous-ui/README.md) contains archived source snapshots, not active application code. Prefer the current guides and linked implementation when historical statements conflict.

## Keep documentation current

When changing a route, mutation or user-visible default, update its guide alongside the code. Record test results with their scope; do not present old test counts or live-model timings as current guarantees. Keep credentials, local environment contents and real employee data out of examples.
