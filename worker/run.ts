import { pool } from "./db.ts";
import { syncIncidents, syncLocations, syncRainStations, syncRiverStations } from "./sources/bipad.ts";

// A failed fetch never deletes data: we only upsert, and record the failure in fetch_runs.
async function logged(source: string, fn: () => Promise<number>) {
  const { rows } = await pool.query("insert into fetch_runs (source) values ($1) returning id", [source]);
  try {
    const n = await fn();
    await pool.query("update fetch_runs set finished_at=now(), ok=true, items_count=$2 where id=$1", [rows[0].id, n]);
    console.log(`[${new Date().toISOString()}] ${source}: ok, ${n} items`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await pool.query("update fetch_runs set finished_at=now(), ok=false, error=$2 where id=$1", [rows[0].id, msg]);
    console.error(`[${new Date().toISOString()}] ${source}: FAILED ${msg}`);
  }
}

export async function runAll(opts: { locations?: boolean } = {}) {
  await logged("bipad_incidents", syncIncidents);
  await logged("bipad_river_stations", syncRiverStations);
  await logged("bipad_rain_stations", syncRainStations);
  if (opts.locations) await logged("bipad_locations", syncLocations);
}
