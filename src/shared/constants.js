// Hardcoded constants. No settings UI in this version — see project non-goals.

// Color-coding thresholds for the RAM number on a tab row, in bytes.
export const AMBER_THRESHOLD_BYTES = 150 * 1024 * 1024; // 150 MB
export const RED_THRESHOLD_BYTES = 400 * 1024 * 1024; // 400 MB

// How often the popup asks for fresh `includeMemory: true` process info,
// while it's open. Kept well above Chrome's own discards-page cadence since
// includeMemory is documented as CPU-costly.
export const POPUP_POLL_INTERVAL_MS = 12_000; // 12s, within the 10-15s spec range

// How often the background service worker refreshes the toolbar badge,
// independent of whether the popup is open. Chrome alarms have a practical
// minimum period of ~1 minute outside of a few grace-period exceptions, and
// alarms (not setInterval) are required since MV3 service workers are
// ephemeral and can't rely on long-lived timers.
export const BADGE_ALARM_PERIOD_MIN = 1;
export const BADGE_ALARM_NAME = "kowalskipm-badge-tick";

// Name for the long-lived port the popup opens so the background worker
// can tell when it's actually open vs. closed. Popups are even more
// short-lived than a side panel was — the connection drops the instant the
// user clicks away — so this also doubles as "is anyone listening right now".
export const POPUP_PORT_NAME = "kowalskipm-popup";

// Message types passed over the popup <-> background port.
export const MSG = {
  REQUEST_SNAPSHOT: "REQUEST_SNAPSHOT",
  SNAPSHOT: "SNAPSHOT",
  SUSPEND_ALL: "SUSPEND_ALL",
  SUSPEND_ALL_RESULT: "SUSPEND_ALL_RESULT",
};
