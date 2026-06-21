# KowalskiPM - Tabs Resources Manager

Real-time RAM usage per tab, with one-click refresh/close/suspend, in a toolbar popup.

Visual design follows the "Obsidian & Ivory" system (`DESIGN.md`): monochrome
black/off-white palette, Space Grotesk (display) + Inter (body/UI), sharp 0px
corners, no shadows beyond a faint ghost shadow. Scale is compressed from the
brief's desktop-editorial numbers to fit a ~400×580px popup. Space Grotesk
replaces the brief's specified Playfair Display per a later request for a
more modern, minimalist feel than the original editorial serif.

## ⚠️ Before you install: this needs Chrome Dev channel

`chrome.processes` — the API this extension uses to read real per-tab memory
— is currently gated to the **Dev channel build of Chrome** (per Chrome's own
API reference). It will not work in regular stable Chrome; the extension will
load fine but every memory figure will silently stay empty, since
`getProcessIdForTab` / `getProcessInfo` aren't available there. If you're on
stable Chrome, install [Chrome Dev](https://www.google.com/chrome/dev/) to
run this.

## Load the extension (no build needed)

The `dist/` folder is already built and ready to load as-is:

1. Open `chrome://extensions` in Chrome Dev.
2. Toggle **Developer mode** on (top right).
3. Click **Load unpacked** and select the `dist/` folder.
4. Click the KowalskiPM toolbar icon — the popup opens right there, and
   closes automatically when you click anywhere else.

## Rebuilding from source

```bash
npm install
npm run build
```

This runs two independent Vite builds — one for the background service
worker, one for the popup React app — then a postbuild step that flattens
the popup HTML path and copies `manifest.json` + icons into `dist/`. The two
builds are deliberately separate (not a single multi-entry build): a popup
page and a service worker are different execution contexts in a Chrome
extension, and letting Rollup share a chunk between them produces a harmless
but noisy "preloaded but not used" console warning. Building them
independently means nothing is ever shared — see the comment in
`vite.config.background.js` for the full explanation.

For local iteration with hot reload of the popup UI only (the background
worker and chrome.* calls still need a real load-unpacked reload):

```bash
npm run dev
```

## Project layout

```
manifest.json              MV3 manifest (permissions: processes, tabs, alarms)
vite.config.background.js   Isolated build for the service worker
vite.config.popup.js        Isolated build for the popup React app
src/
  background/background.js Service worker: chrome.processes polling, badge alarm,
                            tab-event → popup push, bulk suspend
  popup/                    React popup UI
    App.jsx                  Port wiring, window grouping/expand state
    App.css                  Obsidian & Ivory design tokens, compressed for popup scale
    components/
      WindowGroup.jsx         Collapsible per-window section, sorted by RAM desc
      TabRow.jsx               Favicon/title/RAM, hover actions
      Icons.jsx                Inline SVG icons
  shared/
    constants.js              Hardcoded thresholds, polling intervals, message types
    format.js                 Byte formatting for rows/totals/badge
public/icons/                 Generated gauge-mark icon (16/32/48/128)
scripts/postbuild.js          Flattens build output into a loadable dist/ folder
```

## Notes on the implementation

- All `chrome.processes.getProcessInfo(..., includeMemory: true)` calls live
  in the background service worker, on two independent cadences: a ~12s loop
  that only runs while a popup port is connected (driving the popup's live
  numbers), and a separate `chrome.alarms`-driven loop (~1 min) that keeps
  the toolbar badge current even with the popup closed.
- Tab open/close/title/favicon changes are pushed to the popup instantly via
  `chrome.tabs.on*` listeners — no polling, no memory cost, since those
  pushes reuse whatever's already in the memory cache rather than
  re-measuring.
- Per-tab refresh/close/suspend buttons call `chrome.tabs.reload` / `.remove`
  / `.discard` directly from the popup; "Suspend all" is routed through the
  background worker so it can diff total memory before/after for the result
  toast.
- Space Grotesk and Inter are bundled locally via `@fontsource` (latin +
  latin-ext subsets only) rather than linked from Google Fonts — keeps the
  zero-network-calls guarantee intact even for typography.
- The RAM neutral/amber/red traffic-light coloring uses explicit `--amber`
  and `--error` accent tokens, intentionally overriding DESIGN.md's "no
  accent colors" rule per a direct request for clearer at-a-glance signal
  than the system's monochrome default would give.
- Zero network calls anywhere — no `fetch`, no analytics, no
  `chrome.storage.sync`.
