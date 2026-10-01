import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const { rows } = await pool.query(
    `select source,
            max(finished_at) filter (where ok) as last_success_at,
            (array_agg(ok order by started_at desc))[1] as last_run_ok,
            (array_agg(error order by started_at desc))[1] as last_error
       from fetch_runs group by source order by source`,
  );
  return NextResponse.json({ sources: rows }, { headers: { "Cache-Control": "public, s-maxage=60" } });
}
