# Phase 2 integration and MVP plan

Phase 1 established four independently tested foundations: the web/PWA shell,
the core domain and schedule engine, local IndexedDB persistence, and the backup
format and validation package. Those foundations are now present together in
the workspace, but the web application still renders illustrative data and
placeholder controls.

Phase 2 connects the packages into complete user journeys and takes Dues to its
documented MVP definition of done. This document coordinates that work across
the four persistent worktrees while preserving clear ownership and integration
gates.

## Phase 1 completion summary

Phase 1 delivered:

- a pnpm/TypeScript workspace with lint, type-check, unit-test, build, and
  browser-test commands;
- a responsive React/Vite application shell with routes for Upcoming, Payments,
  Add/Edit, Backup, and Settings;
- an installable PWA manifest, local icons, offline application-shell caching,
  restrictive Content Security Policy, and light/dark/system themes;
- a validated recurring-payment model, strict calendar-date utilities,
  recurrence advancement, upcoming grouping, search and filters, and totals by
  currency;
- a Dexie-backed IndexedDB repository with settings, payment CRUD,
  archive/restore, optimistic conflict detection, safe errors, and atomic bulk
  mutations;
- a documented versioned JSON backup envelope with strict validation,
  deterministic serialization, import preview, conflict reporting, and pure
  merge/replacement plans; and
- architecture, product, MVP, security, storage, domain, tooling, backup, and
  import-flow documentation.

Phase 1 intentionally did not connect these pieces into production user
journeys. The current web screens still use sample records, the payment and
backup controls are placeholders, and theme preference is temporarily stored
outside the settings repository.

## Phase outcome

At the end of Phase 2, a new user should be able to:

1. open or install Dues and understand its local-first privacy model;
2. select a default currency and add a first recurring payment;
3. create, find, edit, pause, archive, restore, and delete payments;
4. review overdue and upcoming payments and totals separated by currency;
5. mark a renewal paid and receive the correct next due date;
6. close and reopen the application offline without losing data; and
7. export a portable backup and safely preview and restore it without silent
   overwrite.

All required journeys must work with keyboard navigation and narrow mobile and
desktop layouts. Core functionality must work without a network connection,
account, server, analytics, or third-party runtime resource.

## Delivery strategy

Phase 2 has three integration gates. Do not skip a gate merely because feature
work can be started locally.

### Gate 1: contracts and application foundation

The first wave aligns shared data contracts and creates the application seams
that all feature work will consume. Unlike Phase 1, this gate is a deliberate
baseline chain rather than a four-way fan-out: Worktree 1 establishes the app
seams, Worktree 2 establishes the canonical domain, Worktree 4 aligns the
backup boundary, and Worktree 3 then implements services over the integrated
contracts. Each handoff is integrated before the next dependent assignment
starts, as detailed under `Integration procedure`.

Gate 1 is complete when:

- one canonical domain representation is used in application code;
- every locally valid payment can be stored, exported, and imported without
  losing recurrence semantics;
- `apps/web` declares and can resolve all three shared workspace packages;
- the application can initialize repositories and expose display-safe startup
  states; and
- stable feature entry-point and test-double contracts exist for parallel UI
  work.

After Gate 1 is integrated, every worktree must update from the new mainline
before starting its Gate 2 assignment.

### Gate 2: complete feature workflows

The second wave implements onboarding/settings, payment management, the
upcoming dashboard, and backup/restore in separate feature directories. Feature
code uses the application service boundary established in Gate 1. It must not
open Dexie directly or duplicate core scheduling and validation logic.

Gate 2 is complete when each feature passes focused component and unit tests and
exports a stable route-level component that the application owner can compose
without reaching into feature internals.

### Gate 3: composition and MVP acceptance

After all Gate 2 work is integrated, Worktree 1 connects the route-level
features, removes all sample data and disabled placeholders, and adds the
cross-feature browser journeys. Gate 3 is complete only when the full workspace
verification and MVP acceptance criteria pass.

## Agreed technical direction

- `@dues/core` owns the canonical in-memory recurring-payment and recurrence
  representation, validation rules, calendar behavior, queries, and totals.
- The canonical recurrence discriminator is `frequency`. Monthly, quarterly,
  yearly, and applicable custom recurrences retain anchor values so a payment
  created for the 29th, 30th, or 31st does not drift after a short month.
- `@dues/storage` persists the canonical payment fields and adds only persistence
  metadata such as `createdAt` and `updatedAt`. It remains the only package that
  knows about Dexie or IndexedDB.
- The backup wire representation must round-trip every canonical payment without
  changing its schedule. Dues has not publicly released backup version 1, so
  its schema and documentation may be corrected during Gate 1 rather than
  preserving a known lossy representation. Once Phase 2 ships, future breaking
  wire changes require a new format version and an explicit reader/migration.
- Core limits and backup limits must agree. A payment accepted by normal create
  or edit validation must also be exportable and importable. Shared validation
  rules should live in core or be derived from core instead of being copied with
  different lengths or currency behavior.
- Storage timestamps are internal metadata, not billing dates. Import adapters
  may generate consistent metadata for records from the portable format, but
  calendar dates must never be converted to timestamps.
- React features consume an application service/context boundary. They do not
  import database tables, create their own repositories, or contain backup
  parsing logic.
- Application services orchestrate package APIs but do not reimplement domain
  rules. For example, mark-paid uses the core schedule engine and persists the
  returned due date with optimistic conflict protection.
- User-entered amounts are parsed into non-negative safe integers in the
  currency's smallest unit before validation or persistence. Calculations never
  use floating-point major-unit values.
- IDs are generated locally with a browser-provided cryptographically strong
  UUID facility. Tests inject deterministic ID and time providers.
- Browser APIs for time, file download, file selection, and UUID generation are
  wrapped at feature or application boundaries so tests remain deterministic.
- Dates representing billing events remain strict `YYYY-MM-DD` calendar dates.
  The current calendar date is injected into calculations where practical to
  avoid timezone-dependent tests.
- Plain JSON backups are clearly described as unencrypted before download and
  import. Import never silently overwrites an existing record.
- User content is rendered only as text. Provider links use validated URLs,
  open safely, and never receive opener access.
- No production network request is added beyond loading the application's own
  static assets.

## Rules shared by all worktrees

1. Read `README.md`, `docs/product.md`, `docs/mvp.md`, `docs/security.md`,
   `docs/phase-1-parallel-plan.md`, this document, and the architecture document
   for the subsystem being changed.
2. Update the current worktree branch from the latest integrated mainline at
   each gate. Do not switch branches or work in the main worktree.
3. Stay within the owned paths listed below. If a required change falls outside
   ownership, record it for the integration owner instead of editing it.
4. Preserve strict TypeScript and named exports. Route-level features expose a
   public `index.ts` rather than requiring imports from internal files.
5. Keep shared package behavior independent of React. Keep Dexie and browser
   file APIs out of core and backup validation.
6. Do not add accounts, servers, sync, bank/card connections, analytics,
   advertising, external fonts, CDN scripts, or third-party runtime resources.
7. Never request or store full card numbers, account numbers, CVVs, PINs,
   passwords, or equivalent payment credentials.
8. Do not combine totals from different currencies or imply currency
   conversion.
9. Treat all names, notes, categories, labels, imported content, and provider
   URLs as untrusted input. Never render user content as HTML.
10. Every mutation needs an intentional pending, success, empty where relevant,
    and display-safe failure state. Destructive actions require confirmation.
11. Feature tests use fake services or repositories. Persistence tests continue
    to use fake IndexedDB. Browser tests exercise the real built application and
    IndexedDB.
12. Keep feature-specific styles and tests inside the owned feature directory
    where possible. Do not append unrelated feature rules to a shared stylesheet.
13. Do not introduce a new production dependency without recording why the
    platform and existing dependencies are insufficient.
14. Run the smallest relevant checks during development and the complete owned
    package/application checks before handoff.
15. Finish each gate with a focused commit and report its hash, public APIs,
    tests, assumptions, and remaining integration work.

## Shared application contracts

Gate 1 must establish a small application boundary that supports Gate 2 without
coupling feature components to storage implementation details. Exact names may
be refined by Worktree 1, but the capabilities must cover:

```ts
interface PaymentService {
  list(): Promise<readonly PaymentRecord[]>;
  get(id: PaymentId): Promise<PaymentRecord | undefined>;
  create(input: NewPaymentInput): Promise<PaymentRecord>;
  update(id: PaymentId, input: PaymentChanges): Promise<PaymentRecord>;
  markPaid(id: PaymentId, paidThrough?: CalendarDate): Promise<PaymentRecord>;
  pause(id: PaymentId): Promise<PaymentRecord>;
  archive(id: PaymentId): Promise<PaymentRecord>;
  restore(id: PaymentId): Promise<PaymentRecord>;
  delete(id: PaymentId): Promise<void>;
}

interface SettingsService {
  get(): Promise<AppSettings>;
  update(changes: AppSettingsPatch): Promise<AppSettings>;
}

interface BackupService {
  export(): Promise<BackupDownload>;
  preview(text: string): Promise<ImportPreview>;
  applyMerge(preview: ImportPreview): Promise<ImportResult>;
  applyReplacement(preview: ImportPreview): Promise<ImportResult>;
}
```

The boundary should also provide application initialization state, a safe error
mapping, an injectable current-date/time provider, and deterministic test
doubles. It does not need to expose Dexie, backup mutations, or Zod errors to
React components.

The service implementation must preserve optimistic concurrency. A feature that
acts on a previously loaded record supplies its `updatedAt` value where the
repository supports it and handles a conflict by reloading rather than silently
overwriting newer state.

## Worktree 1: application foundation, onboarding, and composition

### Exclusive file ownership

```text
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
tsconfig*.json
eslint.config.*
.github/
README.md
apps/web/package.json
apps/web/index.html
apps/web/vite.config.ts
apps/web/playwright.config.ts
apps/web/tsconfig.json
apps/web/public/
apps/web/src/App.tsx
apps/web/src/App.test.tsx
apps/web/src/main.tsx
apps/web/src/theme.ts
apps/web/src/styles.css
apps/web/src/app/
apps/web/src/components/
apps/web/src/features/onboarding/
apps/web/src/features/settings/
apps/web/src/test/
apps/web/e2e/app*.spec.ts
apps/web/e2e/onboarding*.spec.ts
apps/web/e2e/settings*.spec.ts
apps/web/e2e/shell.spec.ts
docs/architecture/tooling.md
docs/security.md
```

Do not implement payment, upcoming-dashboard, or backup feature internals owned
by the other worktrees. Composition may import their public entry points only
after Gate 2 integration.

### Gate 1 assignment

- Add `@dues/core`, `@dues/storage`, and `@dues/backup` as workspace
  dependencies of the web application and align the lockfile.
- Replace the monolithic placeholder structure with a route composition shell
  while preserving the current responsive navigation and PWA behavior.
- Define the shared application service interfaces, React provider/hooks,
  initialization states, safe error presentation, and deterministic test
  doubles described above.
- Create reusable accessible primitives needed by multiple features, limited to
  controls such as page headings, fields, dialogs, status messages, loading
  states, and empty states. Avoid a broad design-system rewrite.
- Establish feature entry-point conventions and temporary route fallbacks so
  Gate 2 branches can compile independently.
- Keep theme behavior working during the transition; permanent repository-backed
  settings are completed in Gate 2.
- Document the application boundary and updated workspace behavior.

### Gate 2 assignment

- Implement first-use onboarding with a concise privacy explanation, default
  currency selection, persisted completion state, and a direct path to adding
  the first payment.
- Replace direct local-storage theme persistence with `SettingsService` while
  preserving immediate light/dark/system behavior and system-theme changes.
- Implement Settings controls for default currency and appearance.
- Provide retry and recovery UI when application storage initialization fails.
- Keep onboarding resumable if the page closes before completion.
- Add focused component tests for first use, returning use, settings updates,
  theme behavior, and safe initialization errors.

### Gate 3 assignment

- Compose the four route-level features in `App.tsx` and remove every sample
  payment, disabled placeholder, and temporary fallback.
- Ensure navigation and deep links cover Upcoming, Payments, Add, Edit, Backup,
  and Settings without losing in-progress or persisted data unexpectedly.
- Add cross-feature browser journeys and offline-reopen coverage.
- Update the README from the Phase 1 status to accurate MVP usage, development,
  privacy, backup, and verification instructions.
- Reconcile security and tooling documentation with the production build.

### Acceptance criteria

- A first-time user sees onboarding; a returning user does not.
- Onboarding and settings survive a close/reopen cycle.
- The selected theme applies without exposing private data or causing a broken
  intermediate screen.
- Storage failures show actionable, display-safe states and can be retried when
  appropriate.
- All production routes use real feature implementations at Gate 3.
- The installable application shell still opens offline after one successful
  load and makes no third-party runtime request.

## Worktree 2: canonical domain contract and payment management

### Exclusive file ownership

```text
packages/core/
apps/web/src/features/payments/
apps/web/e2e/payments*.spec.ts
docs/architecture/domain-model.md
```

Do not edit application composition, storage, backup, root tooling, or shared UI
files. Request missing shared primitives in the handoff; do not create competing
copies outside the feature directory.

### Gate 1 assignment

- Make `@dues/core` the explicit canonical payment contract used by the app,
  storage, and backup adapters.
- Reconcile field constraints so normal validation and backup validation cannot
  disagree about a valid stored record.
- Preserve complete recurrence anchors and document why they are required for
  correct advancement after short months and leap days.
- Establish reusable schemas/types for create and edit input without introducing
  browser or persistence dependencies.
- Establish currency metadata or validation at the correct shared boundary so
  UI selection, core validation, and backup import accept the same supported
  codes.
- Add compatibility tests that exercise the agreed canonical examples supplied
  to Worktrees 3 and 4.

### Gate 2 assignment

- Implement an accessible add-payment form covering every required MVP field:
  name, amount, currency, frequency, next due date, and status.
- Support optional category, payment-method label, free-trial end date, notes,
  provider-management URL, and reminder lead time.
- Support standard and custom recurrences without exposing internal anchor
  fields unnecessarily; derive and preserve anchors correctly.
- Parse localized user-entered amounts into safe minor-unit integers and format
  amounts for display without using floating-point values for calculation.
- Implement edit with loaded values, validation, pending state, conflict-aware
  save, cancellation, and not-found handling.
- Implement the Payments list with search and category/status filters.
- Implement pause, archive, restore, and permanent delete. Archive, restore, and
  delete must use clear state-specific actions; permanent delete requires
  confirmation.
- Render provider links only after validation and with safe external-link
  behavior.
- Add focused tests for required/optional fields, invalid dates and amounts,
  custom recurrence, filtering, conflict handling, and destructive confirmation.

### Acceptance criteria

- A payment can be created in seconds with only required fields and immediately
  persists through reopen.
- Every MVP field can be added and edited without data loss.
- Invalid or unsafe amounts, dates, currency codes, recurrences, and URLs are
  rejected with field-level guidance.
- Search is case-insensitive and category/status filters use core query logic.
- Paused and archived payments are visibly distinguishable and can be restored
  through the documented state transitions.
- Permanent deletion is never triggered by a single unconfirmed action.
- Components are keyboard accessible and do not render user content as HTML.

## Worktree 3: storage integration and upcoming dashboard

### Exclusive file ownership

```text
packages/storage/
apps/web/src/services/
apps/web/src/features/upcoming/
apps/web/e2e/upcoming*.spec.ts
docs/architecture/local-storage.md
```

Do not edit `App.tsx`, other feature directories, backup parsing, core scheduling
logic, or root tooling. Application service implementations may depend on the
Gate 1 interfaces but must not redefine their public contracts.

### Gate 1 assignment

- Align storage types with the canonical `@dues/core` contract and depend on
  shared types instead of maintaining a divergent copy where practical.
- Preserve storage-owned `createdAt` and `updatedAt` metadata and the existing
  repository abstraction.
- Implement the production application services over core and storage,
  including repository initialization, safe error mapping, injected ID/time/date
  sources, and optimistic concurrency.
- Implement mark-paid orchestration by validating the stored record, advancing
  it through core, and persisting the new due date atomically with an expected
  update timestamp.
- Provide the storage-side translation of approved merge and replacement plans
  into one atomic `applyBulk` operation. Do not parse backup JSON here.
- Ensure replacement cannot clear existing records unless all imported records
  can commit in the same transaction.
- Add the required end-to-end package contract test that validates, persists,
  reloads, exports, previews, imports, and reloads one complete canonical record.
- Add service-level tests for initialization, validation boundaries, conflicts,
  quota/transaction errors, mark-paid, merge, replacement, and rollback.

### Gate 2 assignment

- Replace upcoming sample data with records loaded through the application
  service.
- Group active records into overdue, today, next seven days, later this month,
  and beyond using the core query API.
- Display current-month and current-year totals separately for every currency.
- Add loading, no-payments, no-upcoming-payments, and safe failure states.
- Implement mark-paid from upcoming rows with pending protection, correct
  overdue catch-up behavior, conflict recovery, and an accessible result
  announcement.
- Show in-app reminders when a payment falls within its configured lead time.
  Explain that Dues does not guarantee reminders while the application is
  closed.
- Add focused tests for every group, currency separation, paused/archived
  exclusion, mark-paid, overdue advancement, reminders, and empty/error states.

### Acceptance criteria

- Records remain available after the database closes and reopens.
- Upcoming groups and totals are produced by core rather than recalculated in
  components.
- Different currencies are never combined or converted.
- Marking paid advances to the first due date after the paid-through date and
  does nothing silently to paused or archived records.
- Concurrent changes produce a reloadable conflict state rather than lost data.
- In-app reminders respect lead time without promising background delivery.
- No component or service outside `@dues/storage` accesses Dexie directly.

## Worktree 4: backup round-trip and recovery workflow

### Exclusive file ownership

```text
packages/backup/
apps/web/src/features/backup/
apps/web/e2e/backup*.spec.ts
docs/data-format.md
docs/architecture/import-flow.md
```

Do not edit storage transactions, application composition, unrelated features,
core scheduling, or root tooling. The backup package remains a pure boundary;
browser file selection/download belongs in the feature directory.

### Gate 1 assignment

- Reconcile the backup payment schema with the canonical core contract.
- Correct the unreleased version 1 recurrence representation so export/import
  preserves frequency, custom interval, and required calendar anchor semantics.
- Align field limits and currency validation with normal application validation.
- Add explicit pure adapters between canonical payment values and backup wire
  records if the wire shape remains intentionally different.
- Define how storage-only timestamps are assigned on import without adding them
  to billing-date semantics or allowing untrusted values to bypass repository
  checks.
- Ensure create, validate, preview, serialize, and plan operations round-trip all
  required and optional fields.
- Add cross-package contract fixtures for monthly day 31, leap-day yearly,
  custom recurrence, every optional field, multiple currencies, and unsafe
  values.
- Update the format and import-flow documentation before Gate 1 is integrated.

### Gate 2 assignment

- Implement export from the current persisted record set and download a
  deterministic `.json` file with a useful local filename.
- Explain before export that the file contains private financial metadata and is
  not encrypted.
- Implement file selection, UTF-8 reading, size-limit handling, and safe parsing
  through the backup package.
- Present envelope errors without echoing untrusted input.
- Present valid, invalid, new, duplicate, and conflicting records in an
  accessible import preview.
- Provide explicit merge and replacement choices. Describe exactly what each
  choice will preserve or remove and require confirmation before applying it.
- Block application when any invalid record makes a plan unready.
- Send only ready, approved plans through the application service's atomic
  operation and show success or recoverable failure without reusing stale
  previews.
- Add focused tests for export, malformed/oversized/unsupported files, preview
  counts, conflicts, confirmation, transaction failure, and successful merge and
  replacement.

### Acceptance criteria

- Export followed by import preserves every user-visible field and the exact
  future schedule behavior.
- The exported file is versioned, deterministic for fixed inputs, portable, and
  visibly labelled as unencrypted.
- No malformed, oversized, unsupported, duplicate, or partially invalid import
  can mutate storage.
- Merge inserts only approved new records and never overwrites conflicts.
- Replacement is all-or-nothing and cannot leave an empty or partially replaced
  database after failure.
- Imported strings remain inert text and unsafe provider URLs are rejected.
- The backup package performs no IndexedDB or DOM operation.

## Integration procedure

All worktrees start each gate from the same integrated baseline. Before a gate,
confirm a clean working tree, fetch the latest mainline as authorized by the
worktree instructions, and merge it into the current descriptive branch.

### Gate 1 integration order

1. Worktree 1 — workspace dependencies, application contracts, providers,
   shared primitives, and route foundation
2. Worktree 2 — canonical domain contract and validation alignment
3. Worktree 4 — lossless backup contract, adapters, and documentation
4. Worktree 3 — storage alignment and production service implementations

Gate 1 is intentionally sequential. Integrate Worktree 1, then update the other
worktrees before Worktree 2 begins. Integrate Worktree 2, then update Worktrees
3 and 4. Worktree 4 aligns and lands the backup contract next; Worktree 3 then
updates again and implements the production services against the actual
integrated core, backup, and application APIs. Do not write service code against
guessed interfaces from another unmerged branch.

After each merge, install from the lockfile and run lint, type-check, unit tests,
and build. Resolve package manifest/configuration conflicts in favor of the root
workspace conventions without discarding tested behavior.

Before opening Gate 2, add one integration contract test proving that a
canonical payment containing all optional fields and anchored recurrence can:

```text
validate -> persist -> reload -> export -> parse -> preview -> import -> reload
```

The final value must preserve user fields and future schedule behavior. Do not
start parallel feature integration while this test fails.

### Gate 2 integration order

1. Worktree 1 — onboarding and persisted settings
2. Worktree 2 — add/edit and payment management
3. Worktree 3 — upcoming dashboard, totals, mark-paid, and reminders
4. Worktree 4 — export/import and recovery workflow

Run the complete root verification after every merge. Feature CSS, tests, and
public entry points should merge independently because they remain under
exclusive directories. Do not move feature internals during integration merely
for aesthetic consistency.

### Gate 3 integration

Worktree 1 updates from the fully integrated Gate 2 baseline, composes all route
features, removes temporary fallbacks, adds browser acceptance coverage, and
updates cross-cutting documentation. Integrate that final commit only after all
MVP checks below pass.

## Required browser journeys

Browser-level coverage must use the production application and exercise real
IndexedDB rather than mocked services. At minimum, cover:

1. complete onboarding and reopen as a returning user;
2. add a monthly payment due on the 31st and verify persistence;
3. edit required and optional fields;
4. search and filter active, paused, and archived records;
5. view overdue/today/upcoming groups and totals in at least two currencies;
6. mark an overdue payment paid and verify the correctly advanced date;
7. pause, archive, restore, and permanently delete with confirmation;
8. export a backup and restore it into an empty application;
9. preview a conflicting import and verify merge does not overwrite it;
10. replace data successfully and prove a failed replacement rolls back;
11. close the browser context, reopen the built app offline, and verify data;
12. complete core journeys with keyboard-only interaction.

Chromium coverage remains required in CI. Before declaring the MVP complete,
run representative journeys in current Chromium, WebKit, and Firefox engines
and record any browser-specific limitations.

## Phase 2 definition of done

Phase 2 is complete only when:

- all MVP journeys in `docs/product.md` work against real local persistence;
- every required feature in `docs/mvp.md` is implemented or explicitly returned
  to product review rather than silently omitted;
- the application contains no sample payments, disabled feature placeholders,
  or claims that implemented functionality is still forthcoming;
- schedule calculations and import validation retain their Phase 1 automated
  coverage;
- browser tests cover adding, editing, archiving, restoring, deleting,
  exporting, importing, and offline reopen;
- forms have labels, visible focus, keyboard operation, and accessible status
  and error announcements;
- the production build is installable, launches offline after first load, and
  makes no analytics, advertising, or third-party runtime request;
- plain exports are clearly labelled unencrypted and imports never silently
  overwrite existing data;
- security, privacy, architecture, data-format, and README documentation match
  actual behavior;
- a clean checkout installs from the lockfile and passes formatting, lint,
  type-check, unit tests, production build, and browser tests; and
- a security-reporting policy exists before a public release.

## Explicitly deferred beyond Phase 2

Do not expand Phase 2 to include:

- accounts, cloud synchronization, or shared household data;
- bank, card, UPI, email, or SMS integrations;
- initiating, modifying, or cancelling real payments;
- currency conversion or combined cross-currency totals;
- encrypted backup unless separately approved after portable JSON is complete;
- guaranteed background notifications;
- calendar export unless separately approved after the MVP passes;
- analytics, advertising, telemetry, or third-party trackers; or
- a broad visual redesign unrelated to completing the documented journeys.

## Copyable worktree instruction

Assign each worktree its section with this instruction:

> Read `docs/phase-2-integration-plan.md` and every product, MVP, security,
> Phase 1, and subsystem document it references. Confirm which gate is currently
> active, update your current worktree branch from the latest integrated
> mainline, and implement only your worktree's assignment and owned paths. Run
> the relevant tests, commit the result, and hand off the commit hash, public
> APIs, tests, assumptions, and remaining integration work. Do not begin Gate 2
> from a pre-Gate-1 baseline and do not implement another worktree's feature.
