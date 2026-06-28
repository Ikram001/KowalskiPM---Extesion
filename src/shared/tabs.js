// Safely derive a short, displayable hostname from a tab's URL. Tabs on
// internal pages (chrome://, the New Tab Page, etc.) don't have a normal
// URL to parse, so this degrades gracefully instead of throwing.
export function hostnameFor(url) {
  if (!url) return "";
  try {
    const { hostname, protocol } = new URL(url);
    if (hostname) return hostname.replace(/^www\./, "");
    // chrome://extensions, chrome://settings, etc. have no hostname —
    // show the scheme instead so they're still searchable/identifiable.
    return protocol.replace(":", "");
  } catch {
    return "";
  }
}
