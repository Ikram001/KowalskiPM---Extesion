import {
  POPUP_POLL_INTERVAL_MS,
  BADGE_ALARM_PERIOD_MIN,
  BADGE_ALARM_NAME,
  POPUP_PORT_NAME,
  MSG,
} from "../shared/constants.js";
import { formatBadge } from "../shared/format.js";

// Last-known per-tab renderer memory, in bytes. Populated by refreshMemory().
// Keyed by tabId. This is the only state that's expensive to compute, so it's
// cached and shared by both the badge alarm loop and the popup's poll loop
// rather than each maintaining its own copy.
const memoryByTabId = new Map();

// The single popup port, if one is currently connected. Its presence is
// exactly "is the popup open" — used to gate the popup's 10-15s memory timer
// and to know whether structural tab-event pushes have anywhere to go.
let popupPort = null;
let popupPollTimer = null;

// ---------------------------------------------------------------------------
// Memory polling (the only code path that calls chrome.processes with
// includeMemory: true — kept off the hot path per the perf note in the spec).
// ---------------------------------------------------------------------------

async function refreshMemory() {
  const tabs = await chrome.tabs.query({});
  const liveTabs = tabs.filter((t) => !t.discarded);

  const processIdByTab = new Map();
  await Promise.all(
    liveTabs.map(async (tab) => {
      try {
        const processId = await chrome.processes.getProcessIdForTab(tab.id);
        processIdByTab.set(tab.id, processId);
      } catch {
        // Tabs with no renderer process (e.g. chrome:// pages in some
        // states) just won't get a memory figure this round.
      }
    })
  );

  const uniqueProcessIds = [...new Set(processIdByTab.values())];
  let processInfo = {};
  if (uniqueProcessIds.length > 0) {
    try {
      processInfo = await chrome.processes.getProcessInfo(uniqueProcessIds, true);
    } catch {
      processInfo = {};
    }
  }

  for (const tab of tabs) {
    if (tab.discarded) {
      memoryByTabId.set(tab.id, 0);
      continue;
    }
    const processId = processIdByTab.get(tab.id);
    const proc = processId != null ? processInfo[processId] : undefined;
    if (proc && typeof proc.privateMemory === "number") {
      memoryByTabId.set(tab.id, proc.privateMemory);
    }
  }

  // Drop entries for tabs that no longer exist.
  const liveIds = new Set(tabs.map((t) => t.id));
  for (const id of memoryByTabId.keys()) {
    if (!liveIds.has(id)) memoryByTabId.delete(id);
  }
}

// ---------------------------------------------------------------------------
// Snapshot building (cheap — no includeMemory calls here, just chrome.tabs
// .query plus whatever's already in the memory cache). Safe to call on every
// tab event for instant structural updates.
// ---------------------------------------------------------------------------

async function buildSnapshot() {
  const tabs = await chrome.tabs.query({});
  const windowsById = new Map();

  for (const tab of tabs) {
    if (!windowsById.has(tab.windowId)) {
      windowsById.set(tab.windowId, { windowId: tab.windowId, tabs: [] });
    }
    const bytes = tab.discarded ? 0 : memoryByTabId.get(tab.id) ?? null;
    windowsById.get(tab.windowId).tabs.push({
      id: tab.id,
      windowId: tab.windowId,
      title: tab.title || "",
      favIconUrl: tab.favIconUrl || "",
      url: tab.url || "",
      pinned: !!tab.pinned,
      audible: !!tab.audible,
      active: !!tab.active,
      discarded: !!tab.discarded,
      bytes,
    });
  }

  const windows = [...windowsById.values()].map((w) => ({
    ...w,
    totalBytes: w.tabs.reduce((sum, t) => sum + (t.bytes || 0), 0),
  }));

  const totalBytes = windows.reduce((sum, w) => sum + w.totalBytes, 0);

  return { totalBytes, windows };
}

function pushSnapshotToPopup() {
  if (!popupPort) return;
  buildSnapshot()
    .then((snapshot) => {
      popupPort?.postMessage({ type: MSG.SNAPSHOT, snapshot });
    })
    .catch(() => {
      // Port may have disconnected mid-flight; ignore.
    });
}

// ---------------------------------------------------------------------------
// Badge: independent of the popup, driven by chrome.alarms so it survives
// service-worker restarts.
// ---------------------------------------------------------------------------

async function updateBadge() {
  await refreshMemory();
  const snapshot = await buildSnapshot();
  chrome.action.setBadgeText({ text: formatBadge(snapshot.totalBytes) });
}

chrome.action.setBadgeBackgroundColor({ color: "#000000" });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === BADGE_ALARM_NAME) {
    updateBadge();
  }
});

function ensureBadgeAlarm() {
  chrome.alarms.create(BADGE_ALARM_NAME, { periodInMinutes: BADGE_ALARM_PERIOD_MIN });
  updateBadge();
}

// ---------------------------------------------------------------------------
// Popup wiring: chrome.action.default_popup in the manifest already opens
// popup.html on icon click — no JS needed for that part. This just listens
// for the popup's port connection to know when it's open.
// ---------------------------------------------------------------------------

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== POPUP_PORT_NAME) return;

  popupPort = port;

  // Send what we have immediately, then kick off a fresh measurement so the
  // popup isn't stuck showing minute-old (or empty) numbers on open.
  pushSnapshotToPopup();
  refreshMemory().then(pushSnapshotToPopup);

  popupPollTimer = setInterval(() => {
    refreshMemory().then(pushSnapshotToPopup);
  }, POPUP_POLL_INTERVAL_MS);

  port.onMessage.addListener((msg) => {
    if (!msg || typeof msg !== "object") return;

    if (msg.type === MSG.REQUEST_SNAPSHOT) {
      pushSnapshotToPopup();
      return;
    }

    if (msg.type === MSG.SUSPEND_ALL) {
      handleSuspendAll(port);
    }
  });

  port.onDisconnect.addListener(() => {
    if (popupPollTimer) {
      clearInterval(popupPollTimer);
      popupPollTimer = null;
    }
    popupPort = null;
  });
});

async function handleSuspendAll(port) {
  const before = await buildSnapshot();
  const beforeTotal = before.totalBytes;

  const tabs = await chrome.tabs.query({});
  const eligible = tabs.filter((t) => !t.active && !t.pinned && !t.audible && !t.discarded);

  const results = await Promise.allSettled(eligible.map((t) => chrome.tabs.discard(t.id)));
  const suspendedCount = results.filter((r) => r.status === "fulfilled").length;

  await refreshMemory();
  const after = await buildSnapshot();
  const freedBytes = Math.max(0, beforeTotal - after.totalBytes);

  port.postMessage({
    type: MSG.SUSPEND_ALL_RESULT,
    suspendedCount,
    freedBytes,
  });
  port.postMessage({ type: MSG.SNAPSHOT, snapshot: after });
}

// ---------------------------------------------------------------------------
// Instant structural updates: cheap, no memory cost, pushed whenever the
// popup is open and the tab list itself changes.
// ---------------------------------------------------------------------------

chrome.tabs.onCreated.addListener(() => pushSnapshotToPopup());
chrome.tabs.onRemoved.addListener((tabId) => {
  memoryByTabId.delete(tabId);
  pushSnapshotToPopup();
});
chrome.tabs.onUpdated.addListener(() => pushSnapshotToPopup());
chrome.tabs.onActivated.addListener(() => pushSnapshotToPopup());

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(() => {
  ensureBadgeAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  ensureBadgeAlarm();
});
