# Dues backup data format

Dues exports portable UTF-8 JSON. **These files are plain text and are not
encrypted.** Anyone who can read a backup can read its private financial
metadata. Store and share it accordingly.

## Format version 1

The top-level object is a strict envelope; unknown properties are rejected.

```json
{
  "format": "dues-backup",
  "version": 1,
  "exportedAt": "2026-08-30T10:00:00.000Z",
  "payments": []
}
```

- `format` is always `dues-backup`.
- `version` is an integer format version. Readers reject unknown versions rather
  than guessing how to interpret them.
- `exportedAt` is an RFC 3339 timestamp with an offset. It describes the export,
  not a billing event.
- `payments` contains at most 10,000 recurring-payment records.
- A UTF-8 backup may be no larger than 5 MiB (5,242,880 bytes).

Each payment has these required fields:

| Field         | Representation                                                      |
| ------------- | ------------------------------------------------------------------- |
| `id`          | 1–200 characters, no surrounding whitespace, unique within the file |
| `name`        | 1–500 characters containing at least one non-whitespace character   |
| `amount`      | Non-negative safe integer in the currency's smallest unit           |
| `currency`    | Recognized current or historical ISO 4217 alphabetic code           |
| `recurrence`  | Recurrence object described below                                   |
| `nextDueDate` | Real calendar date in `YYYY-MM-DD` form                             |
| `status`      | `active`, `paused`, or `archived`                                   |

Optional fields are `category` (up to 200 characters), `paymentMethodLabel`
(up to 200 characters), `freeTrialEndDate`, `notes` (up to 10,000 characters),
`providerUrl` (up to 2,048 characters), and `reminderLeadDays`. Dates use the
same strict calendar representation. Reminder lead time is a non-negative
integer number of days, limited to 3,650. Unknown record properties are
rejected.

Standard recurrence objects contain only `type`, whose value is `weekly`,
`monthly`, `quarterly`, or `yearly`. A custom recurrence is:

```json
{ "type": "custom", "interval": 2, "unit": "weeks" }
```

`interval` is a positive safe integer and `unit` is `days`, `weeks`, `months`,
or `years`.

Currency validation is based on the official ISO 4217 Maintenance Agency's
[current and historical lists](https://www.six-group.com/en/products-services/financial-information/market-reference-data/data-standards.html)
published on 2026-01-01. Historical codes remain valid so a portable backup
does not expire when a currency is withdrawn. New codes require a package data
update but do not require a backup format change.

Provider URLs must use HTTPS and must not embed a username or password. For
local development only, HTTP is accepted when the hostname is exactly
`localhost`, `127.0.0.1`, or `[::1]`. Consumers must still treat URLs as
untrusted and open them with safe browser-link behavior.
Names, labels, categories, and notes are untrusted plain text and must never be
rendered as HTML.

Exports are serialized with two-space JSON indentation, one final newline, and
payments sorted by ID. Given the same records and `exportedAt`, serialization is
deterministic. Object field order follows the format order shown by the package.

Format evolution uses a new integer `version` whenever interpretation changes.
Version 1 readers do not accept future versions. Migration belongs in an
explicit future reader, never in permissive schema coercion.
