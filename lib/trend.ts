import { haversineKm } from "./geo";
import { dayMonth } from "./format";
import type { OIncident } from "@/components/types";

export type Day = { key: string; label: string; flood: number; landslide: number };

const kd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" });

// Reports per day (Nepal date) within the radius, oldest first, always `days` columns so gaps show as empty days.
export function dailyCounts(lat: number, lon: number, radiusKm: number, incidents: OIncident[], now: number, days = 14): Day[] {
  const out: Day[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const t = new Date(now - i * 86_400_000);
    out.push({ key: kd.format(t), label: dayMonth(t), flood: 0, landslide: 0 });
  }
  const byKey = new Map(out.map((d) => [d.key, d]));
  for (const inc of incidents) {
    if (haversineKm(lat, lon, inc.lat, inc.lon) > radiusKm) continue;
    const d = byKey.get(kd.format(new Date(inc.occurred_at)));
    if (d) d[inc.hazard]++;
  }
  return out;
}
