# PWA readiness

This document is the release checklist for making Dues available as an
installable phone application. It separates capabilities already present in the
repository from work that must be completed and verified against the production
origin. Items listed as present are implemented in the repository; they are not
proof that a specific deployment has passed the production or physical-device
checks.

## Release target

Dues is PWA-ready when a user can visit one canonical HTTPS URL, install it from
current Android Chrome or iPhone Safari, launch it in a standalone window,
continue using all core features after losing the network, retain local data
through an application update, and export then restore a backup.

An app-store package is not required for this release. Play Store and App Store
distribution are separate product decisions.

## Current readiness

| Area              | Present now                                                                                  | Work before release                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Application shell | Responsive React interface and local assets                                                  | Complete physical-phone and installed-mode checks                                                    |
| Manifest          | Name, description, standalone display, start URL, scope, theme colors, and 192/512/SVG icons | Add a stable `id`; finish the icon work below                                                        |
| Service worker    | Registered immediately; production shell precached with a navigation fallback                | Verify first install, updates, deep links, and cold offline launch on the production origin          |
| Local data        | Versioned IndexedDB storage and portable JSON backup/restore                                 | Verify data durability and mobile file round-trips; publish clear device-local warnings              |
| Quality gates     | Formatting, lint, type checks, unit tests, production build, and browser tests in CI         | Add deployment and post-deployment smoke gates                                                       |
| Delivery          | Reproducible static production build                                                         | Choose the canonical origin and host; add HTTPS hosting, rewrites, headers, deployment, and rollback |

The release is currently blocked by the unchecked deployment, icon, and manual
device-validation work in this document.

## Decisions to record before deployment

Record these choices in this document or the selected host configuration so
future changes do not silently alter the installed application's identity or
storage boundary.

1. Choose one canonical production origin. A root deployment such as
   `https://dues.example/` is strongly preferred because the current Vite,
   router, manifest, asset, and service-worker paths assume `/`.
2. Choose a static host that supports automatic TLS, HTTP-to-HTTPS redirects,
   single-page-application rewrites, response headers, atomic deployments, and
   rollback.
3. Decide whether a merge to `main` deploys automatically or promotes a tested
   build manually. Production must deploy only a commit that passed CI.
4. Define the supported release matrix. At minimum, test the current stable
   Android Chrome and iPhone Safari releases on real devices.
5. Decide whether to request persistent browser storage when the API is
   available. Backups remain required guidance either way because persistence
   is not a guarantee.

## Recommended implementation order

Complete the work in this order so device tests exercise the same configuration
that will be released:

1. finalize and register the full icon set;
2. choose the canonical origin and lock the manifest identity and path model;
3. configure the host's HTTPS, redirects, rewrites, MIME types, cache policy,
   and security headers;
4. add the serialized production deployment and compatible rollback workflow;
5. add generated-manifest, icon, service-worker, and mobile regression checks;
6. deploy a release candidate to the production-equivalent origin;
7. run the production smoke gate and physical Android/iPhone matrix;
8. fix every blocker, rebuild from the final commit, and repeat affected tests;
   and
9. record the release evidence, promote the tested artifact, and run the
   post-deployment smoke gate.

## Application icons

The icon should be a simple, geometric version of the Dues mark that remains
recognizable at small sizes. Use the existing product palette as the starting
point:

- Canvas: `#030403`
- Surface: `#070806`
- Text: `#f1eee5`
- Accent: `#a3d65c`

### Create the source artwork

1. Finalize one square SVG master for the icon. Prefer basic paths and solid
   fills so the mark renders consistently without external fonts or images.
2. Keep the important parts of the mark away from the edges. For maskable
   icons, all essential artwork should fit inside the centered safe-area circle
   whose diameter is 80% of the canvas.
3. Give maskable icons an opaque, full-bleed background. Do not rely on
   transparency outside the mark because launchers may expose or crop it.
4. Check the design at 16, 32, 48, 192, and 512 pixels. Fine borders and small
   gaps that disappear at the smallest sizes should be simplified.

Keep the SVG master in `apps/web/public/` so all exported assets can be
regenerated from the same source.

### Export the browser and install assets

Export or derive the following files from the approved master:

| Asset                   |      Size | Use                                    |
| ----------------------- | --------: | -------------------------------------- |
| `icon.svg`              |  Scalable | Browser favicon and vector fallback    |
| `icon-192.png`          | 192 x 192 | Standard PWA install icon              |
| `icon-512.png`          | 512 x 512 | High-resolution PWA install icon       |
| `icon-maskable-192.png` | 192 x 192 | Maskable launcher icon                 |
| `icon-maskable-512.png` | 512 x 512 | High-resolution maskable launcher icon |
| `apple-touch-icon.png`  | 180 x 180 | Apple home-screen icon                 |

PNG files should use an sRGB color profile and an opaque background. Review
each exported file rather than assuming that a smaller automatic resize keeps
the mark crisp.

### Register the assets

1. Add every generated file to `apps/web/public/` and to the `includeAssets`
   list in `apps/web/vite.config.ts`.
2. Keep standard and maskable entries separate in the web app manifest:
   standard icons use `purpose: "any"`; maskable icons use
   `purpose: "maskable"`.
3. Do not label a single tightly framed image as both `any` and `maskable`.
   Maskable artwork needs its own safe spacing so it survives circular,
   rounded-square, and other launcher crops.
4. Add favicon and Apple touch icon links to `apps/web/index.html`:

   ```html
   <link rel="icon" href="/icon.svg" type="image/svg+xml" />
   <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
   ```

5. Keep the manifest `theme_color` and `background_color` consistent with the
   icon unless the visual identity intentionally changes.

### Verify the result

- Build the production app and confirm every icon URL loads successfully.
- Inspect the generated manifest in browser developer tools and confirm the
  declared dimensions and `purpose` values match the actual files.
- Preview the maskable icon with circular and rounded-square crops; no
  meaningful part of the mark should be clipped.
- Install the app on at least one Android device or emulator and one Apple
  device or simulator, then check the launcher, recent-apps view, and launch
  transition.
- Confirm that the favicon remains recognizable in both light and dark browser
  chrome.

## Manifest and page metadata

The manifest in `apps/web/vite.config.ts` already provides the minimum launch
metadata. Finish and verify it before the first public installation:

1. Add an explicit manifest `id` tied to the canonical application path. Use
   `/` for a root deployment. Do not change it after release unless an identity
   migration has been planned.
2. Keep `start_url`, `scope`, Vite's `base`, the router base, asset URLs, and the
   service-worker scope aligned with the canonical application path.
3. Keep `display: "standalone"`, `name`, `short_name`, `description`, `lang`,
   `theme_color`, and `background_color` in the generated manifest.
4. Register standard, maskable, SVG, favicon, and Apple touch assets exactly as
   described in the icon section. Confirm that the generated manifest contains
   the expected URLs rather than source-only paths.
5. Keep the HTML viewport and theme-color metadata. Do not lock orientation;
   payment entry and backup recovery should work in portrait and landscape.
6. Treat screenshots, shortcuts, and an in-app install prompt as optional
   enhancements. They improve discovery but do not block the browser-menu
   installation path.

Inspect the generated `apps/web/dist/manifest.webmanifest`, then inspect the
browser-parsed manifest. A valid JSON file alone is insufficient if its URLs,
content type, or icons fail on the deployed origin.

## Deployment and hosting

### Build one immutable artifact

Build from the repository root with the locked dependency graph:

```sh
pnpm install --frozen-lockfile
pnpm --filter @dues/web build
```

Deploy only `apps/web/dist/`. Do not serve source files or run the Vite
development server in production. Record the source commit with the deployment
and publish the same artifact that passed the release checks.

### Serve the application correctly

The production host must:

- serve the canonical origin over HTTPS with a valid certificate and redirect
  HTTP to HTTPS;
- serve `/manifest.webmanifest` as `application/manifest+json`;
- serve `/sw.js` as JavaScript from the top of the application's intended
  service-worker scope;
- return real static assets before applying the application rewrite;
- rewrite unknown application navigations such as `/payments` and `/settings`
  to `/index.html` without rewriting missing asset or service-worker requests
  to HTML;
- preserve query strings and use one canonical hostname; and
- deploy atomically so clients never receive HTML that references an incomplete
  asset set.

The current application is root-relative. If it must be hosted below a path
such as `https://example.com/dues/`, update and test all of the following in one
change:

- Vite `base`;
- manifest `id`, `start_url`, `scope`, and icon URLs;
- `BrowserRouter` basename and navigation URLs;
- favicon and Apple touch icon URLs;
- service-worker URL and scope; and
- host rewrites for direct and offline navigation below `/dues/`.

Do not deploy the current build unchanged to a subpath.

### Set cache and security headers

Use host configuration rather than relying only on HTML metadata. Exact syntax
depends on the provider, but the resulting responses should follow this policy:

| Response                 | Required cache behavior                            |
| ------------------------ | -------------------------------------------------- |
| `/`, `/index.html`       | Revalidate; do not mark immutable                  |
| `/sw.js`                 | Revalidate on every request; do not mark immutable |
| `/manifest.webmanifest`  | Revalidate; do not mark immutable                  |
| Hashed `/assets/*` files | Long-lived public cache with `immutable`           |
| Versioned icons          | Cacheable, but revalidate if filenames are reused  |

Send the existing Content Security Policy as an HTTP response header in
production and keep the meta policy as defense in depth. Add
`frame-ancestors 'none'` to the header policy, because that directive is not
enforced from a meta element. Also send `X-Content-Type-Options: nosniff` and a
privacy-preserving `Referrer-Policy`. Enable HSTS only after HTTPS and the
canonical host are stable.

### Add a deployment workflow

The deployment workflow must:

1. trigger only from the intended production branch or an explicit promotion;
2. install with `--frozen-lockfile` and run the same Node and pnpm versions used
   by CI;
3. require formatting, lint, type checks, unit tests, build, and browser tests
   to pass before promotion;
4. upload the generated `apps/web/dist/` artifact rather than rebuilding it
   differently during deployment;
5. serialize production deployments so an older run cannot overwrite a newer
   one;
6. keep provider credentials only in protected deployment secrets; and
7. report the deployed commit and production URL.

After deployment, run the production smoke checks below before declaring the
release complete. Keep the last known-good artifact available. A rollback must
remain compatible with the user's current IndexedDB schema; when a database
migration has shipped, prefer a compatible forward fix over serving code that
cannot read the upgraded database.

## Service worker, offline behavior, and updates

The current Workbox service worker precaches HTML, JavaScript, CSS, the
manifest, and local image assets. It does not need runtime caching because core
application behavior and payment data are local. Keep that boundary explicit:

- never add imported statement files, exported backups, user-entered data, or
  provider pages to the service-worker cache;
- keep all application-shell assets same-origin and included in the precache;
- keep the navigation fallback at the application root and verify every
  client-side route;
- treat service-worker registration as progressive enhancement so a
  registration failure does not prevent online use; and
- keep storage migrations backward-aware when `registerType: "autoUpdate"`
  can activate new application code.

Verify these lifecycles against the production host:

1. **First visit:** open online, wait for the service worker to install and
   activate, then reload before testing offline behavior.
2. **Warm offline:** disable the network with the app open, navigate through all
   core routes, and create, edit, mark paid, export, and import records where
   the platform permits the file operation.
3. **Cold offline:** close every app window, disable the network, relaunch from
   the installed icon, and confirm both the shell and IndexedDB records load.
4. **Deep link:** load every route directly while online and after it has been
   controlled by the service worker. The host and service-worker fallbacks must
   both reach the application.
5. **Update:** install release A, add records, deploy release B, reopen and wait
   for the update, then confirm release B activates without losing or
   duplicating data.
6. **Interrupted update:** close the app during an update and confirm the next
   launch selects one complete asset version rather than a mixed shell.
7. **Recovery:** document how to clear a broken service worker during support,
   while warning that clearing all site data also deletes local records.

Automated Chromium and Firefox coverage already exercises an offline reload and
a cold reopen. Playwright WebKit's offline interception limitation means native
iPhone/iPad Safari remains a mandatory manual release test.

## Phone installation and mobile experience

Installation instructions shown to users must match the platform:

- **Android Chrome:** open the canonical HTTPS URL, use **Install app** or
  **Add to Home screen**, accept the browser prompt, then launch Dues from the
  launcher.
- **iPhone Safari:** open the canonical HTTPS URL in Safari, choose **Share**,
  **Add to Home Screen**, enable **Open as Web App**, add it, then launch Dues
  from the Home Screen.

An in-app install button is not required. If one is added later, keep the
browser-menu instructions available because install-prompt APIs and labels vary
by platform.

Complete this minimum device matrix on the production URL:

| Platform                                   | Required checks                                                                                                                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current Android Chrome on a physical phone | Browser recognizes the app as installable; standard and maskable icons render correctly; standalone launch, update, cold offline launch, file export/import, and uninstall behavior work     |
| Current iPhone Safari on a physical phone  | Add to Home Screen and Open as Web App work; Apple icon and launch presentation are correct; standalone launch, update, cold offline launch, file export/import, and reinstall behavior work |
| Desktop Chromium                           | Manifest, service worker, installability, direct routes, and update lifecycle pass as a diagnostic baseline                                                                                  |
| Firefox and desktop Safari                 | The non-installed browser experience remains functional; unsupported installation capabilities degrade cleanly                                                                               |

On both required phones, also verify:

- 320px and 390px portrait widths, landscape orientation, display zoom, and
  200% text zoom;
- no horizontal page overflow, obscured fields, clipped dialogs, or controls
  hidden behind browser or home-indicator areas;
- at least 44px touch targets and visible keyboard focus;
- virtual-keyboard behavior for amount, date, search, select, and notes fields;
- light, dark, and system theme changes;
- long payment names, large localized amounts, all supported currencies, and
  validation messages;
- backup download to the device's file manager and import through its native
  file picker; and
- rotation, app switching, device restart, and returning after several days.

Add `viewport-fit=cover` and safe-area padding only if the design intentionally
extends under a notch or home indicator. If added, test every edge in installed
mode instead of assuming browser-tab screenshots cover it.

## Local data, backup, and privacy

Dues stores payments and settings in the browser profile's IndexedDB database.
The service-worker cache contains only the application shell; it is not the
source of truth for payment records.

Before release:

1. Explain during onboarding or installation guidance that there is no account
   or cross-device synchronization and that another browser or another Home
   Screen installation may have separate storage.
2. Explain that uninstalling the app, clearing site data, using private
   browsing, browser eviction, or losing the device/profile can delete local
   records.
3. Keep backup export prominent and recommend a fresh backup before clearing
   data, changing devices, or troubleshooting an installation.
4. Verify that mobile export produces a valid UTF-8 JSON file and mobile import
   previews and applies the same file without silent overwrites.
5. Preserve the warning that backup files are plain text and contain private
   financial metadata.
6. Test quota and unavailable-storage errors without clearing or partially
   replacing existing records.
7. Evaluate `navigator.storage.persist()` as a durability enhancement. Treat an
   unsupported or denied request as normal and never describe it as a backup.
8. Keep reminder claims honest: in-app flags work while Dues is open, but the
   current release does not guarantee background notification delivery.

No production analytics, advertising, bank integration, account API, or
third-party runtime asset should be introduced as part of deployment. External
availability monitoring may request public static URLs, but it must not receive
or infer user records.

## Security release checks

- Confirm TLS, HTTP-to-HTTPS redirect behavior, certificate renewal, canonical
  host redirects, CSP, framing protection, MIME types, and cache headers from
  outside the hosting provider's network.
- Confirm the production app makes no unexpected third-party request during
  onboarding and every core route. User-selected provider links are the only
  expected external navigation.
- Confirm provider links remain HTTPS-only, user-initiated, and opened without
  opener or referrer access.
- Confirm service-worker scope does not control unrelated content on a shared
  origin. Prefer a dedicated origin if unrelated applications share the host.
- Confirm source maps, environment files, deployment credentials, and backup
  fixtures containing private information are not published.
- Run dependency review and the documented security checks from the exact
  release commit.
- Exercise malformed imports, destructive replacement confirmation, storage
  conflicts, and CSP violations in the deployed build.

## Automated release gate

Run the complete repository gate from a clean checkout:

```sh
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

The build must generate `index.html`, `manifest.webmanifest`, `sw.js`, the
Workbox runtime, hashed JavaScript/CSS, and every declared icon. Browser tests
must exercise the production build rather than Vite's development mode.

Add focused checks that fail CI when:

- the generated manifest is missing, invalid, or references a missing icon;
- declared PNG dimensions or icon purposes do not match the files;
- the service worker or navigation fallback is absent from the production
  build;
- a narrow viewport overflows horizontally or key touch targets regress; or
- the application makes an unexpected production network request.

## Production smoke gate

Immediately after each production deployment, verify all of the following from
the public internet:

- `/`, `/manifest.webmanifest`, `/sw.js`, and every icon return `200` over
  HTTPS without a redirect loop;
- MIME types, cache directives, CSP, and other security headers match the host
  policy;
- a direct request to each application route returns the application HTML;
- a deliberately missing asset returns an error instead of `index.html`;
- manifest and service-worker URLs remain on the canonical origin and within
  the intended scope;
- service-worker installation produces no console error;
- onboarding and one create/edit/mark-paid/delete journey succeed;
- backup export and previewed import succeed; and
- a controlled offline reload and cold installed launch succeed.

Do not perform smoke tests with real payment data. Keep a synthetic release
fixture that contains no private metadata.

## Release and rollback record

For every production release, record:

- source commit and CI run;
- canonical URL and deployment identifier;
- generated manifest identity and service-worker version;
- supported browser/device versions tested;
- automated and manual check results;
- any IndexedDB schema migration; and
- the last compatible rollback artifact.

After launch, monitor only public application availability, certificate expiry,
and deploy failures unless the privacy model is explicitly changed. Re-run the
installation, update, backup/restore, and offline matrix for changes to the
manifest, icons, router base, service worker, storage schema, host, or domain.

## Definition of PWA-ready

The release owner may mark Dues PWA-ready only when every item below is true:

- [ ] A canonical production origin and support matrix are documented.
- [ ] The icon set, manifest identity, and page metadata are final.
- [ ] The locked production build passes the complete automated gate.
- [ ] HTTPS, redirects, SPA rewrites, MIME types, cache policy, and security
      headers are verified on the public origin.
- [ ] The production deployment and compatible rollback paths are documented
      and tested.
- [ ] Android Chrome installs, launches standalone, updates, works offline, and
      preserves data on a physical phone.
- [ ] iPhone Safari installs through Add to Home Screen, launches standalone,
      updates, works offline, and preserves data on a physical phone.
- [ ] Mobile backup export/import and the local-data loss warnings are verified.
- [ ] No unexpected production network request or sensitive published artifact
      is present.
- [ ] The production smoke gate passes against the deployed commit.

## References

- [Vite PWA deployment requirements](https://vite-pwa-org.netlify.app/deployment/)
- [Web app manifest guidance](https://web.dev/learn/pwa/web-app-manifest/)
- [PWA installation behavior](https://web.dev/learn/pwa/installation/)
- [Service-worker lifecycle](https://web.dev/learn/pwa/service-workers/)
- [Apple: open a website as an app on iPhone](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios)
