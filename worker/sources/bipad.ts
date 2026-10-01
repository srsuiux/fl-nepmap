import { pool } from "../db.ts";
import { getAllPages } from "../http.ts";

const API = "https://bipadportal.gov.np/api/v1";
// Stale cutoff: healthy DHM stations report at least hourly; the rest are days or months old.
export const STALE_AFTER_MS = 3 * 60 * 60 * 1000;
const FETCH_DAYS = 14;

// BIPAD hazard id -> our type. Inundation and GLOF are stored as flood with a subtype.
const HAZARDS: Record<number, { type: "flood" | "landslide"; subtype: string | null }> = {
  11: { type: "flood", subtype: null },
  17: { type: "landslide", subtype: null },
  28: { type: "flood", subtype: "inundation" },
  26: { type: "flood", subtype: "glacial_lake_outburst" },
};

type Pt = { type: "Point"; coordinates: [number, number] };
type Incident = {
  id: number; title: string; titleNe: string | null; point: Pt | null; hazard: number;
  incidentOn: string; reportedOn: string | null; approved: boolean; verified: boolean;
};
type Station = {
  id: number; title: string; basin: string | null; point: Pt | null; waterLevel: number | null;
  warningLevel: number | null; dangerLevel: number | null; waterLevelOn: string | null;
};
type RainStation = {
  id: number; title: string; basin: string | null; point: Pt | null; elevation: number | null; measuredOn: string | null;
  averages: { interval: number; value: number | null }[];
};
type Admin = { id: number; title_en: string; title_ne: string | null; centroid: Pt | null; province?: number; district?: number };

export async function syncIncidents(): Promise<number> {
  const since = new Date(Date.now() - FETCH_DAYS * 86_400_000).toISOString();
  const url = `${API}/incident/?format=json&limit=500&hazard=${Object.keys(HAZARDS).join(",")}&incident_on__gt=${since}&ordering=-incident_on`;
  const rows = await getAllPages<Incident>(url);
  let n = 0;
  for (const r of rows) {
    const h = HAZARDS[r.hazard];
    if (!h || !r.point || !r.approved) continue; // official-approved, located records only
    const [lon, lat] = r.point.coordinates;
    await pool.query(
      `insert into incidents (source, source_id, hazard_type, subtype, title, title_ne, place_name, geom,
         occurred_at, reported_at, verified, fetched_at, source_url, raw)
       values ('bipad', $1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($7,$8),4326)::geography,
         $9, $10, $11, now(), $13, $12)
       on conflict (source, source_id) do update set
         hazard_type=excluded.hazard_type, subtype=excluded.subtype, title=excluded.title,
         title_ne=excluded.title_ne, place_name=excluded.place_name, geom=excluded.geom,
         occurred_at=excluded.occurred_at, reported_at=excluded.reported_at,
         verified=excluded.verified, fetched_at=now(), source_url=excluded.source_url, raw=excluded.raw`,
      [String(r.id), h.type, h.subtype, r.title, r.titleNe, r.title.replace(/^.*? at /, ""),
       lon, lat, r.incidentOn, r.reportedOn, r.verified, JSON.stringify(r), `${API}/incident/${r.id}/?format=json`],
    );
    n++;
  }
  return n;
}

// Status from raw levels only. Never "normal" without thresholds or with a stale/missing reading.
export function stationStatus(s: Pick<Station, "waterLevel" | "warningLevel" | "dangerLevel" | "waterLevelOn">, now = Date.now()) {
  if (!s.waterLevelOn || s.waterLevel == null || s.warningLevel == null || s.dangerLevel == null) return "unavailable";
  if (now - Date.parse(s.waterLevelOn) > STALE_AFTER_MS) return "unavailable";
  if (s.waterLevel >= s.dangerLevel) return "danger";
  if (s.waterLevel >= s.warningLevel) return "warning";
  return "normal";
}

export async function syncRiverStations(): Promise<number> {
  const rows = await getAllPages<Station>(`${API}/river-stations/?format=json&limit=500`);
  let n = 0;
  for (const r of rows) {
    if (!r.point) continue;
    const [lon, lat] = r.point.coordinates;
    await pool.query(
      `insert into river_stations (source, source_id, name, basin, geom, water_level, warning_level, danger_level,
         status, observed_at, fetched_at, source_url, raw)
       values ('bipad', $1, $2, $3, ST_SetSRID(ST_MakePoint($4,$5),4326)::geography, $6, $7, $8, $9, $10, now(), null, $11)
       on conflict (source, source_id) do update set
         name=excluded.name, basin=excluded.basin, geom=excluded.geom, water_level=excluded.water_level,
         warning_level=excluded.warning_level, danger_level=excluded.danger_level, status=excluded.status,
         observed_at=excluded.observed_at, fetched_at=now(), raw=excluded.raw`,
      [String(r.id), r.title, r.basin, lon, lat, r.waterLevel, r.warningLevel, r.dangerLevel,
       stationStatus(r), r.waterLevelOn, JSON.stringify(r)],
    );
    n++;
  }
  return n;
}

export async function syncLocations(): Promise<number> {
  const q = (e: string) => getAllPages<Admin>(`${API}/${e}/?format=json&limit=1000`);
  const [provinces, districts, munis] = await Promise.all([q("province"), q("district"), q("municipality")]);
  const P = new Map(provinces.map((p) => [p.id, p]));
  const D = new Map(districts.map((d) => [d.id, d]));
  let n = 0;
  for (const m of munis) {
    const d = m.district != null ? D.get(m.district) : undefined;
    const p = d?.province != null ? P.get(d.province) : undefined;
    if (!m.centroid || !d || !p) continue;
    const [lon, lat] = m.centroid.coordinates;
    await pool.query(
      `insert into locations (source_id, province, province_ne, district, district_ne, municipality, name_en, name_ne, geom)
       values ($1,$2,$3,$4,$5,$6,$6,$7, ST_SetSRID(ST_MakePoint($8,$9),4326)::geography)
       on conflict (source_id) do update set province=excluded.province, province_ne=excluded.province_ne,
         district=excluded.district, district_ne=excluded.district_ne, municipality=excluded.municipality,
         name_en=excluded.name_en, name_ne=excluded.name_ne, geom=excluded.geom`,
      [String(m.id), p.title_en, p.title_ne, d.title_en, d.title_ne, m.title_en, m.title_ne, lon, lat],
    );
    n++;
  }
  return n;
}

// Observed rainfall (mm accumulated over the last 1/3/6/12/24 h). Some sensors report impossible values
// (e.g. hundreds of millions of mm), so those readings are flagged invalid and never shown.
const RAIN_LIMITS: Record<number, number> = { 1: 200, 3: 400, 6: 600, 12: 800, 24: 1000 };
export function rainValid(vals: Record<number, number | null>) {
  const w = [1, 3, 6, 12, 24];
  if (w.some((i) => vals[i] == null)) return true; // gaps are fine; they are shown as missing
  if (w.some((i) => vals[i]! < 0 || vals[i]! > RAIN_LIMITS[i])) return false;
  return w.every((i, k) => k === 0 || vals[w[k - 1]]! <= vals[i]! + 0.5); // accumulations can't shrink as the window grows
}

export async function syncRainStations(): Promise<number> {
  const rows = await getAllPages<RainStation>(`${API}/rain-stations/?format=json&limit=1000`);
  let n = 0;
  for (const r of rows) {
    if (!r.point) continue;
    const v: Record<number, number | null> = {};
    for (const a of r.averages ?? []) v[a.interval] = a.value;
    const [lon, lat] = r.point.coordinates;
    await pool.query(
      `insert into rain_stations (source, source_id, name, basin, elevation, geom, rain_1h, rain_3h, rain_6h, rain_12h, rain_24h,
         valid, observed_at, fetched_at, source_url, raw)
       values ('bipad', $1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5,$6),4326)::geography, $7,$8,$9,$10,$11, $12, $13, now(), null, $14)
       on conflict (source, source_id) do update set
         name=excluded.name, basin=excluded.basin, elevation=excluded.elevation, geom=excluded.geom,
         rain_1h=excluded.rain_1h, rain_3h=excluded.rain_3h, rain_6h=excluded.rain_6h, rain_12h=excluded.rain_12h,
         rain_24h=excluded.rain_24h, valid=excluded.valid, observed_at=excluded.observed_at, fetched_at=now(), raw=excluded.raw`,
      [String(r.id), r.title, r.basin || null, r.elevation, lon, lat, v[1] ?? null, v[3] ?? null, v[6] ?? null, v[12] ?? null, v[24] ?? null,
       rainValid(v), r.measuredOn, JSON.stringify(r)],
    );
    n++;
  }
  return n;
}
