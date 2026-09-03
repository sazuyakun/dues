# Security and privacy baseline

## Data classification

Payment names, amounts, notes, dates, categories, provider URLs, and
payment-method labels are private financial metadata. Dues treats them as
sensitive even though it does not store credentials or execute payments.

## Implemented boundaries

- Payments and settings are stored in the versioned `dues` IndexedDB database
  in the current browser profile.
- Application features use service and repository contracts; React components
  do not open IndexedDB directly.
- Dues never asks for bank passwords, UPI PINs, CVVs, full card numbers, or full
  bank-account numbers.
- User-entered names, notes, categories, labels, and imported strings are
  rendered as text rather than HTML.
- Provider-management links must use HTTPS without embedded credentials. They
  open only after a user action, in a separate browsing context without opener
  access.
- Imported files are size- and count-limited, schema-validated, and previewed
  before any mutation. Invalid or duplicate records block import.
- Merge preserves every existing record and skips conflicting IDs. Replacement
  requires explicit confirmation and uses one atomic transaction, so failure
  leaves the previous register intact.
- Existing-record mutations use optimistic version tokens to prevent silent
  overwrites from stale views.

## Network-request inventory

The production application requests only its same-origin HTML, JavaScript,
CSS, manifest, local icons, and generated service-worker assets. The service
worker precaches that static application shell and does not add a runtime
network cache. There are no analytics, advertising, telemetry, external fonts,
CDN scripts, account APIs, or synchronization requests.

A provider-management URL is a normal external link selected by the user. Dues
does not fetch it, append payment data, or contact it in the background.
Development mode additionally uses Vite's same-origin development server and
hot-module-replacement WebSocket; those are not present in the production
build.

## Browser and build controls

`index.html` declares a restrictive Content Security Policy: scripts and normal
resources are same-origin, object embedding is disabled, and form actions and
base URLs are restricted to the same origin. Inline style attributes remain
allowed because theme selection sets the native color scheme and Vite injects
development styles.

Dependencies are pinned by `pnpm-lock.yaml`. CI installs that exact graph,
runs formatting, lint, strict type checks, unit tests, a production build, and
browser journeys. Pull requests also run GitHub's dependency review. The
browser suite checks for unexpected third-party requests and exercises the
offline application shell.

## Backups

Dues backup files are portable, versioned UTF-8 JSON. **They are plain text and
are not encrypted.** Anyone who can access a backup can read its financial
metadata, so users should store and transfer it accordingly. The application
does not retain an imported file or a downloaded copy after the browser/file
system has completed the user-requested operation.

Encrypted export, password storage, and password recovery are not part of the
MVP. A future encrypted format would require authenticated encryption, a
password-derived key, and a new documented format path rather than silently
changing the current format.

## Threat model and limitations

Dues reduces exposure to remote data collection, third-party scripts, unsafe
provider links, malformed backups, silent import overwrite, and stale local
writes. It does not protect data from malware, a compromised browser, a
malicious extension, or someone who controls an unlocked device or browser
profile. IndexedDB is not separately encrypted by Dues and inherits the
device/browser's storage protections.

Clearing site data or losing a browser profile can remove local records.
Private-browsing implementations may discard storage when their session ends.
In-app reminders work while Dues is open; the MVP does not promise background
notification delivery.

## Vulnerability reporting

Follow [the repository security policy](../.github/SECURITY.md). Do not include
private payment data, secrets, or exploitable detail in a public issue.
