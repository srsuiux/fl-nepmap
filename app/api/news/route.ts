import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// NOT official data: headlines from public RSS feeds of Nepali news outlets. We keep only title, link, outlet and date;
// never article text or images.
const FEEDS = [
  { name: "Online Khabar", url: "https://english.onlinekhabar.com/feed" },
  { name: "Rising Nepal", url: "https://risingnepaldaily.com/rss" },
  { name: "Nepalnews", url: "https://www.nepalnews.com/feed" },
];
const HAZARD = /flood|landslide|inundat|rain|monsoon|downpour|swept away|washed away|river|glacial|avalanche|debris|disaster|NDRRMA|DHM|BIPAD|rescue|displaced/i;

type Item = { title: string; link: string; source: string; at: string };

const decode = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#8217;/g, "’").replace(/&#8216;/g, "‘").replace(/&#8211;/g, "–").trim();

async function load(f: (typeof FEEDS)[number]): Promise<Item[]> {
  try {
    const r = await fetch(f.url, { next: { revalidate: 1800 }, headers: { "User-Agent": "NepalFloodWatch/0.1 (ssharma33@student.ysu.edu)" }, signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return [];
    const xml = await r.text();
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].flatMap((m) => {
      const t = m[1].match(/<title>([\s\S]*?)<\/title>/)?.[1], l = m[1].match(/<link>([\s\S]*?)<\/link>/)?.[1], d = m[1].match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1];
      const link = l ? decode(l) : "", at = d ? new Date(decode(d)) : null;
      if (!t || !/^https?:\/\//.test(link) || !at || Number.isNaN(+at)) return [];
      return [{ title: decode(t), link, source: f.name, at: at.toISOString() }];
    });
  } catch { return []; }
}

export async function GET(req: NextRequest) {
  const terms = (req.nextUrl.searchParams.get("q") ?? "").split(",").map((x) => x.trim()).filter((x) => x.length >= 3).slice(0, 4);
  const since = Date.now() - 7 * 86_400_000;
  const all = (await Promise.all(FEEDS.map(load))).flat().filter((i) => +new Date(i.at) >= since).sort((a, b) => +new Date(b.at) - +new Date(a.at));
  const hazard = all.filter((i) => HAZARD.test(i.title));
  const area = terms.length ? hazard.filter((i) => terms.some((t) => i.title.toLowerCase().includes(t.toLowerCase()))) : [];
  return NextResponse.json({ area: area.slice(0, 5), national: hazard.slice(0, 6), outlets: FEEDS.map((f) => f.name) }, { headers: { "Cache-Control": "public, s-maxage=1800" } });
}
