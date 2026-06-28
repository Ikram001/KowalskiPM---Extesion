// ---------------------------------------------------------------------------
// Shared constants for KowalskiPM + QuickSwitch combined extension.
// ---------------------------------------------------------------------------

// --- KowalskiPM: memory thresholds ---
export const AMBER_THRESHOLD_BYTES = 150 * 1024 * 1024; // 150 MB
export const RED_THRESHOLD_BYTES = 400 * 1024 * 1024;   // 400 MB

// --- KowalskiPM: polling / badge ---
export const POPUP_POLL_INTERVAL_MS = 12_000;
export const BADGE_ALARM_PERIOD_MIN = 1;
export const BADGE_ALARM_NAME = "kowalskipm-badge-tick";

// --- KowalskiPM: port / message types ---
export const POPUP_PORT_NAME = "kowalskipm-popup";

export const MSG = {
  REQUEST_SNAPSHOT: "REQUEST_SNAPSHOT",
  SNAPSHOT: "SNAPSHOT",
  SUSPEND_ALL: "SUSPEND_ALL",
  SUSPEND_ALL_RESULT: "SUSPEND_ALL_RESULT",
};

// --- QuickSwitch: MRU tab tracking ---
export const MRU_STORAGE_KEY = "quickswitch-mru-tab-ids";
export const MRU_MAX_LENGTH = 500;

// --- QuickSwitch: fuzzy search tuning ---
export const FUZZY_THRESHOLD = 0.02;
export const FUZZY_LIMIT = 30;
