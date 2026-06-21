// Formatting helpers shared between the badge (background) and the panel UI.

const MB = 1024 * 1024;
const GB = 1024 * MB;

/**
 * Format bytes for a tab row / window subtotal / grand total.
 * "412 MB" below 1GB, "1.2 GB" at or above 1GB.
 */
export function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(bytes)) return "—";
  if (bytes >= GB) {
    return `${(bytes / GB).toFixed(1)} GB`;
  }
  return `${Math.round(bytes / MB)} MB`;
}

/**
 * Abbreviated form for the toolbar badge, which has very little horizontal
 * room. e.g. 2.1G, 850M. Falls back to "0" for an empty/zero total.
 */
export function formatBadge(bytes) {
  if (!bytes || bytes <= 0) return "0";
  if (bytes >= GB) {
    const gb = bytes / GB;
    // Keep it to at most 3 characters where possible: "2.1G", "12G".
    return gb >= 10 ? `${Math.round(gb)}G` : `${gb.toFixed(1)}G`;
  }
  const mb = bytes / MB;
  return `${Math.round(mb)}M`;
}
