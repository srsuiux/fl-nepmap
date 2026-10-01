import { haversineKm } from "./geo";
import { t, tn } from "./i18n";
import type { OIncident, OStation } from "@/components/types";

// Transparent, rule-based summary of OFFICIAL REPORTS near a point. It is not a safety assessment:
// no reports can mean nothing happened, or nothing was reported / measured yet.
export const RULES = {
  recentHours: 72,
  recentKm: 10,
  manyInWindow: 3,
  manyRecent: 3,
};

export type Level = "high" | "elevated" | "some" | "none";
// getters, so the text follows the current language each time it is read
export const LEVEL_LABEL = {
  get high() { return t("High reported activity"); },
  get elevated() { return t("Elevated reported activity"); },
  get some() { return t("Some reports nearby"); },
  get none() { return t("No reports in this window"); },
} as Record<Level, string>;

export type Analysis = {
  level: Level;
  reasons: string[];
  counts: { flood: number; landslide: number; recent: number };
  nearestKm: number | null;
  danger: OStation[]; warning: OStation[];
  stations: { total: number; live: number };
  caveats: string[];
};

export function analyze(
  lat: number, lon: number, radiusKm: number, days: number,
  incidents: OIncident[], stations: OStation[], now: number,
): Analysis {
  const since = now - days * 86_400_000;
  const near = incidents
    .map((i) => ({ i, km: haversineKm(lat, lon, i.lat, i.lon) }))
    .filter((x) => x.km <= radiusKm && Date.parse(x.i.occurred_at) >= since);
  const recent = near.filter((x) => x.km <= RULES.recentKm && now - Date.parse(x.i.occurred_at) <= RULES.recentHours * 3_600_000);
  const st = stations.filter((s) => haversineKm(lat, lon, s.lat, s.lon) <= radiusKm);
  const danger = st.filter((s) => s.status === "danger");
  const warning = st.filter((s) => s.status === "warning");
  const live = st.filter((s) => s.status !== "unavailable").length;

  let level: Level = "none";
  if (near.length >= 1) level = "some";
  if (warning.length > 0 || recent.length >= 1 || near.length >= RULES.manyInWindow) level = "elevated";
  if (danger.length > 0 || recent.length >= RULES.manyRecent) level = "high";

  const reasons: string[] = [];
  const dayVars = { r: radiusKm, d: days };
  if (danger.length) reasons.push(tn(danger.length, "{n} river station above danger level within {r} km", "{n} river stations above danger level within {r} km", dayVars));
  if (warning.length) reasons.push(tn(warning.length, "{n} river station above warning level within {r} km", "{n} river stations above warning level within {r} km", dayVars));
  if (recent.length) reasons.push(tn(recent.length, "{n} incident within {k} km in the last {h} hours", "{n} incidents within {k} km in the last {h} hours", { k: RULES.recentKm, h: RULES.recentHours }));
  const fl = near.filter((x) => x.i.hazard === "flood").length;
  const ls = near.length - fl;
  if (near.length) reasons.push(tn(near.length, days > 1 ? "{n} incident within {r} km in the last {d} days ({f} flood, {l} landslide)" : "{n} incident within {r} km in the last 24 hours ({f} flood, {l} landslide)", days > 1 ? "{n} incidents within {r} km in the last {d} days ({f} flood, {l} landslide)" : "{n} incidents within {r} km in the last 24 hours ({f} flood, {l} landslide)", { ...dayVars, f: fl, l: ls }));
  if (!reasons.length) reasons.push(days > 1 ? t("No flood or landslide reports within {r} km in the last {d} days", dayVars) : t("No flood or landslide reports within {r} km in the last 24 hours", dayVars));

  const caveats: string[] = [];
  if (st.length === 0) caveats.push(t("No river stations within this radius, so river conditions here are not covered."));
  else if (live === 0) caveats.push(t("None of the nearby river stations have a current reading."));
  else if (live < st.length) caveats.push(t("{a} of {b} nearby river stations have no current reading.", { a: st.length - live, b: st.length }));
  caveats.push(t("Only official BIPAD reports are used. Reports can be late or missing, so a quiet area is not confirmation of no hazard."));

  return {
    level, reasons, caveats, danger, warning,
    counts: { flood: fl, landslide: ls, recent: recent.length },
    nearestKm: near.length ? Math.min(...near.map((x) => x.km)) : null,
    stations: { total: st.length, live },
  };
}
