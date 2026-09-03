# Phase 3 statement-import plan

Phase 2 completed the documented MVP: a person can record recurring payments by
hand, see what renews next, and export or restore a portable backup. Every
record still arrives through manual entry, so Dues answers the first two
questions in `docs/product.md` well and the third one poorly. A payment the user
has forgotten is a payment the user will not type in.

Phase 3 closes that gap without changing what Dues is. The user exports a
statement from their own bank or card portal, opens it in Dues, and Dues
proposes the recurring payments it can see. Detection runs entirely in the
browser tab. Dues gains no account, no server, no bank connection, and no new
network request.

## Why not a bank connection

Automatic discovery is normally built on an aggregator: Plaid, TrueLayer, or an
RBI Account Aggregator. Every one of those requires a server to hold the client
secret, an account system to bind a connection to a person, and server-side
retention of the user's transaction history so that background refresh can run
while the app is closed. That is the opposite of the product in
`docs/product.md` and would invalidate most of `docs/security.md`.

A user-supplied statement file gets the same detection result from data the user
already has, with no credential, no third party, and no transmitted byte. The
trade is that discovery is a deliberate action the user repeats rather than a
background process. Phase 3 accepts that trade.

## Phase outcome

At the end of Phase 3, a user should be able to:

1. open the Statement view and read what the file will and will not be used for
   before selecting anything;
2. select a CSV statement exported from their bank or card provider;
3. confirm how its columns and date format are interpreted, correcting the
   detected mapping when it is wrong;
4. review proposed recurring payments with their evidence, cadence, amount, and
   confidence;
5. accept the proposals that are real, edit any of them before accepting, and
   reject the rest;
6. see which proposals already match a tracked payment, and accept a corrected
   amount when a tracked price has changed; and
7. leave the view knowing that the statement itself was never stored, exported,
   or transmitted.

Nothing is written to IndexedDB without an explicit per-proposal acceptance.

## Privacy position

A statement is more sensitive than everything Dues currently stores. A payment
record holds what the user chose to write down. A statement holds a complete
transaction history, frequently including balances, counterparties, and an
account identifier. Phase 3 therefore treats the imported file as hostile input
and as classified data at the same time.

The rules are absolute:

1. Statement content is never written to IndexedDB, never included in a backup
   export, never placed in the service-worker cache, never written to
   `localStorage` or `sessionStorage`, and never retained in a File System
   Access handle.
2. Statement content is never sent anywhere. The production network inventory in
   `docs/security.md` must remain unchanged by this phase.
3. Statement content is never written to the console, an error message, an error
   `cause`, or a thrown `Error` string. Diagnostics carry a stable code, a
   display-safe message, a column name, and a row index, in the style already
   used by the backup package.
4. Parsed rows live in memory for the duration of the review and are dropped
   when the review ends, whether it ends in acceptance, rejection, navigation,
   or failure.
5. Only the fields of an accepted proposal cross into a payment record. The
   underlying transactions do not, and no transaction identifier is kept.
6. Values that look like account or card numbers are redacted before they reach
   the screen or a proposed record. Dues does not want them and must not become
   a place they are stored.

Rule 6 is a hard requirement rather than a nicety. Statement descriptors
routinely carry a masked or unmasked instrument number. A digit run of six or
more characters, allowing internal spaces and hyphens, is replaced with a fixed
placeholder during normalization, before display and before any proposal is
built. The redaction is applied to the value Dues keeps, not only to the value
Dues shows.

## Non-goals

Phase 3 does not add, and must not be expanded to add:

- bank, card, UPI, email, or SMS connections, including read-only ones;
- accounts, servers, sync, or any transmission of user data;
- storage of account numbers, card numbers, CVVs, PINs, or credentials;
- retention of the statement file or any transaction after review;
- initiating, modifying, or cancelling real payments;
- currency conversion or combined cross-currency totals;
- automatic acceptance of a proposal, or automatic mutation of a tracked
  payment; or
- guaranteed background notification, which still requires a push server and
  remains deferred.

## Package boundary

Detection lands in a new pure package, `@dues/statements`, that mirrors the
trust boundary already established by `@dues/backup`. It converts untrusted text
into proposals and does nothing else. It must not import React, Dexie, browser
file APIs, or any network client, and it must not read or write storage.

The package owns parsing, column mapping, normalization, redaction, grouping,
cadence inference, and confidence scoring. It reuses `@dues/core` for calendar
arithmetic, recurrence normalization, and schedule advancement, and must not
reimplement any of it. A proposed next due date is produced by advancing the
last observed transaction date with the same engine that advances a real
payment, so a proposal cannot drift in ways a tracked payment would not.

Statement parsing is written in-package rather than added as a production
dependency. The format needed is a strict RFC 4180 reader with configurable
delimiter and quoting; that is small, and the alternative is granting a
third-party package first sight of the user's transaction history.

## Pipeline

```text
user-exported statement text + existing payment summaries
        |
        v
size / row-count / decoding checks
        |
        v
delimited parse into rows and header
        |
        v
column-mapping proposal  ->  user confirmation of columns and date format
        |
        v
strict per-row typing: date, signed minor-unit amount, currency, descriptor
        |
        v
descriptor normalization and instrument-number redaction
        |
        v
grouping by normalized descriptor and currency
        |
        v
cadence inference, amount clustering, confidence scoring
        |
        v
proposals: new / already tracked / amount changed / low confidence
        |
        v
per-proposal user review, edit, and acceptance
        |
        v
existing payment service create or update, one accepted proposal at a time
```

Everything above the review step is pure. Creating proposals performs no
mutation, exactly as creating a backup plan performs no mutation.

## Envelope and row limits

A statement is rejected before parsing when it exceeds 10 MiB of decoded UTF-8
text or 50,000 rows. The browser-reported file size is checked before reading,
and the package applies the same byte limit to the decoded text so a caller
cannot bypass it. A file that cannot be decoded as UTF-8, has no header row, or
has no usable date, amount, and description column is rejected with a
display-safe explanation and no partial result.

Rejection is total. A malformed statement never produces a partial proposal set,
because a partial set silently understates what the user is paying for and is
worse than no answer.

## Column mapping and date format

Statement layouts are not standardized. The package proposes a mapping by
inspecting header names and sampling values, and the user confirms or corrects
it before any detection runs. Required roles are transaction date, description,
and amount. Optional roles are currency, and a separate debit/credit column or
indicator where the provider does not use signed amounts.

Where a currency column is absent, the user selects the statement currency
explicitly. It is never assumed from the default currency setting, because a
wrong currency produces a confidently wrong total, and `docs/product.md` treats
honest totals as a design principle.

Date format is confirmed, never guessed. A column containing `03/09/2026` is
ambiguous, and the two readings differ by six months. When sampled values do not
disambiguate the order themselves, the user must choose the format before the
step can complete. Only debits are candidates; credits, refunds, and transfers
are excluded from grouping and reported as an excluded count so the user can see
the file was read completely.

## Detection

Normalization uppercases the descriptor, strips known processor prefixes such as
`SQ *`, `TST*`, and `PAYPAL *`, removes trailing store, terminal, and reference
numbers, applies the instrument-number redaction, drops trailing location
tokens, and collapses whitespace. Normalization is data-driven and conservative:
an unrecognized descriptor is grouped on its collapsed form rather than
aggressively rewritten, because over-normalization merges two real services into
one wrong proposal.

Rows are grouped by normalized descriptor and currency, then clustered by amount
within the group. Two occurrences belong to the same cluster when their amounts
are within the greater of five percent of the cluster median or one minor unit.
The proposed amount is the most recent amount in the cluster, so a price
increase proposes the new price rather than an average of both.

Cadence is inferred from the sorted gaps between occurrences, using the median
gap so that one irregular charge cannot move the result:

| Median gap in days | Proposed recurrence                |
| ------------------ | ---------------------------------- |
| 6–8                | weekly                             |
| 27–32              | monthly, anchored to the modal day |
| 87–95              | quarterly, anchored to the modal   |
| 358–372            | yearly, anchored to modal month    |
| anything else      | custom interval in days            |

Monthly and quarterly anchors use the most frequent day of month rather than the
mean, because providers move a charge off a weekend or holiday and the mean
would drift the anchor away from the true billing day. This is the same class of
problem the Phase 1 anchor rules already solve for manually entered payments, and
it is solved the same way.

Confidence combines three observations: how many occurrences the cluster has,
how consistent its gaps are, and how stable its amounts are. A cluster with at
least three occurrences, low gap variance, and stable amounts is high
confidence. A cluster with two occurrences has exactly one gap, cannot
distinguish a subscription from a coincidence, and is always low confidence. A
low-confidence proposal is shown, marked, and never pre-selected.

Proposals are then compared against existing payments supplied by the caller as
summaries. A proposal matching a tracked payment on normalized name and currency
is labelled already tracked. When the matched payment's amount differs from the
proposed amount beyond the cluster tolerance, it is labelled amount changed and
offers an update to the tracked record. A tracked payment is never modified
without that explicit acceptance.

## Browser workflow

The Statement route owns the browser file boundary, in the same shape as the
backup route. Before the file input, the screen states plainly that the file is
read in the browser, is not uploaded, is not stored, and is discarded when the
review ends. It also states that Dues does not need and will not keep account or
card numbers.

Review is a list of proposals, each showing the proposed name, amount, currency,
cadence, next due date, confidence, occurrence count, and the redacted dates and
amounts it was derived from. Every field is editable before acceptance; the
detection result is a draft, not an authority. High-confidence new proposals are
pre-selected, low-confidence proposals are not, and already-tracked proposals
are shown but inert unless they carry an amount change.

Acceptance calls the existing `PaymentService` create and update operations. It
does not open Dexie, and it does not introduce a bulk path that bypasses
per-record validation. A failure part-way through reports which proposals were
applied and leaves the rest available, because silently losing half an
acceptance is the failure mode users cannot recover from.

Leaving the route discards the parsed statement and the proposal set. Returning
requires selecting the file again. Reusing a stale in-memory snapshot is
forbidden for the same reason the backup preview is discarded once an operation
starts.

All statement content is rendered as text. Descriptors are untrusted strings and
are subject to the same rule as names, notes, and imported values in
`docs/security.md`.

## Verification

Phase 3 is complete when:

- unit tests cover the delimited parser against quoted fields, embedded
  delimiters, embedded newlines, and a truncated final row;
- unit tests cover redaction against masked and unmasked instrument numbers, and
  assert that no proposal or diagnostic retains a digit run of six or more;
- unit tests cover cadence inference for weekly, monthly, quarterly, yearly, and
  custom intervals, including a weekend-shifted monthly series, a 29th-of-month
  series crossing February, and a leap year;
- unit tests cover amount clustering across a price increase, and confidence
  scoring for two-occurrence and irregular clusters;
- unit tests assert that a rejected envelope yields no partial proposals and
  that diagnostics never echo a parsed value;
- a test asserts that `@dues/statements` imports nothing from React, Dexie, the
  storage package, or any network API;
- a browser test imports a fixture statement, confirms the mapping, accepts a
  subset, and verifies that only accepted proposals exist in IndexedDB;
- a browser test asserts that no network request is made during a statement
  import, extending the existing third-party request check;
- a browser test asserts that a backup exported after a statement import
  contains only payment records and no statement content;
- a browser test asserts that IndexedDB, `localStorage`, and `sessionStorage`
  contain no statement content after a completed and after an abandoned review;
  and
- `docs/product.md`, `docs/mvp.md`, `docs/security.md`, `docs/data-format.md`,
  and `README.md` describe the feature accurately, including the statement of
  what is not retained.

The documentation update is part of the phase, not a follow-up. `docs/product.md`
currently lists bank and card integrations as outside the MVP; that line stays
true and must not be softened, because a user-supplied file is not an
integration. `docs/security.md` gains a statement-handling section and keeps its
network inventory unchanged.

## Explicitly deferred beyond Phase 3

Do not expand Phase 3 to include:

- PDF, OFX, QIF, or MT940 statement parsing, until CSV is proven;
- detection of stopped or lapsed subscriptions from a gap in the statement;
- category inference from merchant descriptors;
- persistence of a normalization dictionary learned from user corrections;
- multi-file or multi-account reconciliation in one review;
- encrypted backup, which remains a separate decision; or
- any of the standing non-goals in `docs/product.md`.

## Copyable worktree instruction

> Read `docs/phase-3-statement-import-plan.md` and every product, MVP, security,
> data-format, and architecture document it references. Implement only the
> statement package or the statement route as assigned, keeping detection pure
> and free of storage, React, and network access. Treat the statement file as
> classified input that is never persisted, exported, logged, or transmitted.
> Run the relevant tests, commit the result, and hand off the commit hash,
> public APIs, tests, assumptions, and remaining integration work.
