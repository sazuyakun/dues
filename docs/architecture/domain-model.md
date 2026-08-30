# Core domain model and recurrence semantics

`@dues/core` is a deterministic TypeScript package. It has no React, storage,
network, or browser API dependency. Its public API is exported from
`packages/core/src/index.ts`.

## Canonical record contract

`RecurringPayment` is the canonical payment value exchanged by application,
storage, and backup adapters. It contains an ID, name, non-negative safe-integer
amount in minor units, supported ISO 4217 currency code, recurrence, next due
date, and `active`, `paused`, or `archived` status. Optional metadata matches the
MVP: category, payment-method label, free-trial end date, notes, provider URL,
and reminder lead days. Validation is strict, so unknown properties are
rejected.

Core exports `recurringPaymentSchema`, `validateRecurringPayment`, and their safe
validation counterpart for package boundaries. It also exports
`newPaymentInputSchema`/`NewPaymentInput` for a complete payment before a service
assigns its ID, plus `paymentChangesSchema`/`PaymentChanges` for partial edits.
The input types permit applicable anchors to be omitted; successful parsing
returns `ValidatedNewPaymentInput` or `ValidatedPaymentChanges`.
`applyPaymentChanges` validates an edit and the resulting complete canonical
record together. This prevents a service from persisting a patch that is valid
in isolation but invalid after it is merged.

Field limits are exported as `PAYMENT_FIELD_LIMITS` so adapters do not maintain
different copies:

| Field                 | Canonical rule                               |
| --------------------- | -------------------------------------------- |
| ID                    | 1–200 characters, no surrounding whitespace  |
| Name                  | 1–500 characters with visible text           |
| Category              | Optional, 1–200 characters with visible text |
| Payment-method label  | Optional, 1–200 characters with visible text |
| Notes                 | Optional, up to 10,000 characters            |
| Provider URL          | Optional, up to 2,048 characters             |
| Reminder lead days    | Optional integer from 0 through 3,650        |
| Custom interval count | Integer from 1 through 3,650                 |

Text remains plain untrusted data; core never interprets or renders it. Provider
URLs must use HTTPS, contain no embedded username or password, and contain no
surrounding whitespace. HTTP is accepted only for `localhost`, `127.0.0.1`, and
`[::1]` development URLs. UI consumers must still open a validated URL with safe
external-link behavior.

`SUPPORTED_CURRENCY_CODES`, `CurrencyCode`, `currencyCodeSchema`, and
`isSupportedCurrencyCode` form the shared currency boundary. The list contains
current and historical codes from the ISO 4217 Maintenance Agency's List One
and List Three. Historical codes remain accepted so a stored record or backup
does not become invalid when its currency is withdrawn. Currency totals remain
separate even when more than one code is present.

Calendar dates use exactly `YYYY-MM-DD`. Parsing rejects impossible dates and
supports years `0001` through `9999`. Calculations use UTC calendar components,
never the host timezone. Occurrence projection ends cleanly when the next
occurrence would fall beyond that representable range.

## Recurrence

- Weekly means seven calendar days.
- Monthly and quarterly mean one and three calendar months.
- Yearly means one calendar year.
- Custom intervals support positive counts of days, weeks, months, or years.
- Counts are capped at 3,650 to reject unreasonable inputs.

Only month and year custom intervals carry calendar anchors; strict validation
rejects irrelevant anchor fields on day and week intervals.

Month-based schedules retain their original day as `anchorDay`. Year-based
schedules retain both `anchorMonth` and `anchorDay`. Record validation fills
missing anchors from the initial next-due date. If an anchor does not exist in a
target month, the occurrence falls on that month's last day; later occurrences
return to the anchor. Thus 31 January advances to 28 February and then 31 March.
Likewise, a 29 February yearly schedule uses 28 February in non-leap years and
returns to 29 February in leap years.

The split between input and canonical recurrence schemas is intentional.
`recurrenceInputSchema` permits UI input to omit internal anchors; parsing a
complete payment derives them from `nextDueDate`. `recurrenceSchema` describes a
canonical stored recurrence and requires every applicable anchor. Once derived,
an anchor is preserved during edits unless recurrence itself is intentionally
changed. This distinction prevents a stored 31st-of-the-month or leap-day
schedule from drifting after a short month, export, import, or reopen.

The compatibility tests define shared examples for downstream adapters:

- a monthly INR payment due on 31 January with every optional field;
- a yearly EUR payment due on 29 February; and
- a paused custom USD payment every two months from 31 January.

Storage and backup contract tests should use equivalent values and assert both
field equality and future schedule behavior after round-trip.

Marking an active payment paid advances at least once, then repeatedly until its
next due date is later than the supplied paid-through date. Paused and archived
records are returned unchanged.

## Queries and totals

Upcoming groups contain active records only. “Next seven days” is the inclusive
range tomorrow through `today + 7`; “later this month” begins after that range
and ends on the month's final day. Each group is ordered by date, then name.

Search is case-insensitive across name, category, payment-method label, and
notes, using locale-independent Unicode case conversion. Category and status
filters use exact values. Empty filter sets match no records, while omitted
filters impose no restriction. Date ties in upcoming groups use deterministic
binary name ordering.

Totals project active occurrences from each record's `nextDueDate` within the
requested inclusive calendar range. They therefore describe scheduled amounts,
not historical payments before `nextDueDate`. Results are keyed by currency and
are never combined. Addition throws if a currency total would exceed JavaScript's
safe-integer range. Current-month and current-year helpers use calendar periods
containing the supplied date.
