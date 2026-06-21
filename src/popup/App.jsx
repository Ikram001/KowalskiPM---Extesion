import { useEffect, useRef, useState, useCallback } from "react";
import { POPUP_PORT_NAME, MSG } from "../shared/constants.js";
import { formatBytes } from "../shared/format.js";
import WindowGroup from "./components/WindowGroup.jsx";

const TOAST_DURATION_MS = 5000;

export default function App() {
  const [snapshot, setSnapshot] = useState({ totalBytes: 0, windows: [] });
  const [currentWindowId, setCurrentWindowId] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const [hasInitializedExpansion, setHasInitializedExpansion] = useState(false);
  const [toast, setToast] = useState(null);
  const [suspending, setSuspending] = useState(false);

  const portRef = useRef(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    const port = chrome.runtime.connect({ name: POPUP_PORT_NAME });
    portRef.current = port;

    port.onMessage.addListener((msg) => {
      if (!msg || typeof msg !== "object") return;

      if (msg.type === MSG.SNAPSHOT) {
        setSnapshot(msg.snapshot);
      } else if (msg.type === MSG.SUSPEND_ALL_RESULT) {
        setSuspending(false);
        setToast(
          msg.suspendedCount === 0
            ? "Nothing to suspend"
            : `Suspended ${msg.suspendedCount} tab${msg.suspendedCount === 1 ? "" : "s"}` +
                (msg.freedBytes > 0 ? `, freed ~${formatBytes(msg.freedBytes)}` : "")
        );
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
      }
    });

    chrome.windows.getCurrent().then((win) => {
      setCurrentWindowId(win.id);
    });

    return () => {
      port.disconnect();
      portRef.current = null;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Default expand state: current window's group open, every other group
  // starts collapsed. Only seed this once, the first time we know both the
  // current window id and have at least one window in the snapshot — after
  // that the user's own toggles take over.
  useEffect(() => {
    if (hasInitializedExpansion) return;
    if (currentWindowId == null) return;
    if (snapshot.windows.length === 0) return;
    setExpanded(new Set([currentWindowId]));
    setHasInitializedExpansion(true);
  }, [currentWindowId, snapshot.windows, hasInitializedExpansion]);

  const toggleWindow = useCallback((windowId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(windowId)) next.delete(windowId);
      else next.add(windowId);
      return next;
    });
  }, []);

  const handleRefresh = useCallback((tabId) => {
    chrome.tabs.reload(tabId).catch(() => {});
  }, []);

  const handleClose = useCallback((tabId) => {
    chrome.tabs.remove(tabId).catch(() => {});
  }, []);

  const handleSuspend = useCallback((tabId) => {
    chrome.tabs.discard(tabId).catch(() => {});
  }, []);

  const handleSuspendAll = useCallback(() => {
    if (suspending) return;
    setSuspending(true);
    portRef.current?.postMessage({ type: MSG.SUSPEND_ALL });
  }, [suspending]);

  // Current window first, then the rest in their natural (stable) order.
  const orderedWindows = [...snapshot.windows].sort((a, b) => {
    if (a.windowId === currentWindowId) return -1;
    if (b.windowId === currentWindowId) return 1;
    return 0;
  });

  return (
    <div className="panel-root">
      <header className="panel-header">
        <div className="grand-total">{formatBytes(snapshot.totalBytes)}</div>
        <button
          type="button"
          className="suspend-all-btn"
          onClick={handleSuspendAll}
          disabled={suspending}
        >
          {suspending ? "Suspending…" : "Suspend all"}
        </button>
      </header>

      {toast && <div className="toast">{toast}</div>}

      <main className="panel-body">
        {orderedWindows.length === 0 && <div className="empty-state">No tabs found.</div>}

        {orderedWindows.map((win, i) => (
          <WindowGroup
            key={win.windowId}
            window={win}
            label={`Window ${i + 1}`}
            isCurrent={win.windowId === currentWindowId}
            expanded={expanded.has(win.windowId)}
            onToggle={() => toggleWindow(win.windowId)}
            onRefresh={handleRefresh}
            onClose={handleClose}
            onSuspend={handleSuspend}
          />
        ))}
      </main>
    </div>
  );
}
