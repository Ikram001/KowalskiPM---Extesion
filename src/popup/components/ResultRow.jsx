import { forwardRef } from "react";

const FALLBACK_FAVICON =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.25" fill="none" stroke="%237e7576" stroke-width="1.3"/><path d="M2.2 8h11.6M8 1.8a9 9 0 0 1 0 12.4M8 1.8a9 9 0 0 0 0 12.4" fill="none" stroke="%237e7576" stroke-width="1.1"/></svg>'
  );

const ResultRow = forwardRef(function ResultRow({ result, selected, onClick, onMouseEnter }, ref) {
  const { tab, titleNodes, hostNodes } = result;

  return (
    <div
      ref={ref}
      className={"qs-row" + (selected ? " qs-row-selected" : "")}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <img
        className="qs-favicon"
        src={tab.favIconUrl || FALLBACK_FAVICON}
        onError={(e) => {
          e.currentTarget.src = FALLBACK_FAVICON;
        }}
        alt=""
      />

      <div className="qs-text">
        <div className="qs-title">{titleNodes}</div>
        <div className="qs-host">
          {hostNodes}
          {tab.pinned && <span className="qs-tag">Pinned</span>}
          {tab.audible && <span className="qs-tag">Playing</span>}
          {tab.active && <span className="qs-tag">Current</span>}
        </div>
      </div>
    </div>
  );
});

export default ResultRow;
