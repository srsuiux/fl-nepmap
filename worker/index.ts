import { pool } from "./db.ts";
import { runAll } from "./run.ts";

const INTERVAL_MS = 15 * 60 * 1000;
const once = process.argv.includes("--once");

// Admin boundaries barely change, so refresh locations only on startup (and daily).
let lastLocations = 0;
async function tick() {
  const dueLocations = Date.now() - lastLocations > 24 * 3_600_000;
  await runAll({ locations: dueLocations });
  if (dueLocations) lastLocations = Date.now();
}

await tick();
if (once) {
  await pool.end();
} else {
  setInterval(() => void tick().catch((e) => console.error(e)), INTERVAL_MS);
}
