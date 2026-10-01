import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { liveStatus } from "@/lib/sources";

export const dynamic = "force-dynamic";

// Everything the map needs in one small response (14 days of floods/landslides + all river stations).
// The client filters and measures distances itself, so filter changes are instant.
export async function GET() {
  const [inc, riv, st, rain, rainMeta] = await Promise.all([
    pool.query(
      `select source_id id, hazard_type hazard, subtype, title, title_ne, verified, place_name place, occurred_at, reported_at,
              ST_Y(geom::geometry) lat, ST_X(geom::geometry) lon
         from incidents where occurred_at >= now() - interval '14 days' order by occurred_at desc`,
    ),
    pool.query(
      `select source_id id, name, basin, water_level, warning_level, danger_level, status, observed_at,
              ST_Y(geom::geometry) lat, ST_X(geom::geometry) lon
         from river_stations`,
    ),
    pool.query(`select max(finished_at) filter (where ok) last_ok, source from fetch_runs group by source`),
    // observed rainfall: only valid readings from the last 3 hours (older ones would mislead)
    pool.query(
      `select source_id id, name, basin, rain_1h r1, rain_3h r3, rain_6h r6, rain_12h r12, rain_24h r24, observed_at,
              ST_Y(geom::geometry) lat, ST_X(geom::geometry) lon
         from rain_stations where valid and observed_at >= now() - interval '3 hours'`,
    ),
    pool.query(
      `select count(*) total, count(*) filter (where not valid) invalid,
              count(*) filter (where valid and observed_at >= now() - interval '3 hours') live from rain_stations`,
    ),
  ]);
  const okTimes = st.rows.filter((r) => r.source !== "bipad_locations").map((r) => r.last_ok as Date | null);
  const updated = okTimes.some((t) => !t) ? null : okTimes.reduce((a, b) => (a! < b! ? a : b), okTimes[0] ?? null);
  return NextResponse.json(
    {
      updated,
      incidents: inc.rows,
      rain: rain.rows,
      rain_meta: { total: Number(rainMeta.rows[0].total), live: Number(rainMeta.rows[0].live), invalid: Number(rainMeta.rows[0].invalid) },
      stations: riv.rows.map((r) => ({ ...r, status: liveStatus(r.status, r.observed_at) })),
    },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
