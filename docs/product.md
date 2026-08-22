# Product definition

## Product

**Name:** Dues  
**Tagline:** Know what's due.  
**One-line description:** A private, local-first tracker for subscriptions and
recurring payments.

## Problem

Recurring payments are spread across cards, UPI mandates, bank accounts,
wallets, and invoices. People often cannot answer three simple questions:

1. What will renew next?
2. How much am I committed to spending?
3. Which services am I still paying for but no longer use?

## Initial audience

Individuals who want a simple overview of their subscriptions and autopay
commitments without connecting a bank account or surrendering financial data to
another service.

## Core promise

Dues lets a person manually record recurring payments, see upcoming renewals,
and understand their recurring spend. It works without an account or network
connection and does not collect payment credentials.

## Design principles

1. **Private by default:** Core features work entirely on-device.
2. **Calm, not judgmental:** Show facts and timely reminders without shaming
   spending choices.
3. **Honest totals:** Never combine different currencies into a misleading
   number.
4. **Low effort:** Adding or updating a recurring payment should take seconds.
5. **User-owned data:** Export is a core feature, not an escape hatch.
6. **Progressive enhancement:** The basic experience works even when browser
   notification or installation features are unavailable.

## MVP user journeys

### First use

The user opens Dues, sees a short privacy explanation, selects a default
currency, and can add the first recurring payment without creating an account.

### Add a recurring payment

The user records its name, amount, currency, billing frequency, next due date,
and optional metadata. It immediately appears in upcoming payments and totals.

### Review upcoming dues

The user sees payments grouped by time: overdue, today, next seven days, later
this month, and beyond.

### Maintain a payment

The user can mark a renewal as paid, edit it, pause it, archive it, or delete it.
Marking it paid advances the next date according to its billing schedule.

### Move or recover data

The user exports a portable backup and can import it on the same or another
device. Importing never silently overwrites existing data.

## Explicitly outside the MVP

- Bank, card, UPI, email, or SMS integrations
- Initiating, cancelling, or modifying real payments
- Storing account numbers, card numbers, CVVs, PINs, or banking credentials
- User accounts and server-side synchronization
- Currency conversion
- Shared household accounts
- Guaranteed background push notifications
- Usage analytics, advertising, or third-party trackers

## Success criteria

The MVP succeeds when a new user can install the app, add five recurring
payments, understand what is due next and the total per currency, close and
reopen the app offline without data loss, and export then restore their data.

