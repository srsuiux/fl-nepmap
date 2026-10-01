import { haversineKm } from "./geo";
import type { Level } from "./analysis";

// "My places": saved on this device only (no account). Up to 5.
export type SavedPlace = { id: string; name: string; label: string; lat: number; lon: number; lastLevel?: Level; terms?: string[] };
export const MAX_PLACES = 5;
const KEY = "nfw-places-v1";

export const RANK: Record<Level, number> = { none: 0, some: 1, elevated: 2, high: 3 };

export function loadPlaces(): SavedPlace[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((p) => p && typeof p.lat === "number" && typeof p.lon === "number" && p.name).slice(0, MAX_PLACES) : [];
  } catch { return []; }
}
export function savePlaces(p: SavedPlace[]) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage full or blocked */ }
}
// the same spot if within ~200 m
export const sameSpot = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => haversineKm(a.lat, a.lon, b.lat, b.lon) < 0.2;
