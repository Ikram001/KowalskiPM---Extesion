// Minimal, single-color stroke icons (Chrome-native flavor: 16-18px, 1.5-2px
// strokes, no fills). Kept as plain inline SVG so there's no asset pipeline
// or icon font dependency.

export function RefreshIcon(props) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" {...props}>
      <path
        d="M2.5 8a5.5 5.5 0 0 1 9.39-3.89M13.5 8a5.5 5.5 0 0 1-9.39 3.89"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M11.8 2.6v2.2h-2.2M4.2 13.4v-2.2h2.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CloseIcon(props) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" {...props}>
      <path
        d="M3.5 3.5l9 9M12.5 3.5l-9 9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SuspendIcon(props) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" {...props}>
      <path
        d="M12.8 9.4A5 5 0 0 1 6.6 3.2a5 5 0 1 0 6.2 6.2Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronIcon({ expanded, ...props }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="none"
      style={{
        transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 120ms ease",
      }}
      {...props}
    >
      <path
        d="M5.5 3.5l5 4.5-5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
