import { formatBytes } from "../../shared/format.js";
import { ChevronIcon } from "./Icons.jsx";
import TabRow from "./TabRow.jsx";

export default function WindowGroup({
  label,
  isCurrent,
  window: win,
  expanded,
  onToggle,
  onRefresh,
  onClose,
  onSuspend,
}) {
  const sortedTabs = [...win.tabs].sort((a, b) => (b.bytes || 0) - (a.bytes || 0));

  return (
    <section className="window-group">
      <button
        type="button"
        className="window-header"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <ChevronIcon expanded={expanded} />
        <span className="window-label">{label}</span>
        {isCurrent && <span className="window-current-chip">Current</span>}
        <span className="window-spacer" />
        <span className="window-subtotal">{formatBytes(win.totalBytes)}</span>
      </button>

      {expanded && (
        <div className="window-tabs">
          {sortedTabs.map((tab) => (
            <TabRow
              key={tab.id}
              tab={tab}
              onRefresh={onRefresh}
              onClose={onClose}
              onSuspend={onSuspend}
            />
          ))}
        </div>
      )}
    </section>
  );
}
