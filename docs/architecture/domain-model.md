# Core domain model and recurrence semantics

`@dues/core` is a deterministic TypeScript package. It has no React, storage,
network, or browser API dependency. Its public API is exported from
`packages/core/src/index.ts`.

## Record contract

A recurring payment contains an ID, name, non-negative safe-integer amount in
minor units, uppercase three-letter currency code, recurrence, next due date,
and `active`, `paused`, or `archived` status. Optional metadata matches the MVP:
category, payment-method label, free-trial end date, notes, provider URL, and
reminder lead days. Validation is strict, so unknown properties are rejected.
Text remains plain untrusted data; this package never interprets or renders it.
URL syntax is checked here, while protocol policy belongs to backup/import and
UI boundaries.

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
