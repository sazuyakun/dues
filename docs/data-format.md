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
| `name`        | 1–200 characters, no surrounding whitespace                         |
| `amount`      | Non-negative safe integer in the currency's smallest unit           |
| `currency`    | Recognized current or historical ISO 4217 alphabetic code           |
| `recurrence`  | Recurrence object described below                                   |
| `nextDueDate` | Real calendar date in `YYYY-MM-DD` form                             |
| `status`      | `active`, `paused`, or `archived`                                   |

Optional fields are `category` (1–100 characters), `paymentMethodLabel` (1–100
characters), `freeTrialEndDate`, `notes` (up to 10,000 characters),
`providerUrl` (up to 2,048 characters), and `reminderLeadDays`. Category and
payment-method labels cannot have surrounding whitespace. Dates use the same
strict calendar representation. Reminder lead time is a non-negative integer
number of days, limited to 3,650. Unknown record properties are rejected.

The recurrence discriminator is `frequency`, matching the canonical Dues
payment contract. Weekly recurrence contains only its frequency:

```json
{ "frequency": "weekly" }
```

Month-based recurrence stores its original calendar day, even when the next
due date has been clamped to a shorter month:

```json
{ "frequency": "monthly", "anchorDay": 31 }
{ "frequency": "quarterly", "anchorDay": 31 }
```

Yearly recurrence stores the original month and day:

```json
{ "frequency": "yearly", "anchorMonth": 2, "anchorDay": 29 }
```

A custom recurrence contains an interval count and singular unit. Day and week
intervals do not have calendar anchors:

```json
{ "frequency": "custom", "interval": { "count": 10, "unit": "day" } }
{ "frequency": "custom", "interval": { "count": 2, "unit": "week" } }
```

Custom month intervals require `anchorDay`; custom year intervals require both
`anchorMonth` and `anchorDay`:

```json
{
  "frequency": "custom",
  "interval": { "count": 2, "unit": "month", "anchorDay": 31 }
}
{
  "frequency": "custom",
  "interval": {
    "count": 2,
    "unit": "year",
    "anchorMonth": 2,
    "anchorDay": 29
  }
}
```

Interval counts are positive safe integers limited to 3,650. Anchor days are
1–31 and anchor months are 1–12. Required anchors make schedule behavior
portable: a monthly payment anchored on day 31 can be due on 28 February and
still return to day 31 in March, and a leap-day yearly payment returns to 29
February in leap years. Readers reject missing or irrelevant anchor fields
rather than infer schedule history from a possibly clamped due date.

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

`createdAt` and `updatedAt` are local persistence metadata and are not part of
the portable payment record. Export projects only the fields documented above.
On import, the application assigns fresh, consistent persistence timestamps as
part of the approved atomic storage operation; imported values cannot provide
or override them. Billing dates remain calendar dates and are never derived
from those timestamps.

Exports are serialized with two-space JSON indentation, one final newline, and
payments sorted by ID. Given the same records and `exportedAt`, serialization is
deterministic. Object field order follows the format order shown by the package.

Format evolution uses a new integer `version` whenever interpretation changes.
Version 1 readers do not accept future versions. Migration belongs in an
explicit future reader, never in permissive schema coercion. No public Dues
release emitted the earlier development draft that used a `type` discriminator,
so version 1 readers intentionally reject that lossy draft instead of treating
it as an alternate representation.
