import { AMBER_THRESHOLD_BYTES, RED_THRESHOLD_BYTES } from "../../shared/constants.js";
import { formatBytes } from "../../shared/format.js";
import { RefreshIcon, CloseIcon, SuspendIcon } from "./Icons.jsx";

const FALLBACK_FAVICON =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.25" fill="none" stroke="%237e7576" stroke-width="1.3"/><path d="M2.2 8h11.6M8 1.8a9 9 0 0 1 0 12.4M8 1.8a9 9 0 0 0 0 12.4" fill="none" stroke="%237e7576" stroke-width="1.1"/></svg>'
  );

function memoryClass(bytes) {
  if (bytes == null) return "ram-unknown";
  if (bytes >= RED_THRESHOLD_BYTES) return "ram-red";
  if (bytes >= AMBER_THRESHOLD_BYTES) return "ram-amber";
  return "ram-neutral";
}

export default function TabRow({ tab, onRefresh, onClose, onSuspend }) {
  const sleeping = tab.discarded;

  return (
    <div className={"tab-row" + (sleeping ? " tab-row-sleeping" : "")} title={tab.title}>
      <img
        className="tab-favicon"
        src={tab.favIconUrl || FALLBACK_FAVICON}
        onError={(e) => {
          e.currentTarget.src = FALLBACK_FAVICON;
        }}
        alt=""
      />

      <span className="tab-title">{tab.title || tab.url || "Untitled tab"}</span>

      {tab.audible && (
        <span className="tab-audible-dot" aria-label="Playing audio" title="Playing audio" />
      )}

      <span className="tab-right">
        {sleeping ? (
          <span className="ram-figure ram-sleeping" aria-label="Suspended, using ~0 MB">
            <SuspendIcon />
            asleep
          </span>
        ) : (
          <span className={"ram-figure " + memoryClass(tab.bytes)}>
            {formatBytes(tab.bytes)}
          </span>
        )}

        <span className="row-actions">
          <button
            type="button"
            className="row-action-btn"
            title="Refresh tab"
            aria-label="Refresh tab"
            onClick={(e) => {
              e.stopPropagation();
              onRefresh(tab.id);
            }}
          >
            <RefreshIcon />
          </button>
          <button
            type="button"
            className="row-action-btn"
            title="Close tab"
            aria-label="Close tab"
            onClick={(e) => {
              e.stopPropagation();
              onClose(tab.id);
            }}
          >
            <CloseIcon />
          </button>
          <button
            type="button"
            className="row-action-btn"
            title="Suspend tab"
            aria-label="Suspend tab"
            disabled={sleeping}
            onClick={(e) => {
              e.stopPropagation();
              onSuspend(tab.id);
            }}
          >
            <SuspendIcon />
          </button>
        </span>
      </span>
    </div>
  );
}
