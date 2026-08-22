# MVP scope and acceptance criteria

## Recurring-payment record

Required fields:

- Name
- Amount stored in the currency's smallest unit
- ISO 4217 currency code
- Billing frequency: weekly, monthly, quarterly, yearly, or custom interval
- Next due date stored as a calendar date, not a timestamp
- Status: active, paused, or archived

Optional fields:

- Category
- Payment-method label such as "UPI", "Visa", or "bank mandate"
- Free-trial end date
- Notes
- Provider-management URL
- Reminder lead time

Payment-method labels must not invite users to enter complete card or account
numbers.

## Required features

- Create, read, update, archive, restore, and delete records
- Upcoming-payment timeline
- Search and filters for category and status
- Totals for the current month and year, separated by currency
- Correct schedule advancement across short months and leap years
- Responsive layouts for narrow mobile and desktop screens
- Offline launch after the first successful load
- Installable web-app manifest
- Light, dark, and system themes
- Versioned JSON export and import
- Accessible forms, focus states, labels, and keyboard navigation

## Reminder behavior

The MVP guarantees reminders inside the app. Calendar-file export may be added
if it fits the first implementation. System notifications are best-effort only;
the interface must explain that browsers may not deliver them while Dues is
closed.

## Definition of done

- All required user journeys work on current Chrome, Safari, and Firefox
- Core functionality works with the network disabled
- Automated tests cover schedule calculations and data import validation
- Browser-level tests cover adding, editing, archiving, exporting, and importing
- No production request is made to analytics or advertising services
- Security and privacy documentation matches actual behavior
- A clean installation can be built entirely from the public repository

## Deferred decisions

- Exact visual identity and icon
- Whether encrypted export ships in the first release or immediately after the
  portable plain JSON export
- Hosting provider
- Optional calendar integration

