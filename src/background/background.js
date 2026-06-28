import {
  POPUP_POLL_INTERVAL_MS,
  BADGE_ALARM_PERIOD_MIN,
  BADGE_ALARM_NAME,
  POPUP_PORT_NAME,
  MSG,
  MRU_STORAGE_KEY,
  MRU_MAX_LENGTH,
} from "../shared/constants.js";
import { formatBadge } from "../shared/format.js";

// ===========================================================================
// KowalskiPM — per-tab memory tracking + badge + popup push
// ===========================================================================

// Last-known per-tab renderer memory, in bytes. Keyed by tabId.
const memoryByTabId = new Map();

let popupPort = null;
let popupPollTimer = null;

// ---------------------------------------------------------------------------
// Memory polling
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
        // chrome.processes not available on stable Chrome — memory figures
        // simply won't populate, everything else still works fine.
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

  const liveIds = new Set(tabs.map((t) => t.id));
  for (const id of memoryByTabId.keys()) {
    if (!liveIds.has(id)) memoryByTabId.delete(id);
  }
}

// ---------------------------------------------------------------------------
// Snapshot building
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
    .catch(() => {});
}

// ---------------------------------------------------------------------------
// Badge
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
// Popup port wiring
// ---------------------------------------------------------------------------

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== POPUP_PORT_NAME) return;

  popupPort = port;

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
// Instant structural updates
// ---------------------------------------------------------------------------

chrome.tabs.onCreated.addListener(() => pushSnapshotToPopup());
chrome.tabs.onRemoved.addListener((tabId) => {
  memoryByTabId.delete(tabId);
  pushSnapshotToPopup();
  removeFromMru(tabId);
});
chrome.tabs.onUpdated.addListener(() => pushSnapshotToPopup());
chrome.tabs.onActivated.addListener(({ tabId }) => {
  pushSnapshotToPopup();
  bumpToFront(tabId);
});

// ===========================================================================
// QuickSwitch — MRU tab order tracking
// ===========================================================================

async function readMru() {
  try {
    const result = await chrome.storage.session.get(MRU_STORAGE_KEY);
    return Array.isArray(result[MRU_STORAGE_KEY]) ? result[MRU_STORAGE_KEY] : [];
  } catch {
    return [];
  }
}

async function writeMru(ids) {
  try {
    await chrome.storage.session.set({ [MRU_STORAGE_KEY]: ids.slice(0, MRU_MAX_LENGTH) });
  } catch {
    // Best-effort — a failed write just means the next read falls back to
    // whatever was there before, never a crash.
  }
}

async function bumpToFront(tabId) {
  if (tabId == null) return;
  const ids = await readMru();
  const next = [tabId, ...ids.filter((id) => id !== tabId)];
  await writeMru(next);
}

async function removeFromMru(tabId) {
  const ids = await readMru();
  if (!ids.includes(tabId)) return;
  await writeMru(ids.filter((id) => id !== tabId));
}

async function seedMruIfEmpty() {
  const ids = await readMru();
  if (ids.length > 0) return;
  const tabs = await chrome.tabs.query({});
  const sorted = [...tabs].sort((a, b) => Number(b.active) - Number(a.active));
  await writeMru(sorted.map((t) => t.id));
}

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, windowId });
    if (activeTab) bumpToFront(activeTab.id);
  } catch {
    // Window may have closed mid-query; nothing to do.
  }
});

// ===========================================================================
// Lifecycle
// ===========================================================================

chrome.runtime.onInstalled.addListener(() => {
  ensureBadgeAlarm();
  seedMruIfEmpty();
});

chrome.runtime.onStartup.addListener(() => {
  ensureBadgeAlarm();
  seedMruIfEmpty();
});
