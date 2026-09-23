# Setup and operations

## Local development

From the repository root, using Node.js 22.13 or newer:

```sh
node --version
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). Select a synthetic employee or the HR workspace. Managers enter as employees; direct-report access follows the current dataset's `manager_id` relationship.

`npm run demo` runs `npm ci`, `npm run build`, then `npm start`. It does **not** clear existing state. Stop the foreground server with Ctrl+C. For a separate demo database:

```sh
DATABASE_PATH=.data/walkthrough.sqlite npm run demo
```

## Configuration

Copy `.env.example` to `.env.local` only if a local file does not already exist. Next.js reads `.env` and `.env.local`; restart after changes. Relative paths resolve from the process working directory.

| Variable | Local default | Meaning |
| --- | --- | --- |
| `DATASET_DIR` | `case_source/case_1/career_quest_dataset` | Directory containing employees/events/skills JSON and history CSV for seed/reset |
| `DATABASE_PATH` | `.data/career-quest.sqlite` | SQLite database; parent directory is created as needed |
| `COOKIE_SECURE` | `false` | `true` for external HTTPS; keep false for local HTTP |
| `OPENAI_API_KEY` | Unset | Optional server-side provider credential |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Provider model configured by this app |
| `OPENAI_TIMEOUT_MS` | `8500` | Provider time budget, capped at 8500 ms |

Without a provider key, plans, catalog, reviews and imports remain usable. Requests to the advisor expose an unavailable/fallback state; they do not produce live AI recommendations. See [AI assistance](ai-assistance.md).

The Docker runner defaults to absolute paths under `/app`, `PORT=3000` and `HOSTNAME=0.0.0.0`. Pass runtime settings using `docker run -e KEY=value` or `--env-file`. Environment files and local databases are excluded from the image.

## Persistence and reset

The first repository access seeds an empty database. Subsequent starts reuse it. Keep fixtures available for reset even after initial seeding.

| Operation | Effect |
| --- | --- |
| Restart/rebuild | Reuses the configured database |
| Import | Atomically merges new or identical employee/history records; rejects conflicting duplicates |
| HR reset | Restores fixtures, clears plans, plan action records and demo completions; increments dataset revision and review scope |
| Reset audit retention | Old reviews, decisions and approvals remain in inactive scopes; old advisor/consultation rows remain stored but are not current context |

Reset is not secure data erasure. It does not clear the sessions table. Use a dedicated database for demonstrations and tests.

SQLite uses WAL. For a simple file backup, stop the application before copying the database directory; do not copy only a live `.sqlite` file and assume it includes WAL writes. The deployment receiver uses a consistent SQLite backup before image updates. Its backups remain on the same host; see [deployment](../deploy/README.md).

## Import instructions

1. Enter HR → `/hr/data`.
2. Select the employee JSON envelope and/or participation-history CSV. Preserve the original schemas; examples are in the [dataset README](../case_source/case_1/career_quest_dataset/README.md).
3. Preview and inspect counts/errors before applying. Each UI file is limited to 2 MB; the API body is limited to 5 MB.
4. Apply against the preview revision. If data changed meanwhile, preview again.
5. Search the imported employee in HR and inspect the resulting profile/history.

New IDs merge, identical rows remain unchanged, conflicting rows fail. References are checked against the merged dataset, so employees and their history can arrive together. Imports do not replace the event/skill catalog or overwrite existing employee records. A conflicting imported completion after a demo completion can require resetting the demo first; reset discards the working state described above.

## Validation

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:http
npm run test:ai
npm run test:reviews
npm run test:identity
```

The HTTP suites start their own production-mode servers and temporary databases; they require a completed build. They do not require a separately running development server.

| Suite | Default port | Override | Main coverage |
| --- | --- | --- | --- |
| `test:http` | 3101 | `SMOKE_PORT` | Pages/locales, employee scope, planning, import/reset and retired routes |
| `test:ai` | 3103 | `AI_SMOKE_PORT` | Provider-disabled fallback, scoped chat, preferences, adoption and retries |
| `test:reviews` | 3105 | `REVIEW_SMOKE_PORT` | Draft/submission, manager/HR decisions, revisions and reset isolation |
| `test:identity` | 3107 | `IDENTITY_SMOKE_PORT` | Public account selection and session behavior |

Example: `SMOKE_PORT=3201 npm run test:http`. Unit tests run through Node's test runner with `tsx`. The Docker `test` stage builds and runs all listed checks. For browser walkthroughs use [user flows](user-flows.md); automated HTTP checks do not establish visual quality or live model accuracy.

## Troubleshooting

| Symptom/message | Check or recovery |
| --- | --- |
| SQLite unavailable at startup | Check `node --version`; use Node 22.13+ |
| Fixture read failure | Run from the root; verify `DATASET_DIR` and the four source files |
| SQLite cannot open/write | Check `DATABASE_PATH` and directory permissions; containers run as UID/GID 1000 |
| Login returns to entry on local HTTP | Check `COOKIE_SECURE=false` and browser cookie settings |
| Mutation returns `Forbidden` | Check session/role and `Origin`; API mutations require an HTTP(S) Origin whose host matches the Host header |
| `Plan changed; reload before saving` | Another save advanced the plan revision; reload and reconcile edits |
| `Context changed` | Dataset, plan, consultation or review revision moved; reload current state before a new command |
| `Dataset changed; preview again before applying` | Run import preview again; the old revision cannot be applied |
| `Assessment changed` on approval | The review evidence is stale; employee must reopen/resubmit against current assessment evidence |
| Advice disappears after a save | Advice is revision-scoped; reconfirm preferences and ask again |
| Missing proficiency scale | An older stored dataset may lack descriptions; fixture reset reloads them but discards working state |

For deployment installation, probes, image rollback and persistent-volume constraints, use [the deployment runbook](../deploy/README.md).
