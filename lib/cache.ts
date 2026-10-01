import { liveStatus } from "./sources";
import type { Overview } from "@/components/types";

const KEY = "nfw-overview-v2";
export const RAIN_LIVE_MS = 3 * 60 * 60 * 1000;

export function loadCache(): { savedAt: number; data: Overview } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    return c && typeof c.savedAt === "number" && c.data?.incidents ? c : null;
  } catch { return null; }
}

export function saveCache(data: Overview) {
  try { localStorage.setItem(KEY, JSON.stringify({ savedAt: Date.now(), data })); } catch { /* storage full or blocked: skip */ }
}

// Saved data must never look fresher than it is: river statuses and rain readings are re-checked for age
// every time they are shown, so a cached "normal" or "3 mm" doesn't outlive its reading.
export function sanitize(d: Overview, now: number): Overview {
  return {
    ...d,
    stations: d.stations.map((s) => {
      const status = liveStatus(s.status, s.observed_at ? new Date(s.observed_at) : null, now);
      return status === s.status ? s : { ...s, status };
    }),
    rain: d.rain.filter((r) => now - Date.parse(r.observed_at) <= RAIN_LIVE_MS),
  };
}
