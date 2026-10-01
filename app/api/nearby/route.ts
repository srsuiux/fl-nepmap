import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { SOURCES, liveStatus, recordUrl } from "@/lib/sources";

export const dynamic = "force-dynamic";

function num(v: string | null, def: number | null) {
  if (v === null || v === "") return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const lat = num(p.get("lat"), null), lon = num(p.get("lon"), null);
  const radius = num(p.get("radius_km"), 25)!, days = num(p.get("days"), 7)!;
  if (lat === null || lon === null || Number.isNaN(lat) || Number.isNaN(lon) || Number.isNaN(radius) || Number.isNaN(days))
    return NextResponse.json({ error: "lat and lon are required numbers" }, { status: 400 });
  if (lat < 26 || lat > 31 || lon < 79.5 || lon > 88.5)
    return NextResponse.json({ error: "location is outside Nepal" }, { status: 400 });
  if (radius <= 0 || radius > 200 || days <= 0 || days > 30)
    return NextResponse.json({ error: "radius_km must be 0-200 and days 0-30" }, { status: 400 });

  const pt = "ST_SetSRID(ST_MakePoint($1,$2),4326)::geography";
  const [inc, riv] = await Promise.all([
    pool.query(
      `select source, source_id, hazard_type, subtype, title, title_ne, place_name, occurred_at, reported_at,
              verified, fetched_at, source_url, ST_Y(geom::geometry) lat, ST_X(geom::geometry) lon,
              ST_Distance(geom, ${pt}) / 1000 distance_km
         from incidents
        where ST_DWithin(geom, ${pt}, $3 * 1000)
          and occurred_at >= now() - ($4 || ' days')::interval
        order by distance_km, occurred_at desc`,
      [lon, lat, radius, String(days)],
    ),
    pool.query(
      `select source, source_id, name, basin, water_level, warning_level, danger_level, status, observed_at,
              fetched_at, source_url, ST_Y(geom::geometry) lat, ST_X(geom::geometry) lon,
              ST_Distance(geom, ${pt}) / 1000 distance_km
         from river_stations
        where ST_DWithin(geom, ${pt}, $3 * 1000)
        order by distance_km`,
      [lon, lat, radius],
    ),
  ]);

  const src = (s: string) => SOURCES[s as keyof typeof SOURCES];
  const incidents = inc.rows.map((r) => ({
    ...r,
    distance_km: Math.round(r.distance_km * 10) / 10,
    source_name: src(r.source)?.name ?? r.source,
    source_link: r.source_url ?? recordUrl("incident", r.source_id),
  }));
  const river_stations = riv.rows.map((r) => ({
    ...r,
    status: liveStatus(r.status, r.observed_at),
    distance_km: Math.round(r.distance_km * 10) / 10,
    source_name: src(r.source)?.name ?? r.source,
    source_link: r.source_url ?? recordUrl("river", r.source_id),
  }));

  return NextResponse.json(
    { query: { lat, lon, radius_km: radius, days }, incidents, river_stations },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
