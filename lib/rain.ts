import { haversineKm } from "./geo";
import type { ORain, RainWindow } from "@/components/types";

export const RAIN_WINDOWS: { v: RainWindow; l: string }[] = [{ v: 1, l: "1 h" }, { v: 3, l: "3 h" }, { v: 6, l: "6 h" }, { v: 24, l: "24 h" }];

export const rainAt = (r: ORain, w: RainWindow | 12): number | null => (w === 1 ? r.r1 : w === 3 ? r.r3 : w === 6 ? r.r6 : w === 12 ? r.r12 : r.r24);

// Colour ramp (mm) shared by the map and the legend. Thresholds follow the common IMD 24 h rainfall classes
// (heavy from 64.5 mm, very heavy from 115.6 mm); they are applied to every window just to keep one simple scale.
export const RAIN_STOPS: [number, string, string][] = [
  [0.1, "#6fb1e8", "Trace"], [5, "#3b82d6", "Light"], [15.6, "#2557b8", "Moderate"], [64.5, "#6d28d9", "Heavy"], [115.6, "#be185d", "Very heavy"],
];

export type RainNear = ORain & { km: number; mm: number };

export function rainNear(lat: number, lon: number, radiusKm: number, rain: ORain[], w: RainWindow): RainNear[] {
  return rain
    .map((r) => ({ r, km: haversineKm(lat, lon, r.lat, r.lon), mm: rainAt(r, w) }))
    .filter((x): x is { r: ORain; km: number; mm: number } => x.km <= radiusKm && x.mm != null)
    .map((x) => ({ ...x.r, km: x.km, mm: x.mm }));
}

// Station names come straight from the DHM feed in mixed styles ("Manma_AWS", "RF at Tusarepani (Sainamaina)",
// "Bhairahawa_AWOS_10"). Tidy them for display only; the original name stays in the tooltip and popup.
export function rainLabel(raw: string): { name: string; kind: string | null } {
  let name = raw.trim(), kind: string | null = null;
  const aws = name.match(/^(.*?)[_\s-]*(AWOS|AWS)(?:[_\s-]*\d+)?$/i);
  if (aws && aws[1]) { name = aws[1]; kind = "Automatic weather station"; }
  const rf = name.match(/^(?:RF|Rainfall)\s+(?:at|of)\s+(.+)$/i);
  if (rf) { name = rf[1]; kind = kind ?? "Rain gauge"; }
  name = name.replace(/_/g, " ").replace(/\s{2,}/g, " ").trim();
  return { name: name || raw, kind };
}

// colour for a rainfall amount (mm), same ramp as the map and legend
export function rainColorFor(mm: number): string {
  let c = "#8aa0b3";
  for (const [v, col] of RAIN_STOPS) if (mm >= v) c = col;
  return c;
}
