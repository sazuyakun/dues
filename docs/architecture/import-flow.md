# Backup import flow

The backup package is a pure boundary between untrusted JSON and storage. It
does not read IndexedDB, download files, display HTML, or write imported data.

```text
UTF-8 text + existing payment IDs
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
user approval and atomic storage operation (integration phase)
```

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

The public entry point is `packages/backup/src/index.ts`. It exports validation,
preview, serialization, plan builders, constants, and TypeScript contracts.
