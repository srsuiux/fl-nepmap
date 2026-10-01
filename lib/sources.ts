// Source-level info shown with every item. BIPAD has no per-item URL, so we link to its incident page.
const BIPAD = "https://bipadportal.gov.np";
export const SOURCES = {
  bipad: {
    name: "BIPAD (NDRRMA)",
    incidentsUrl: `${BIPAD}/incidents/`, // BIPAD's incident map page (it has no per-incident page)
    riversUrl: `${BIPAD}/realtime/`,     // live river and rainfall readings
  },
} as const;

export type RecordKind = "incident" | "river" | "rain";
const API_PATH = { incident: "incident", river: "river-stations", rain: "rain-stations" } as const;

// Real per-record URL: the item's own entry in BIPAD's public API (opens as JSON and carries the ID).
export const recordUrl = (kind: RecordKind, id: string) => `${BIPAD}/api/v1/${API_PATH[kind]}/${encodeURIComponent(id)}/?format=json`;
// The human-readable BIPAD page where that kind of data is shown.
export const pageUrl = (kind: RecordKind) => (kind === "incident" ? SOURCES.bipad.incidentsUrl : SOURCES.bipad.riversUrl);

export const STALE_AFTER_MS = 3 * 60 * 60 * 1000; // keep in sync with worker/sources/bipad.ts

// Re-check freshness when serving: a stored "normal" must not outlive its reading.
export function liveStatus(
  stored: string,
  observedAt: Date | null,
  now = Date.now(),
): "normal" | "warning" | "danger" | "unavailable" {
  if (!observedAt || now - observedAt.getTime() > STALE_AFTER_MS) return "unavailable";
  return stored as "normal" | "warning" | "danger" | "unavailable";
}
