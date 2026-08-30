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

## Database and migrations

The default database name is `dues`. Schema version 1 contains:

- `payments`, keyed uniquely by `id`, with indexes for status, next due date,
  currency, and update metadata;
- `settings`, keyed by the constant singleton key `app`.

Schema declarations are append-only. A future change adds a new
`version(n).stores(...).upgrade(...)` declaration while retaining all earlier
versions so Dexie can upgrade existing databases transactionally. Destructive
migrations require an explicit product decision and backup guidance; opening a
database must never silently clear it.

## Records and metadata

Payment amounts are non-negative safe integers in minor currency units. Billing
and trial dates are calendar-date strings. `createdAt` and `updatedAt` are ISO
timestamps because they are change metadata, not billing dates.

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

## Errors

Callers can branch on these `StorageError.code` values:

- `unavailable` and `initialization` for database setup;
- `quota` and `transaction` for write/runtime failures;
- `duplicate`, `conflict`, and `not-found` for repository preconditions;
- `invalid-data` for violated storage invariants.

The public messages contain no payment fields, imported values, database paths,
or implementation details.
