import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import fuzzysort from "fuzzysort";
import { POPUP_PORT_NAME, MSG, MRU_STORAGE_KEY, FUZZY_THRESHOLD, FUZZY_LIMIT } from "../shared/constants.js";
import { formatBytes } from "../shared/format.js";
import { hostnameFor } from "../shared/tabs.js";
import WindowGroup from "./components/WindowGroup.jsx";
import ResultRow from "./components/ResultRow.jsx";
import { SearchIcon, MemoryIcon } from "./components/Icons.jsx";

const TOAST_DURATION_MS = 5000;

// ---------------------------------------------------------------------------
// Root — mode switching
// ---------------------------------------------------------------------------

export default function App() {
  const [mode, setMode] = useState("search"); // "search" | "memory"

  return (
    <div className="panel-root">
      <TabBar mode={mode} onSwitch={setMode} />
      {mode === "search" ? <SearchView /> : <MemoryView />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------

function TabBar({ mode, onSwitch }) {
  return (
    <div className="tab-bar">
      <button
        type="button"
        className={"tab-bar-btn" + (mode === "search" ? " tab-bar-btn-active" : "")}
        onClick={() => onSwitch("search")}
        title="Tab Search"
        aria-pressed={mode === "search"}
      >
        <SearchIcon />
        <span>Search</span>
      </button>
      <button
        type="button"
        className={"tab-bar-btn" + (mode === "memory" ? " tab-bar-btn-active" : "")}
        onClick={() => onSwitch("memory")}
        title="Memory Manager"
        aria-pressed={mode === "memory"}
      >
        <MemoryIcon />
        <span>Memory</span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search view (QuickSwitch)
// ---------------------------------------------------------------------------

function SearchView() {
  const [tabs, setTabs] = useState([]);
  const [mruIds, setMruIds] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef(null);
  const rowRefs = useRef([]);

  useEffect(() => {
    chrome.tabs.query({}).then(setTabs);
    chrome.storage.session.get(MRU_STORAGE_KEY).then((result) => {
      const ids = result[MRU_STORAGE_KEY];
      setMruIds(Array.isArray(ids) ? ids : []);
    });
    // Small delay so the tab-bar button click doesn't steal focus
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const prepared = useMemo(
    () =>
      tabs.map((tab) => ({
        tab,
        title: tab.title || tab.url || "Untitled tab",
        host: hostnameFor(tab.url),
      })),
    [tabs]
  );

  const results = useMemo(() => {
    const trimmed = query.trim();

    if (trimmed === "") {
      const order = new Map(mruIds.map((id, i) => [id, i]));
      const sorted = [...prepared].sort((a, b) => {
        const ai = order.has(a.tab.id) ? order.get(a.tab.id) : Number.MAX_SAFE_INTEGER;
        const bi = order.has(b.tab.id) ? order.get(b.tab.id) : Number.MAX_SAFE_INTEGER;
        return ai - bi;
      });
      return sorted.map((item) => ({
        tab: item.tab,
        titleNodes: [item.title],
        hostNodes: [item.host],
      }));
    }

    const matches = fuzzysort.go(trimmed, prepared, {
      keys: ["title", "host"],
      threshold: FUZZY_THRESHOLD,
      limit: FUZZY_LIMIT,
    });

    return matches.map((m) => ({
      tab: m.obj.tab,
      titleNodes: m[0]?.highlight((s, i) => <mark key={i}>{s}</mark>) ?? [m.obj.title],
      hostNodes: m[1]?.highlight((s, i) => <mark key={i}>{s}</mark>) ?? [m.obj.host],
    }));
  }, [query, prepared, mruIds]);

  // Default selection: skip the currently active tab
  useEffect(() => {
    if (results.length === 0) {
      setSelectedIndex(0);
      return;
    }
    const firstNonActive = results.findIndex((r) => !r.tab.active);
    setSelectedIndex(firstNonActive === -1 ? 0 : firstNonActive);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    rowRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  async function switchToTab(tab) {
    try {
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
    } finally {
      window.close();
    }
  }

  function handleKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = results[selectedIndex];
      if (chosen) switchToTab(chosen.tab);
    } else if (e.key === "Escape") {
      window.close();
    }
  }

  rowRefs.current = [];

  return (
    <div className="search-view">
      <input
        ref={inputRef}
        type="text"
        className="qs-input"
        placeholder="Search open tabs…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        spellCheck="false"
      />

      <div className="qs-results">
        {results.length === 0 && <div className="qs-empty">No matching tabs</div>}

        {results.map((result, i) => (
          <ResultRow
            key={result.tab.id}
            ref={(el) => (rowRefs.current[i] = el)}
            result={result}
            selected={i === selectedIndex}
            onClick={() => switchToTab(result.tab)}
            onMouseEnter={() => setSelectedIndex(i)}
          />
        ))}
      </div>

      <div className="qs-footer">
        <span>
          <kbd>&uarr;</kbd>
          <kbd>&darr;</kbd> navigate
        </span>
        <span>
          <kbd>&crarr;</kbd> switch
        </span>
        <span>
          <kbd>esc</kbd> close
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Memory view (KowalskiPM)
// ---------------------------------------------------------------------------

function MemoryView() {
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

  const orderedWindows = [...snapshot.windows].sort((a, b) => {
    if (a.windowId === currentWindowId) return -1;
    if (b.windowId === currentWindowId) return 1;
    return 0;
  });

  return (
    <div className="memory-view">
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
