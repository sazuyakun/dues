# Local storage architecture

## Boundary

`@dues/storage` is the only package that knows Dues uses Dexie and IndexedDB.
Application and import code consume `PaymentRepository` and
`SettingsRepository`; they do not receive a database, table, or transaction.
The package performs no network requests.

`createStorage()` opens the database before returning repositories. An absent
IndexedDB API and open failures become `StorageError` values with stable codes
and display-safe messages. Raw browser errors are retained only as `cause` for
diagnostics and must not be shown directly to users.

`apps/web/src/services` is the production application boundary over these
repositories. It owns browser UUID and clock adapters, maps storage failures to
the stable application error vocabulary, and exposes the payment, settings, and
backup service interfaces consumed by React. Components never receive a
repository or Dexie object.

## Database and migrations

The default database name is `dues`. Schema version 1 introduced:

- `payments`, keyed uniquely by `id`, with indexes for status, next due date,
  currency, and update metadata;
- `settings`, keyed by the constant singleton key `app`.

Schema version 2 keeps those indexes and upgrades every payment through the
canonical core validator. This fills recurrence anchors on legacy development
records while preserving payment fields and storage timestamps. If an old row
cannot be validated, the upgrade aborts instead of dropping or partially
rewriting data.

Schema declarations are append-only. A future change adds a new
`version(n).stores(...).upgrade(...)` declaration while retaining all earlier
versions so Dexie can upgrade existing databases transactionally. Destructive
migrations require an explicit product decision and backup guidance; opening a
database must never silently clear it.

## Records and metadata

Payment amounts are non-negative safe integers in minor currency units. Billing
and trial dates are calendar-date strings. `createdAt` and `updatedAt` are ISO
timestamps because they are change metadata, not billing dates.

The stored payment shape is `@dues/core`'s `RecurringPayment` plus `createdAt`
and `updatedAt`. Storage imports that contract directly and validates every
normal write, bulk write, and loaded row through core. Recurrence uses a
`frequency` discriminator, and month/year intervals retain their required
calendar anchors. Legacy input may be normalized by core, but storage never
reimplements or changes recurrence semantics.

Normal `create` assigns both timestamps. Normal `update`, archive, and restore
preserve `createdAt` and advance `updatedAt`. Import-oriented bulk writes accept
complete records and preserve their supplied metadata. Consumers should pass an
`expectedUpdatedAt` value when changing a previously read record; a mismatch is
reported as a conflict rather than overwriting newer data.

Restore changes an archived payment to `active`. The storage layer cannot infer
whether a former non-archived state was active or paused; preserving that state
would require a separate domain field.

## Atomic import writes

`applyBulk` accepts an already reviewed plan of creates, updates, and deletes.
Before writing, it checks the entire plan for repeated IDs, create conflicts,
missing update/delete targets, stale `updatedAt` values, and basic persistence
invariants. It then executes all mutations in one Dexie read-write transaction.
Any validation or IndexedDB failure aborts the complete plan.

Backup parsing, record limits, preview generation, and the choice between merge
and replacement belong to `@dues/backup`, not this package.

The application backup service translates only ready plans. Merge becomes a set
of creates, so a newly appearing ID produces a conflict and the whole
transaction rolls back. Replacement becomes one mutation per ID: creates for
new IDs, version-checked updates for shared IDs, and version-checked deletes for
IDs absent from the import. All imported rows receive one fresh ISO timestamp
that is later than the current stored versions. Consequently replacement never
clears the current register before every imported row has been validated and
accepted in the same transaction.

## Application orchestration

`createApplicationInitializer()` opens storage and returns implementations of
the contracts in `apps/web/src/app`. Its ID, current-date, and instant providers
are injectable; production uses local calendar dates, `Date`, and
`crypto.randomUUID()`, while tests use deterministic providers.

Payment creation and editing pass through core validation before persistence.
Mark-paid reloads and validates the stored record, rejects inactive records,
uses core to advance through every overdue occurrence, and writes the new due
date with the caller's expected `updatedAt`. Concurrent mutations therefore
surface as a reloadable conflict rather than overwriting a newer value.

Portable export omits storage timestamps. Import assigns fresh persistence
metadata after backup validation; billing dates remain strict calendar dates
and are never converted to timestamps.

## Upcoming read model

The route-level Upcoming feature reads records only through `PaymentService`.
It passes those canonical values and the injected current calendar date to
core's grouping and period-total APIs; React does not reproduce scheduling or
currency arithmetic. Paused and archived records are therefore excluded by the
same domain rules used elsewhere, and totals remain separate per currency.

Reminder flags are derived in memory from `nextDueDate` and
`reminderLeadDays`. They are intentionally described as in-app reminders:
there is no background scheduler, network request, or promise that a closed
browser will deliver them. Mark-paid sends the displayed `updatedAt` token and
today as the paid-through date. A conflict reloads the current list before the
safe conflict message is shown.

## Errors

Callers can branch on these `StorageError.code` values:

- `unavailable` and `initialization` for database setup;
- `quota` and `transaction` for write/runtime failures;
- `duplicate`, `conflict`, and `not-found` for repository preconditions;
- `invalid-data` for violated storage invariants.

The public messages contain no payment fields, imported values, database paths,
or implementation details.
