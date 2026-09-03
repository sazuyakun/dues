# Dues

> Know what's due.

Dues is a free, open-source, local-first progressive web app for tracking
subscriptions, autopay mandates, and other recurring payments. It works without
an account, keeps its data in the browser, and remains usable offline after the
first successful load.

## What the MVP includes

- first-use privacy guidance and a persisted default currency;
- add and edit flows for standard or custom recurring schedules;
- searchable payment management with pause, archive, restore, and confirmed
  permanent deletion;
- overdue and upcoming groups, in-app reminder flags, and monthly/yearly totals
  kept separate by currency;
- correct mark-paid advancement across overdue periods, short months, and leap
  years;
- light, dark, and system appearance preferences; and
- deterministic, versioned JSON export with previewed merge or atomic
  replacement import.

Start with [the product definition](docs/product.md),
[MVP scope](docs/mvp.md), and [security baseline](docs/security.md) for the
product boundaries. The completed integration is described in
[the Phase 2 plan](docs/phase-2-integration-plan.md).

## Using Dues

On first launch, choose the currency new payments should use and continue to
the payment form. Required payment fields are name, amount, currency,
frequency, next due date, and status; optional context includes category,
payment-method label, trial date, reminder lead time, provider URL, and notes.

The Upcoming view groups active records by urgency and never combines
currencies. The Payments view provides search, category/status filters, editing,
state changes, and permanent deletion with confirmation. Reminder flags appear
inside Dues while it is open; background delivery while the app is closed is
not guaranteed.

The Backup view exports plain UTF-8 JSON. **Backup files are not encrypted and
contain private financial metadata.** Import always validates and previews the
file first. Merge adds only new IDs and preserves local conflicts; replacement
is confirmed and applied atomically.

## Local development

Requirements are Node.js 22.12 or newer and pnpm 10.31. Install and start the
application with:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Useful commands:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

The browser suite runs the production build against Chromium, Firefox, and
WebKit. Install their Playwright runtimes locally with:

```sh
pnpm --filter @dues/web exec playwright install chromium firefox webkit
```

## Privacy and offline behavior

Payments and preferences are stored in a versioned IndexedDB database in the
current browser profile. Dues has no account, server synchronization,
analytics, advertising, bank connection, or third-party runtime asset. It does
not request card numbers, bank-account numbers, CVVs, PINs, or banking
passwords.

The production service worker precaches the application shell. After one
successful online load, the same browser profile can reopen the app offline and
use its locally stored records. Clearing site data, using private-browsing
storage, or losing the browser profile can remove those records, so keep a
private backup when the data matters.

Security issues should be reported through the process in
[`.github/SECURITY.md`](.github/SECURITY.md), without publishing sensitive
details in a public issue.
