# Phase 1 parallel implementation plan

This document coordinates the first implementation phase across four agents and
four Git worktrees. All worktrees start from commit `bf2e335`.

The repository currently contains product documentation only. There is no
application scaffold, package manager configuration, database, or test setup.
This phase establishes those foundations while keeping parallel changes as
independent as possible.

## Phase outcome

At the end of this phase, the repository should have:

- a buildable and testable progressive-web-app shell;
- a tested domain model and recurrence engine;
- a tested local persistence package;
- a documented, versioned, and validated backup format; and
- architecture documentation for each subsystem.

Connecting every subsystem into complete user journeys is a follow-up integration
phase. Agents must not expand their assignment to implement another agent's
subsystem.

## Agreed technical direction

- TypeScript
- React and Vite
- pnpm workspaces
- IndexedDB through Dexie
- Zod for runtime and import validation
- Vitest for unit tests
- Playwright for browser tests
- `vite-plugin-pwa` for the web manifest and offline application shell

The intended repository shape is:

```text
apps/
  web/                 React UI and PWA shell
packages/
  core/                Domain types, schedules, grouping, and totals
  storage/             IndexedDB repositories and local settings
  backup/              Versioned export and import validation
docs/
  architecture/        Technical decisions and subsystem documentation
```

## Rules shared by all agents

1. Read `README.md`, `docs/product.md`, `docs/mvp.md`, `docs/security.md`, and
   this document before changing code.
2. Stay within the file ownership assigned below. If a required change falls
   outside that ownership, document it in the handoff instead of editing the
   file.
3. Use strict TypeScript, named exports, and a `src/index.ts` public entry point
   for each shared package.
4. Do not add accounts, servers, synchronization, analytics, telemetry, external
   fonts, CDN scripts, or third-party runtime resources.
5. Store monetary amounts as non-negative safe integers in the currency's
   smallest unit. Never use floating-point major-unit values for persistence or
   calculation.
6. Store billing dates as `YYYY-MM-DD` calendar dates, never timestamps.
7. Never collect complete card numbers, account numbers, CVVs, PINs, bank
   passwords, or equivalent credentials.
8. Treat names, notes, labels, imported content, and provider URLs as untrusted
   input. Do not render user content as HTML.
9. Do not combine totals from different currencies.
10. Do not make production network requests except those needed to load the
    application's own static assets.
11. Add focused tests for all behavior introduced by the assignment.
12. Finish with a clean commit and a handoff containing the commit hash, public
    APIs, tests run, assumptions, and integration work still required.

## Shared domain vocabulary

Use these representations consistently across package boundaries:

```ts
type PaymentId = string;
type CalendarDate = `${number}-${number}-${number}`;
type MinorUnitAmount = number;
type PaymentStatus = "active" | "paused" | "archived";
```

Required recurrence options are weekly, monthly, quarterly, yearly, and a custom
interval. A recurring-payment record must support every required and optional
field in `docs/mvp.md`.

Agents may refine these types inside their owned package, but must record any
contract decision in their handoff so it can be reconciled during integration.

## Worktree 1: platform and web shell

Branch: `codex/worktree-1`

### Exclusive file ownership

```text
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
tsconfig*.json
eslint.config.*
.prettier*
.gitignore
.github/
apps/web/
docs/architecture/tooling.md
```

Do not create or edit anything under `packages/core`, `packages/storage`, or
`packages/backup`.

### Assignment

- Configure the pnpm workspace and root development commands.
- Scaffold the React/Vite application in `apps/web`.
- Add a responsive application layout and navigation.
- Add light, dark, and system theme support.
- Add placeholder routes or screens for Upcoming, Payments, Add/Edit, Settings,
  and Backup.
- Add an installable manifest and offline application-shell caching.
- Keep the generated HTML compatible with a restrictive Content Security Policy.
- Configure Vitest and Playwright.
- Add CI that installs locked dependencies, lints, type-checks, tests, and builds.
- Document commands, tooling choices, and PWA behavior.

Temporary UI fixtures are allowed. Do not implement recurrence logic, IndexedDB,
or backup parsing in the application package.

### Acceptance criteria

- A clean checkout can install from the lockfile.
- Lint, type-check, unit-test, and production-build commands pass.
- At least one browser smoke test loads the application.
- The built app can reopen its shell offline after one successful load.
- No external font, script, analytics, or advertising request is present.

## Worktree 2: domain model and schedule engine

Branch: `codex/worktree-2`

### Exclusive file ownership

```text
packages/core/
docs/architecture/domain-model.md
```

Do not edit root tooling or application files. The package may include its own
temporary package and TypeScript configuration so it can be tested independently;
the integration pass will align those files with the root workspace conventions.

### Assignment

- Define and validate the recurring-payment domain model.
- Implement calendar-date parsing, comparison, and formatting utilities.
- Implement schedule advancement after a payment is marked paid.
- Implement upcoming-payment grouping: overdue, today, next seven days, later
  this month, and beyond.
- Implement current-month and current-year totals separated by currency.
- Implement pure search and category/status filter functions.
- Document recurrence semantics and all edge-case decisions.

The package must remain deterministic and independent of React, IndexedDB, file
downloads, and other browser APIs.

### Required test coverage

- January 31 advancing into February and subsequent months
- February 29 across leap and non-leap years
- Monthly recurrence after a shortened month
- Quarterly and yearly recurrence
- Supported custom intervals
- An overdue payment that needs more than one advancement
- Paused and archived records where applicable
- Search and filters
- Multiple currencies that must never be combined
- Invalid calendar dates and unsafe monetary amounts

## Worktree 3: local persistence and settings

Branch: `codex/worktree-3`

### Exclusive file ownership

```text
packages/storage/
docs/architecture/local-storage.md
```

Do not edit root tooling, application files, or backup-format files. The package
may carry independent temporary test configuration until integration.

### Assignment

- Implement a versioned IndexedDB database using Dexie.
- Define migrations and a strategy for future schema versions.
- Implement payment create, read, update, archive, restore, delete, and list
  repository operations.
- Store onboarding completion, default currency, and theme settings locally.
- Expose repository interfaces so consumers do not depend directly on Dexie.
- Implement duplicate-ID and conflict detection.
- Provide an atomic bulk-write operation suitable for an approved import plan.
- Handle initialization, transaction, quota, and unavailable-storage errors in a
  form callers can display safely.
- Test persistence with a fake IndexedDB environment.

The package must not make network requests. It must not define the backup file
format or build React components.

### Acceptance criteria

- CRUD and archive/restore behavior is tested.
- Data remains available after closing and reopening the database.
- Bulk mutations are atomic and roll back on failure.
- Existing IDs are never silently overwritten.
- Created and updated metadata is preserved consistently.
- The IndexedDB implementation is hidden behind exported interfaces.

## Worktree 4: backup format and import validation

Branch: `codex/worktree-4`

### Exclusive file ownership

```text
packages/backup/
docs/data-format.md
docs/architecture/import-flow.md
```

Do not edit root tooling, application files, or IndexedDB code. The package may
carry independent temporary test configuration until integration.

### Assignment

- Define and document a versioned JSON backup envelope.
- Implement deterministic export serialization.
- Implement strict runtime validation for imported backups.
- Enforce documented file-size and record-count limits.
- Reject malformed JSON and unsupported format versions.
- Produce display-safe, structured validation errors.
- Produce an import preview containing valid records, invalid records, new
  records, and conflicts.
- Produce explicit merge and replacement plans without mutating storage.
- Define safe provider-URL validation. Production links should use `https:`;
  local-development exceptions must be documented.
- Clearly label plain JSON exports as unencrypted.

Validation and preview must be pure operations. This package must not access
IndexedDB, download files, or implement React screens.

### Required fixtures and tests

- Valid current-version backup
- Malformed JSON
- Missing required fields
- Invalid and impossible dates
- Negative, fractional, and unsafe monetary amounts
- Unsupported versions
- Oversized files and excessive record counts
- Duplicate IDs inside one backup
- Conflicts with a supplied set of existing IDs
- Unexpected properties
- Script-like notes, names, and labels
- Unsafe provider URL protocols

## Integration and merge procedure

Each agent works from the common baseline and commits only its owned paths.
Integrate completed branches in this order:

1. `codex/worktree-1` — workspace tooling and application shell
2. `codex/worktree-2` — core domain package
3. `codex/worktree-3` — persistence package
4. `codex/worktree-4` — backup package

After merging Worktree 1, package-manifest or configuration conflicts from the
other branches should be resolved in favor of the root workspace conventions.
Do not rewrite their tested implementation merely to match formatting.

Run the full root verification commands after every merge. If a package cannot
yet be consumed by the application, keep it independently testable and record
the missing connection as integration work.

## Follow-up integration phase

The next phase should connect the completed foundations in this direction:

```text
React screens
    |
    v
core domain services
    |
    v
storage repository interfaces
    |
    v
IndexedDB

backup validation -> import preview -> approved atomic repository operation
```

That phase should implement the real onboarding, payment form, upcoming timeline,
totals, edit/archive/restore/delete flows, mark-paid action, and backup screens,
followed by the browser-level journeys required by `docs/mvp.md`.

## Copyable agent instruction

Assign each agent its worktree section using this instruction:

> Read `docs/phase-1-parallel-plan.md` and all product/security documents it
> references. Implement only the assignment for your current worktree and obey
> its exclusive file ownership. Run the relevant tests, commit the result, and
> finish with the handoff requested by the plan. Do not implement another
> worktree's responsibilities.

