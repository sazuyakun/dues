# Backup import flow

The backup package is a pure boundary between untrusted JSON and storage. It
does not read IndexedDB, download files, display HTML, or write imported data.

```text
canonical/storage records -> portable-field projection -> UTF-8 export

UTF-8 import text + existing payment IDs
        |
        v
size / JSON / envelope / version / count checks
        |
        v
strict per-record validation and duplicate detection
        |
        v
preview: valid + invalid + new + conflicts
        |
        v
explicit merge or replacement plan
        |
        v
user confirmation and atomic application-service operation
```

The public `toBackupPayment` adapter copies only canonical portable fields, so
storage-only `createdAt` and `updatedAt` values cannot leak into an export. The
`fromBackupPayment` adapter returns a detached canonical value and never creates
persistence metadata. Although the portable field names match the canonical
contract, these explicit adapters keep the trust and persistence boundaries
visible and prevent structurally compatible objects from carrying extra fields
across them.

Envelope failures stop preview because the file cannot be interpreted safely.
These include malformed JSON, an oversized file, an unsupported version, an
invalid or surprising envelope, and excessive record count. Errors contain a
stable code, a display-safe message, and where applicable a property path or
record index. They never echo arbitrary imported values.

Once the envelope is trusted, records are handled independently. The preview
lists schema-valid records and invalid records; valid records are further split
into new IDs and conflicts against the caller-supplied existing-ID set. Every
occurrence of an ID that is duplicated among schema-valid records is invalid,
so file ordering cannot decide which value wins. Script-like strings are
accepted as inert text, while unsafe provider URLs are rejected.

A merge plan contains only new records as inserts and preserves conflicts for
an explicit later decision; it never silently overwrites. A replacement plan
contains every valid record. If the preview contains any invalid record, both
plan builders return a blocked (`ready: false`) result with diagnostics and no
records that could accidentally be applied. Creating a plan performs no
mutation. The integration layer must show the preview, require approval, and
send only a ready plan to the storage package's atomic bulk operation.
Replacement must not clear existing data unless the complete replacement can
commit atomically.

Immediately before applying an approved ready plan, the application service
assigns fresh `createdAt` and `updatedAt` values from its injected clock. It
uses one consistent operation time and submits those records through repository
validation in the same atomic bulk mutation. Imported JSON cannot select these
timestamps, and an import failure cannot leave timestamped partial records.

## Browser workflow

The route-level backup feature owns the browser file boundary. Export asks the
application service for deterministic JSON, creates an `application/json` Blob,
and downloads it with the service-provided local-date filename. The object URL
is revoked after the browser has received the click. Before this action, the
screen identifies the payment metadata in the file and states that the export
is plain text and unencrypted.

Import uses a labelled file input and reads the selected file explicitly as
UTF-8. The feature rejects a browser-reported size above 5 MiB before reading;
the backup package applies the same byte limit to the decoded text so a caller
cannot bypass it. Envelope failures receive a display-safe explanation without
showing imported content. A trusted envelope produces counts and ruled lists
for valid, invalid, new, duplicate, and conflicting records.

Invalid or duplicate records disable both import choices. A ready merge is
described as insert-only: it preserves every local record and skips conflicts.
A ready replacement is described as the complete future register, including
the removal of local records absent from the backup. Each choice opens an
accessible confirmation dialog before calling the application service. The UI
discards the preview as soon as an approved operation starts, on success or
failure, so retry requires reading and validating the file again rather than
reusing a stale snapshot.

The public entry point is `packages/backup/src/index.ts`. It exports validation,
preview, serialization, canonical/wire adapters, plan builders, constants, and
TypeScript contracts.
