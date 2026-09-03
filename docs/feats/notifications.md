# Notifications and deadline reminders

## Status

Feature proposal. Dues already marks payments that are inside their configured
reminder window in the Upcoming view. This document extends that foundation
into a reminder center, optional system notifications, and a privacy-preserving
way to hand reminders to the user's calendar.

## Goal

A user should be warned before a recurring payment is due without having to
scan the full payment list. Reminders must remain useful when notification
permission is unavailable or denied, must not imply that a payment was made,
and must not weaken Dues' local-first privacy model.

The feature answers four questions clearly:

1. What is approaching its due date?
2. How soon is it due?
3. Was the user already reminded for this billing cycle?
4. What can Dues actually deliver on this device?

## Product promise

Dues provides three reminder surfaces with different guarantees:

| Surface                    | Works offline                     | Works while Dues is closed            | Promise                                  |
| -------------------------- | --------------------------------- | ------------------------------------- | ---------------------------------------- |
| In-app reminder center     | Yes                               | No                                    | Always accurate when Dues is opened      |
| Browser or OS notification | Yes, when Dues is already running | Not reliably                          | Best-effort after explicit permission    |
| Calendar reminder export   | Yes, after import into a calendar | Usually, under the calendar's control | Static handoff, not live synchronization |

The interface must never summarize these as simply “notifications enabled.” It
states which surface is active and explains its delivery boundary. In
particular, Dues does not promise that a browser or OS notification will arrive
while the application is closed.

## Example user flow: Ravi's insurance renewal

Ravi pays INR 12,400 for vehicle insurance each year on 18 September. Missing
the renewal would matter more than being reminded a day late.

1. While adding the payment, Ravi chooses **Remind me 14 days before**. The
   payment form also offers due-date, one-day, three-day, seven-day, fourteen-day,
   and custom reminders without making him calculate a date.
2. Dues confirms that in-app reminders are ready. It separately offers **Allow
   system notifications** and explains that browser delivery is best-effort
   when Dues is closed. Only after Ravi selects that action does the browser's
   permission prompt appear.
3. Ravi allows the permission and receives a generic test notification:
   **Payment reminder from Dues**. The default does not expose the insurer or
   amount on his lock screen. He can opt into detailed notification text later.
4. Because Ravi wants a reminder even when he has not opened Dues recently, he
   also selects **Add to calendar**. Dues downloads locally generated calendar
   events for the next year, including a fourteen-day alarm. The screen explains
   that his calendar now owns those alerts and that he must export again after
   changing the payment.
5. On 4 September, opening Dues shows **Vehicle insurance · due in 14 days** at
   the top of the reminder center. If Dues has an execution opportunity and
   system permission is still granted, it also attempts one system
   notification. Ravi does not receive duplicates every time he changes tabs or
   reopens the app.
6. Selecting the reminder opens the payment in Upcoming. Ravi can mark it paid,
   snooze the current reminder until tomorrow, or dismiss only this reminder
   stage. Marking it paid advances the due date with the existing schedule
   engine and retires every notification associated with the old due date.
7. If Ravi revokes system permission, the in-app reminder continues to work and
   Settings shows **Blocked by browser** with instructions for restoring access.
   Dues never repeatedly prompts him.

## Reminder setup

The existing `reminderLeadDays` payment field remains the source of truth for
whether a payment has a reminder. The payment form presents it as understandable
choices rather than a bare numeric input:

- Off;
- On the due date;
- 1, 3, 7, or 14 days before; and
- Custom number of days.

Settings gains a default reminder lead time for newly created payments. The
initial default is three days, but it does not modify existing records or turn
system notifications on. A user may preview and explicitly apply a new default
to active payments that currently have no reminder.

Paused and archived payments do not produce reminders. Restoring or resuming a
payment recalculates its reminder state from the current due date. Deleting a
payment removes its local reminder-delivery state.

## Reminder stages

For each active payment and due-date cycle, Dues derives up to three stages:

1. **Approaching** — the current date enters the configured lead-time window.
2. **Due today** — the current date equals the payment's due date.
3. **Overdue** — the current date is later than the due date.

An approaching stage is emitted once per due-date cycle. If Dues was not opened
on the first day of the window, it emits the stage the next time it runs before
the payment is due. Due-today and overdue stages are distinct so a previously
dismissed early reminder cannot hide a missed deadline.

The stable deduplication key is the payment ID, due date, and stage. Delivery
receipts contain only those fields, the channel, and the calendar date on which
delivery was attempted. They are stored locally in IndexedDB, are not part of a
portable backup, and are pruned after the payment advances or is deleted.

Editing a due date or reminder lead time invalidates obsolete future stages and
recalculates the current one. Marking a payment paid retires stages for the old
due date before the next cycle is evaluated. A device-date change is handled by
rerunning the same idempotent calculation; no schedule is advanced merely
because a reminder ran.

When several stages become eligible together, the reminder center shows every
payment, but the system channel coalesces them into one calm notification such
as **3 payments are due soon**. Selecting it opens the relevant Upcoming group.

## In-app reminder center

Upcoming gains a reminder summary near the top of the page and the application
shell exposes the count through a labelled Reminders navigation item or badge.
The reminder center groups items into overdue, due today, and approaching. Each
item shows the payment name, amount and currency, due date, and relative time.
Currencies remain separate and are never totalled together.

Available actions are:

- open the payment;
- mark it paid;
- snooze the current stage until tomorrow or a selected calendar date; and
- dismiss the current stage.

Dismiss and snooze affect reminder presentation only. They never change the
payment status, due date, recurrence, or amount. The empty state confirms that
there are no current reminders and links to active payments without reminder
lead times.

The reminder center requires no system permission and remains the baseline
experience in every supported browser.

## System notification permission flow

Dues never asks for notification permission during onboarding or page load.
The user first sees an explanation and selects **Allow system notifications**.
The native permission request is made immediately from that user action.

Settings represents browser capability and permission separately:

- **Unavailable** — the current browser does not expose the required API;
- **Not enabled** — Dues has not asked;
- **Allowed** — Dues may attempt system delivery;
- **Blocked by browser** — permission was denied or later revoked; and
- **Best-effort only** — permission exists, with a reminder that closed-app
  delivery is not guaranteed.

A **Send test notification** action verifies the selected privacy mode and
device behavior. Denial leaves in-app reminders untouched. Dues does not ask
again unless the user deliberately returns to Settings and retries after
changing browser permission.

Notification content defaults to private mode:

- title: `Payment reminder from Dues`;
- body: `Open Dues to review what is due.`

Detailed mode may include the payment name, due date, amount, and currency. It
never includes notes, payment-method labels, provider URLs, statement evidence,
or account/card identifiers. Settings warns that system notifications can be
visible on a lock screen and retained in the operating system's notification
history outside Dues.

## Browser delivery constraint

A service worker is event-driven and may be terminated whenever it has no event
to handle. It is not a durable alarm clock, so Dues must not keep a timer in its
service worker and claim that it will fire days later. Reliable Web Push while
an application is inactive is initiated through a push service by an
application server, which Dues deliberately does not operate. The relevant
platform constraints are documented by the [Service Workers specification](https://www.w3.org/TR/service-workers/#service-worker-lifetime)
and [Push API specification](https://www.w3.org/TR/push-api/).

System delivery is therefore opportunistic. Dues evaluates reminders:

- after application startup and successful storage initialization;
- when the page becomes visible;
- after a payment is created, edited, resumed, restored, or marked paid;
- when the local calendar date changes while the page remains alive; and
- when another open Dues tab broadcasts a payment change.

When an event is eligible and permission is allowed, a notification adapter asks
the registered service worker to display it. The adapter has no scheduling,
storage, or domain logic. Feature detection is used instead of browser-name
checks. On iOS and iPadOS, WebKit documents system notification permission for
web apps added to the Home Screen and requires the request to follow a direct
user interaction; the interface should explain installation when that is the
only supported path. See [Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

Adding a server, push subscription, push endpoint, background synchronization,
or third-party notification provider requires a separate product and security
decision. It is not an implementation detail of this feature.

## Calendar handoff for closed-app reminders

For users who need a device-scheduled alert without a Dues server, the reminder
center can export selected reminders as an iCalendar (`.ics`) file. Generation
happens entirely in the browser and makes no network request.

Dues exports a finite set of future occurrences calculated by `@dues/core`
rather than an open-ended recurrence rule. This preserves Dues' short-month,
leap-year, quarterly, and custom-interval behavior in calendars whose recurrence
rules may handle invalid dates differently. The initial horizon is twelve
months, and every event receives a stable ID derived from the payment and due
date.

Calendar privacy defaults mirror system notifications. Private mode uses
`Payment due` as the event title and omits the amount, notes, payment method,
provider URL, and category. Detailed mode may include the payment name, amount,
and currency. The downloaded file is plain text private metadata, so the user is
warned before saving or sharing it.

This is a snapshot, not synchronization. Dues cannot confirm that the user
imported it, cannot remove events from the calendar, and cannot update them after
a payment changes. The export screen states the date through which events were
generated and recommends exporting again after schedule changes. Live calendar
subscriptions remain out of scope because they require a network endpoint.

## Application boundaries

Reminder eligibility and stage derivation belong in a pure domain function that
accepts canonical payments, a current calendar date, and delivery receipts. It
must reuse the existing calendar and schedule utilities and must not call browser
notification APIs.

Application services orchestrate payment reads, receipt persistence, and
notification attempts. React components consume a reminder service or view model
and do not open IndexedDB directly. Browser notification and file-download APIs
sit behind injectable adapters so tests use deterministic fakes.

The notification click target contains only an application-relative route and a
payment or group identifier. It does not place payment names, amounts, or other
private metadata in a URL. Multiple tabs coordinate through a local broadcast
and the receipt store so only one tab attempts a given system notification.

The production network inventory remains unchanged. No reminder event,
permission state, delivery receipt, calendar export, or notification content is
sent to Dues or a third party.

## Accessibility and tone

- Reminder status is conveyed through text as well as color or badges.
- New reminders and action results use polite live-region announcements without
  repeatedly interrupting screen-reader users.
- Every reminder action and permission control is keyboard operable with a
  visible focus state.
- System permission is optional; denial never blocks navigation or payment
  management.
- Copy is factual and calm: `Due in 3 days`, `Due today`, or `Overdue by 2 days`.
  It does not shame the user or label spending as wasteful.
- Notification settings explain browser limitations before permission is
  requested, in plain language rather than API terminology.

## Failure behavior

- If permission changes between eligibility and display, record no successful
  system delivery and update Settings from the browser's current state.
- If a system notification attempt fails, keep the in-app reminder and show a
  display-safe settings message without exposing payment data in an error.
- If receipt persistence fails, avoid a notification loop during the current
  session and report that duplicate suppression may not survive a restart.
- If calendar generation fails, do not produce a partial file.
- If another tab wins the deduplication race, the current tab treats the reminder
  as already handled and performs no second system attempt.

## Verification

The feature is complete when:

- unit tests cover approaching, due-today, and overdue stages at exact calendar
  boundaries;
- unit tests cover disabled reminders, paused and archived payments, restored
  payments, edited due dates, mark-paid advancement, and device-date changes;
- unit tests prove the same payment ID, due date, and stage is not delivered
  twice across visibility changes, reloads, or multiple tabs;
- unit tests cover coalescing several eligible payments without combining their
  currency totals;
- component tests cover every permission and capability state, explicit
  permission requests, private/detailed content, test notifications, denial,
  and revocation;
- browser tests verify in-app reminders and actions with notification support
  present, absent, allowed, and denied;
- browser tests verify notification clicks use private relative routes and no
  reminder action causes a third-party request;
- calendar tests cover finite schedules across short months and leap years,
  alarms, stable event IDs, escaping, private/detailed content, and atomic file
  generation;
- storage and backup tests prove delivery receipts and snooze state remain local
  operational metadata and do not enter portable backups;
- manual release checks cover actual system notification display in current
  Chrome, Firefox, Safari on macOS, and an installed iOS/iPadOS Home Screen app;
  and
- `README.md`, `docs/product.md`, `docs/mvp.md`, `docs/security.md`, and relevant
  architecture documents describe the implemented behavior and closed-app
  limitation accurately.

## Non-goals

This feature does not add:

- guaranteed browser notifications while Dues is closed;
- an application server, push subscription, or third-party push provider;
- email, SMS, WhatsApp, or messaging integrations;
- exact-to-the-minute alarms controlled by Dues;
- cross-device reminder synchronization;
- payment initiation, cancellation, or provider communication;
- alarm sounds, critical-alert privileges, or bypass of device focus modes;
- live calendar synchronization or calendar-account access; or
- analytics about permission, delivery, clicks, or reminder actions.
