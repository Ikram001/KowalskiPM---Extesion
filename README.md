# KowalskiPM — Tabs Manager & Search

Real-time RAM usage per tab with one-click management, plus instant fuzzy tab search — all in one toolbar popup.

Visual design follows the "Obsidian & Ivory" system: monochrome black/off-white palette, Space Grotesk (display) + Inter (body/UI), sharp 0px corners, no shadows beyond a faint ghost shadow.

- **Search tab** — fuzzy-search all open tabs by title or domain, navigate with arrow keys, jump with Enter. Shows tabs in most-recently-used order when idle.
- **Memory tab** — real-time per-tab RAM usage grouped by window, with one-click refresh / close / suspend per tab and a bulk "Suspend all" action.

Press **Alt+Shift+K** (or click the toolbar icon) to open. The popup defaults to the Search tab.

## ⚠️ Memory tab needs Chrome Dev channel

`chrome.processes` — the API used to read real per-tab memory — is currently gated to the **Dev channel build of Chrome** (per Chrome's own API reference). The extension loads fine on stable Chrome and the Search tab works fully, but memory figures will stay empty. Install [Chrome Dev](https://www.google.com/chrome/dev/) to use the Memory tab.

## Load the extension (no build needed)

The `dist/` folder is already built and ready to load as-is:

1. Open `chrome://extensions` in Chrome Dev.
2. Toggle **Developer mode** on (top right).
3. Click **Load unpacked** and select the `dist/` folder.
4. Click the toolbar icon or press **Alt+Shift+K** — the popup opens right there, and closes automatically when you click anywhere else.

If the shortcut doesn't fire, set it manually at `chrome://extensions/shortcuts`.

## Rebuilding from source

```bash
npm install
npm run build
```

This runs two independent Vite builds — one for the background service worker, one for the popup React app — then a postbuild step that flattens the popup HTML path and copies `manifest.json` + icons into `dist/`. The two builds are deliberately separate (not a single multi-entry build): a popup page and a service worker are different execution contexts in a Chrome extension, and letting Rollup share a chunk between them produces a harmless but noisy "preloaded but not used" console warning. Building them independently means nothing is ever shared — see the comment in `vite.config.background.js` for the full explanation.

For local iteration with hot reload of the popup UI only:

```bash
npm run dev
```

## Project layout

```
manifest.json                   MV3 manifest (permissions: processes, tabs, alarms, storage)
vite.config.background.js        Isolated build for the service worker
vite.config.popup.js             Isolated build for the popup React app
src/
  background/background.js       Service worker: memory polling + badge alarm + MRU tab tracking
  popup/
    App.jsx                      Mode tab-bar + SearchView + MemoryView
    App.css                      Obsidian & Ivory design tokens, all view styles
    components/
      Icons.jsx                  Inline SVG icons
      ResultRow.jsx               Search result row (favicon / title / host + match highlights)
      TabRow.jsx                  Memory view tab row (favicon / title / RAM / hover actions)
      WindowGroup.jsx             Collapsible per-window section, sorted by RAM desc
  shared/
    constants.js                 Thresholds, polling intervals, message types, storage keys
    format.js                    Byte formatting for rows / totals / badge
    tabs.js                      Safe hostname-from-URL helper
public/icons/                    Extension icons (16/32/48/128)
scripts/postbuild.js             Flattens build output into a loadable dist/ folder
```

## Notes on the implementation

- All `chrome.processes.getProcessInfo(..., includeMemory: true)` calls live in the background service worker, on two independent cadences: a ~12s loop that only runs while a popup port is connected (driving the Memory tab's live numbers), and a separate `chrome.alarms`-driven loop (~1 min) that keeps the toolbar badge current even with the popup closed.
- Tab open/close/title/favicon changes are pushed to the Memory view instantly via `chrome.tabs.on*` listeners — no polling, no memory cost, since those pushes reuse whatever's already in the memory cache.
- The background worker also tracks most-recently-used tab order in `chrome.storage.session` on every `tabs.onActivated` and `windows.onFocusChanged` event, which the Search tab uses to order results when the query is empty.
- Per-tab refresh/close/suspend buttons call `chrome.tabs.reload` / `.remove` / `.discard` directly from the popup; "Suspend all" is routed through the background worker so it can diff total memory before/after for the result toast.
- The Search tab loads a fresh snapshot once on open — no polling needed for a command-palette that's open for seconds, not left running.
- Space Grotesk and Inter are bundled locally via `@fontsource` (latin + latin-ext subsets only) — keeps the zero-network-calls guarantee intact even for typography.
- The RAM neutral/amber/red traffic-light coloring uses explicit `--amber` and `--error` accent tokens; fuzzy match highlights use the same `--amber` token. Both intentionally override the design system's "no accent colors" rule for clearer at-a-glance signal.
- Zero network calls anywhere — no `fetch`, no analytics, no `chrome.storage.sync`.
