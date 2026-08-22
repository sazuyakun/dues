# Security and privacy baseline

## Data classification

Subscription names, amounts, notes, dates, categories, and payment-method labels
are private financial metadata. Dues treats them as sensitive even though it
does not store credentials or execute payments.

## Threat model

The MVP is designed to reduce these risks:

- A remote service collecting or leaking a user's recurring-payment history
- Third-party scripts observing user data
- Malicious or corrupt backup files damaging local data
- User-entered notes or URLs causing script injection
- Accidental loss or overwrite during import
- Sensitive details appearing unnecessarily in notifications
- Dependency or deployment changes introducing unexpected network calls

## Security boundaries

- Application data is stored locally in the browser.
- Local data inherits the security of the device, operating system, and browser;
  it is not protected from someone who already controls an unlocked device or
  browser profile.
- Dues never asks for bank passwords, UPI PINs, CVVs, full card numbers, or full
  bank-account numbers.
- No third-party runtime scripts, fonts, trackers, or analytics are permitted in
  the MVP.
- Provider URLs are treated as untrusted input and opened safely.
- Imported data is schema-validated, size-limited, and previewed before merge or
  replacement.

## Backup policy

The data format must be documented and versioned. A plain JSON export is useful
for portability but must be clearly labelled as unencrypted. If encrypted
backups ship, they will use the Web Crypto API with an authenticated-encryption
scheme and a password-derived key. Passwords and derived keys will not be
stored.

There is no password recovery for a user-encrypted backup. The interface must
make that limitation clear before export.

## Non-goals

Dues does not claim to protect data from malware, a compromised browser,
physical access to an unlocked device, or malicious browser extensions. It is a
tracker, not a payment vault.

## Release requirements

- Content Security Policy appropriate for static hosting
- Locked dependencies and automated dependency review
- No secrets in source, build output, or repository history
- Tests for malformed, oversized, and unsupported backup files
- A security-reporting policy before public release
- Documentation of every network request made by the production build

