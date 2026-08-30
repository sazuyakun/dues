# Tooling and web application shell

## Workspace

Dues uses a pnpm workspace with applications under `apps/*` and shared packages
under `packages/*`. Node.js 22 or newer and the pnpm version declared by the
root `packageManager` field are required. Install exactly the locked dependency
graph with:

```sh
pnpm install --frozen-lockfile
```

The root commands are:

- `pnpm dev` — start the Vite development server;
- `pnpm lint` — lint the workspace;
- `pnpm typecheck` — run strict TypeScript checks in every workspace project;
- `pnpm test` — run tests in every workspace project;
- `pnpm build` — build every workspace project;
- `pnpm test:e2e` — build and smoke-test the production app with Playwright;
- `pnpm format:check` — check formatting without changing files.

GitHub Actions runs install, lint, type-check, unit-test, build, and Chromium
browser-test steps. The build and test tools are development dependencies only.

## Web shell

`apps/web` is a React application built by Vite. React Router owns the shell's
Upcoming, Payments, Add/Edit, Backup, and Settings routes. Their content is
intentionally illustrative in Phase 1; payment calculations, persistence, and
backup parsing belong to the independently developed shared packages.

The responsive layout uses a sidebar on wide screens and bottom navigation on
narrow screens. It uses system fonts and contains no external scripts, fonts,
images, analytics, or advertising. Theme preference is the one shell setting
temporarily stored directly in local storage; the integration phase will move
it behind the storage package's settings interface. The `system` choice reacts
to operating-system color-scheme changes.

## Application boundary

`apps/web` declares `@dues/core`, `@dues/storage`, and `@dues/backup` as
workspace dependencies. Feature code consumes those packages through the
application contracts exported by `apps/web/src/app/index.ts`; React features
must not open Dexie, parse backup JSON, or reproduce schedule calculations.

The boundary exposes `PaymentService`, `SettingsService`, and `BackupService`.
Payment records use the canonical core payment value plus storage-owned
`createdAt` and `updatedAt` metadata. Every mutation of an existing payment
requires the `updatedAt` value from the record the user acted on. A stale token
is reported as a conflict so the feature can reload instead of overwriting a
newer local change.

`ApplicationProvider` accepts an asynchronous initializer and exposes three
startup states: initializing, ready, and display-safe failure. The provider
closes initialized resources on unmount and offers retry after recoverable
startup failures. Production repository and service construction is supplied
by the storage-integration work; the web package includes deterministic
in-memory service doubles for component tests.

Current date, clock, and ID generation are available through an injected
`ApplicationEnvironment`. Production uses browser-provided time and a
cryptographically strong UUID source; tests use fixed dates, instants, and IDs.
Feature components must not call `Date.now()`, construct billing dates from
timestamps, or generate IDs directly.

Route-level features export named components from a public `index.ts` within
their feature directory. `AppRoutes` composes only those public exports. Until
Gate 2 features are integrated, Phase 1 pages are isolated behind temporary
route-level fallback exports in `app/featureFallbacks.ts`.

Shared UI components are intentionally small: page headings, labelled fields,
status and loading messages, empty states, and confirmation dialogs. Feature
specific layout and behavior remain inside each feature directory.

## PWA and offline behavior

`vite-plugin-pwa` generates the web app manifest and a Workbox service worker.
The production build precaches its HTML, JavaScript, CSS, manifest, and local
icons. Navigation falls back to the cached `index.html`, so after one successful
production load the application shell can reopen without a network connection.
There is no runtime cache and the production application makes no third-party
requests.

The manifest uses local 192px, 512px, and scalable icons with standalone display
mode. The larger icon includes a safe background area for maskable icon shapes.

## Content Security Policy

The HTML declares a restrictive policy allowing resources from the same origin,
with local images also permitting data URLs. Scripts do not allow inline code or
dynamic evaluation. Styles permit inline declarations because Vite injects CSS
during development and theme selection sets the native color scheme. WebSocket
connections support development hot-module replacement; the production app does
not initiate one. Objects are disabled, while form submissions and base URLs are
restricted to the same origin.
