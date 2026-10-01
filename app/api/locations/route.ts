import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

// ?q= searches English and Nepali names; ?district= (English name) lists one district's municipalities.
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("meta")) {
    // Province -> district list for the dropdown picker.
    const { rows } = await pool.query(
      `select province, province_ne, district, district_ne from locations
        group by 1,2,3,4 order by province, district`,
    );
    return NextResponse.json({ districts: rows }, { headers: { "Cache-Control": "public, s-maxage=86400" } });
  }
  const near = req.nextUrl.searchParams.get("near");
  if (near) {
    // Nearest municipality to a point, used to name a pin dropped on the map.
    const [lat, lon] = near.split(",").map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return NextResponse.json({ error: "bad near" }, { status: 400 });
    const { rows } = await pool.query(
      `select name_en, name_ne, district, province, ST_Distance(geom, ST_SetSRID(ST_MakePoint($2,$1),4326)::geography)/1000 km
         from locations order by geom <-> ST_SetSRID(ST_MakePoint($2,$1),4326)::geography limit 1`,
      [lat, lon],
    );
    return NextResponse.json({ nearest: rows[0] && rows[0].km < 40 ? rows[0] : null });
  }
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  const district = (req.nextUrl.searchParams.get("district") ?? "").trim();
  const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const { rows } = await pool.query(
    `select id, province, province_ne, district, district_ne, municipality, name_en, name_ne,
            ST_Y(geom::geometry) lat, ST_X(geom::geometry) lon
       from locations
      where ($1 = '' or name_en ilike $2 or name_ne ilike $2 or district ilike $2 or district_ne ilike $2)
        and ($3 = '' or district = $3)
      order by (name_en ilike $4) desc, name_en
      limit 50`,
    [q, like, district, `${q.replace(/[\\%_]/g, "\\$&")}%`],
  );
  return NextResponse.json({ results: rows }, { headers: { "Cache-Control": "public, s-maxage=3600" } });
}
