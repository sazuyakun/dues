# PWA readiness

This document currently covers application icons only. Deployment, hosting,
offline behavior, installation testing, and the remaining PWA release work can
be added as those decisions are made.

## Application icons

The icon should be a simple, geometric version of the Dues mark that remains
recognizable at small sizes. Use the existing product palette as the starting
point:

- Canvas: `#030403`
- Surface: `#070806`
- Text: `#f1eee5`
- Accent: `#f2c94c`

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

| Asset | Size | Use |
| --- | ---: | --- |
| `icon.svg` | Scalable | Browser favicon and vector fallback |
| `icon-192.png` | 192 x 192 | Standard PWA install icon |
| `icon-512.png` | 512 x 512 | High-resolution PWA install icon |
| `icon-maskable-192.png` | 192 x 192 | Maskable launcher icon |
| `icon-maskable-512.png` | 512 x 512 | High-resolution maskable launcher icon |
| `apple-touch-icon.png` | 180 x 180 | Apple home-screen icon |

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
