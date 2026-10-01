"use client";
import { useEffect, useState } from "react";
import { ago, weekdayDay } from "@/lib/format";
import { Icon } from "./Icon";
import { t } from "@/lib/i18n";

type Fc = { days: { date: string; mm: number | null; chance: number | null }[] };
type News = { area: { title: string; link: string; source: string; at: string }[]; national: { title: string; link: string; source: string; at: string }[]; outlets: string[] };


// Model forecast: NOT official. Kept visually apart from BIPAD reports and labelled on every view.
export function Forecast({ lat, lon }: { lat: number; lon: number }) {
  const [d, setD] = useState<Fc | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    setD(null); setErr(false);
    fetch(`/api/forecast?lat=${lat}&lon=${lon}`).then((r) => { if (!r.ok) throw new Error(); return r.json(); }).then(setD).catch(() => setErr(true));
  }, [lat.toFixed(1), lon.toFixed(1)]); // eslint-disable-line react-hooks/exhaustive-deps
  const max = Math.max(10, ...(d?.days.map((x) => x.mm ?? 0) ?? [0]));
  return (
    <section className="extra">
      <h3><Icon name="rain" size={17} />{t("Rain forecast")} <span className="tag">{t("Model · not official")}</span></h3>
      {err && <p className="muted">{t("Forecast unavailable right now.")}</p>}
      {!d && !err && <p className="muted">{t("Loading forecast…")}</p>}
      {d && (
        <div className="fc">
          {d.days.map((x, i) => (
            <div key={x.date} className="fcday" title={t("{a} mm expected, {b}% chance of rain", { a: x.mm ?? "?", b: x.chance ?? "?" })}>
              <small>{i === 0 ? t("Today") : weekdayDay(new Date(x.date + "T12:00:00+05:45"))}</small>
              <span className="fcbar"><i style={{ height: `${Math.max(4, ((x.mm ?? 0) / max) * 100)}%` }} /></span>
              <b>{x.mm ?? "–"}<em> mm</em></b>
              <small>{x.chance ?? "–"}%</small>
            </div>
          ))}
        </div>
      )}
      <p className="muted">{t("Weather-model estimate for this spot (Open-Meteo), not a DHM forecast and not a warning. For official forecasts and warnings see")} <a href="https://www.dhm.gov.np/" target="_blank" rel="noopener noreferrer">DHM</a>.</p>
    </section>
  );
}

// News headlines: NOT official. Title, outlet, date and a link only.
export function NewsBox({ terms }: { terms: string[] }) {
  const [d, setD] = useState<News | null>(null);
  const [err, setErr] = useState(false);
  const q = terms.join(",");
  useEffect(() => {
    setD(null); setErr(false);
    fetch(`/api/news?q=${encodeURIComponent(q)}`).then((r) => { if (!r.ok) throw new Error(); return r.json(); }).then(setD).catch(() => setErr(true));
  }, [q]);
  const items = d ? (d.area.length ? d.area : d.national) : [];
  return (
    <section className="extra">
      <h3><Icon name="alert" size={17} />{t("News")} <span className="tag">{t("Not official")}</span></h3>
      {err && <p className="muted">{t("News unavailable right now.")}</p>}
      {!d && !err && <p className="muted">{t("Loading headlines…")}</p>}
      {d && items.length === 0 && <p className="muted">{t("No recent flood or landslide headlines found.")}</p>}
      {d && items.length > 0 && <p className="muted">{d.area.length ? t("Headlines mentioning {x}", { x: terms.join(" / ") }) : terms.length ? t("Nothing local found. Latest flood and landslide headlines in Nepal") : t("Latest flood and landslide headlines in Nepal")}</p>}
      <ul className="news">
        {items.map((n) => (
          <li key={n.link}><a href={n.link} target="_blank" rel="noopener noreferrer">{n.title}</a><small>{n.source} · {ago(n.at, Date.now())}</small></li>
        ))}
      </ul>
      <p className="muted">{t("Headlines from public news feeds, not verified by BIPAD or us. Details may be wrong or out of date; check the official reports above.")}</p>
    </section>
  );
}
