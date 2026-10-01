import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// NOT official data: a global weather-model forecast (Open-Meteo). The UI labels it that way and shows it apart from BIPAD reports.
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat")), lon = Number(req.nextUrl.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 26 || lat > 31 || lon < 79.5 || lon > 88.5)
    return NextResponse.json({ error: "lat/lon must be inside Nepal" }, { status: 400 });
  const la = lat.toFixed(1), lo = lon.toFixed(1); // ~10 km grid: nearby requests share one cached answer
  try {
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&daily=precipitation_sum,precipitation_probability_max&timezone=Asia%2FKathmandu&forecast_days=4`,
      { next: { revalidate: 3600 }, headers: { "User-Agent": "NepalFloodWatch/0.1 (ssharma33@student.ysu.edu)" }, signal: AbortSignal.timeout(10_000) },
    );
    if (!r.ok) throw new Error(String(r.status));
    const d = await r.json();
    const days = (d.daily.time as string[]).map((date, i) => ({
      date, mm: d.daily.precipitation_sum[i] as number | null, chance: d.daily.precipitation_probability_max[i] as number | null,
    }));
    return NextResponse.json({ days, source: "Open-Meteo (weather model)", official: false }, { headers: { "Cache-Control": "public, s-maxage=3600" } });
  } catch {
    return NextResponse.json({ error: "forecast unavailable" }, { status: 502 });
  }
}
