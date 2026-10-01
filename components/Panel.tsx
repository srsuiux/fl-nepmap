"use client";
import { useState } from "react";
import { LEVEL_LABEL, RULES, type Analysis } from "@/lib/analysis";
import { ago, incidentName, incidentTime, stamp } from "@/lib/format";
import { t, tn } from "@/lib/i18n";
import { SOURCE, HAZARD_COLOR, STATUS_COLOR, RAIN_ZERO, LEVEL_COLOR } from "@/lib/theme";
import type { SavedPlace } from "@/lib/places";
import type { Level } from "@/lib/analysis";
import type { Day } from "@/lib/trend";
import { Badge, Icon } from "./Icon";
import { Forecast, NewsBox } from "./Extras";
import type { IconName } from "@/lib/icons";
import { pageUrl, recordUrl, type RecordKind } from "@/lib/sources";
import { RAIN_STOPS, rainLabel, type RainNear } from "@/lib/rain";
import type { OIncident, OStation, RainWindow, Sel } from "./types";

const STATUS_LABEL = {
  get normal() { return t("Normal"); }, get warning() { return t("Warning"); }, get danger() { return t("Danger"); }, get unavailable() { return t("Status unavailable"); },
} as const;
const SUB: Record<string, string> = { inundation: "Inundation", glacial_lake_outburst: "Glacial lake outburst" };

type Dist<T> = T & { km?: number };

function Src({ id, kind }: { id: string; kind: RecordKind }) {
  const link = (href: string, text: string, tip: string) => <a href={href} target="_blank" rel="noopener noreferrer" title={tip}>{text}</a>;
  return (
    <div className="src">
      {t("Source")}: {SOURCE.name} · {t("ID")} {id} · {link(pageUrl(kind), t("BIPAD page"), t("BIPAD's own map page for this kind of data"))} · {link(recordUrl(kind, id), t("Record"), t("This item's entry in BIPAD's public data (JSON)"))}
    </div>
  );
}

function IncidentRow({ i, sel, onSelect }: { i: Dist<OIncident>; sel: boolean; onSelect: (s: Sel) => void }) {
  return (
    <li className={`row ${sel ? "sel" : ""}`}>
      <button onClick={() => onSelect({ kind: "incident", id: i.id })}>
        <Badge name={i.hazard} color={HAZARD_COLOR[i.hazard]} />
        <span className="main">
          <b>{t(i.hazard === "flood" ? "Flood" : "Landslide")}{i.subtype ? ` · ${t(SUB[i.subtype] ?? i.subtype)}` : ""}</b>
          <span>{incidentName(i)}</span>
          <small>{incidentTime(i.occurred_at)}{i.reported_at ? ` · ${t("reported")} ${stamp(i.reported_at)}` : ""}</small>
        </span>
        {i.km != null && <span className="km">{i.km.toFixed(1)} km</span>}
      </button>
      <Src id={i.id} kind="incident" />
    </li>
  );
}

function StationRow({ s, sel, onSelect }: { s: Dist<OStation>; sel: boolean; onSelect: (s: Sel) => void }) {
  return (
    <li className={`row ${sel ? "sel" : ""}`}>
      <button onClick={() => onSelect({ kind: "station", id: s.id })}>
        <Badge name="river" color={STATUS_COLOR[s.status]} />
        <span className="main">
          <b>{s.name}</b>
          <span className={`pill st-${s.status}`}>{STATUS_LABEL[s.status]}</span>
          <small>{s.observed_at ? `${t("Last reading")} ${stamp(s.observed_at)}` : t("No reading")}</small>
        </span>
        {s.km != null && <span className="km">{s.km.toFixed(1)} km</span>}
      </button>
      <Src id={s.id} kind="river" />
    </li>
  );
}

function rainColor(mm: number) {
  let c = RAIN_ZERO;
  for (const [v, col] of RAIN_STOPS) if (mm >= v) c = col;
  return c;
}

function RainRow({ r, w, sel, onSelect, showKm }: { r: RainNear; w: RainWindow; sel: boolean; onSelect: (s: Sel) => void; showKm: boolean }) {
  const { name, kind } = rainLabel(r.name);
  const cell = (v: number | null, l: string) => <span className={l === `${w} h` ? "on" : ""}><b>{v ?? "–"}</b>{t(l)}</span>;
  return (
    <li className={`row ${sel ? "sel" : ""}`}>
      <button onClick={() => onSelect({ kind: "rain", id: r.id })} title={`${t("Station name in the source")}: ${r.name}`}>
        <Badge name="rain" color={rainColor(r.mm)} />
        <span className="main">
          <b>{name}</b>
          {kind && <small>{t(kind)}</small>}
          <span className="rainvals">{cell(r.r1, "1 h")}{cell(r.r3, "3 h")}{cell(r.r6, "6 h")}{cell(r.r24, "24 h")}<em>mm</em></span>
          <small>{t("Reading")} {stamp(r.observed_at)}</small>
        </span>
        {showKm && <span className="km">{r.km.toFixed(1)} km</span>}
      </button>
      <Src id={r.id} kind="rain" />
    </li>
  );
}

function List<T extends { id: string }>({ title, items, render, empty, icon }: { icon?: IconName; title: string; items: T[]; render: (x: T) => React.ReactNode; empty: string }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 8);
  return (
    <section>
      <h3>{icon && <Icon name={icon} size={17} />}{title} <span className="count">{items.length}</span></h3>
      {items.length === 0 ? <p className="muted">{empty}</p> : <ul className="rows">{shown.map(render)}</ul>}
      {items.length > 8 && <button className="more" onClick={() => setAll(!all)}>{all ? t("Show fewer") : t("Show all {n}", { n: items.length })}</button>}
    </section>
  );
}

export type PanelProps = {
  pin: { lat: number; lon: number } | null; place: string | null; region: string | null; radius: number; days: number; updated: string | null; now: number;
  analysis: Analysis | null; incidents: Dist<OIncident>[]; stations: Dist<OStation>[];
  overview: { incidents: number; flood: number; landslide: number; alerts: Dist<OStation>[] };
  selected: Sel | null; onSelect: (s: Sel) => void; onClear: () => void; onShare: () => void; toast: string;
  loading: boolean; error: string;
  status: { loadedAt: number | null; fromCache: boolean; refreshing: boolean; offline: boolean }; onRefresh: () => void; onCollapse: () => void;
  trend: Day[]; newsTerms: string[]; onInstall?: () => void;
  myPlaces: { list: { place: SavedPlace; level: Level | null; rose: boolean }[]; current: SavedPlace | undefined; canSave: boolean; max: number;
    onOpen: (id: string) => void; onSave: (name: string) => void; onRemove: (id: string) => void; days: number; radius: number };
  rain: { on: boolean; window: RainWindow; near: RainNear[]; top: RainNear[]; meta: { total: number; live: number; invalid: number } | null };
};

function Trend({ days, radius }: { days: Day[]; radius: number }) {
  const max = Math.max(3, ...days.map((d) => d.flood + d.landslide));
  const total = days.reduce((n, d) => n + d.flood + d.landslide, 0);
  const W = 14, G = 4, H = 54;
  return (
    <section className="trend">
      <h3><Icon name="alert" size={17} />{t("Reports per day")} <span className="count">{total}</span></h3>
      <svg viewBox={`0 0 ${days.length * (W + G)} ${H + 16}`} role="img" aria-label={t("Reports per day within {r} km over the last {n} days: {total} in total", { r: radius, n: days.length, total })}>
        {days.map((d, i) => {
          const x = i * (W + G), hl = (d.landslide / max) * H, hf = (d.flood / max) * H;
          return (
            <g key={d.key}>
              <title>{`${d.label}: ${d.flood} ${t("flood")}, ${d.landslide} ${t("landslide")}`}</title>
              <rect x={x} y={0} width={W} height={H} rx={3} fill="var(--bg)" />
              {d.landslide > 0 && <rect x={x} y={H - hl} width={W} height={hl} rx={2} fill={HAZARD_COLOR.landslide} />}
              {d.flood > 0 && <rect x={x} y={H - hl - hf} width={W} height={hf} rx={2} fill={HAZARD_COLOR.flood} />}
              {(i === 0 || i === days.length - 1 || i === 7) && <text x={x + W / 2} y={H + 12} textAnchor="middle" fontSize="8.5" fill="var(--muted)">{d.label}</text>}
            </g>
          );
        })}
      </svg>
      <p className="muted">{t("Within {r} km, last {n} days.", { r: radius, n: days.length })} <span style={{ color: HAZARD_COLOR.flood }}>■</span> {t("flood")} <span style={{ color: HAZARD_COLOR.landslide }}>■</span> {t("landslide")}. {t("Dates are when BIPAD says it happened, so recent days can still fill in.")}</p>
    </section>
  );
}

function MyPlaces({ mp }: { mp: PanelProps["myPlaces"] }) {
  if (mp.list.length === 0) return null;
  return (
    <section className="mps">
      <h3><Icon name="home" size={17} />{t("My places")} <span className="count">{mp.list.length}</span></h3>
      <ul className="rows">
        {mp.list.map(({ place, level, rose }) => (
          <li key={place.id} className={`row ${mp.current?.id === place.id ? "sel" : ""}`}>
            <button onClick={() => mp.onOpen(place.id)}>
              <Badge name="home" color={level ? LEVEL_COLOR[level] : "#8a949e"} />
              <span className="main">
                <b>{place.name}</b>
                <small>{place.label}</small>
                <span className={`lvtxt ${level ?? ""}`}>{level ? LEVEL_LABEL[level] : t("Checking…")}{rose && <i className="rose" title={t("Higher than the last time you looked")}>↑ {t("rose since you last looked")}</i>}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="muted">{t("Status within {r} km · last {d}.", { r: mp.radius, d: mp.days === 1 ? t("24 h") : t("{n} days", { n: mp.days }) })} {t("Saved on this device only. Updates every time the data refreshes.")}</p>
    </section>
  );
}

function SavePlace({ mp, place }: { mp: PanelProps["myPlaces"]; place: string | null }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Home");
  if (mp.current) {
    return (
      <div className="savebar saved"><Icon name="check" size={16} strokeWidth={2.5} />{t("Saved as")} <b>{mp.current.name}</b>
        <button onClick={() => mp.onRemove(mp.current!.id)}>{t("Remove")}</button></div>
    );
  }
  if (!mp.canSave) return <p className="muted">{t("You have {n} saved places. Open one and remove it to save this place.", { n: mp.max })}</p>;
  if (!open) return <button className="savebtn" onClick={() => { setName(mp.list.some((x) => x.place.name === "Home") ? "Family" : "Home"); setOpen(true); }}><Icon name="home" size={16} />{t("Save this place")}</button>;
  return (
    <div className="saveform">
      <label>{t("Name this place")}{place ? <small> · {place.replace(/^Near /, "")}</small> : null}
        <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <div className="qpick">{["Home", "Family", "Work", "Farm"].map((n) => <button key={n} onClick={() => setName(n)} aria-pressed={name === n}>{t(n)}</button>)}</div>
      <div className="saveacts"><button className="chipbtn primary" onClick={() => { mp.onSave(name); setOpen(false); }}>{t("Save")}</button><button className="chipbtn" onClick={() => setOpen(false)}>{t("Cancel")}</button></div>
    </div>
  );
}

export default function Panel(p: PanelProps) {
  const a = p.analysis;
  return (
    <div className="panelbody">
      <div className={`dstat ${p.status.offline ? "off" : p.status.fromCache ? "cached" : ""}`} role="status">
        <span>
          {p.status.offline
            ? <>{t("Offline · showing saved data from {x}", { x: p.status.loadedAt ? stamp(new Date(p.status.loadedAt).toISOString()) : t("earlier") })}</>
            : p.status.fromCache
              ? <>{t("Saved data from {x} · updating…", { x: p.status.loadedAt ? stamp(new Date(p.status.loadedAt).toISOString()) : t("earlier") })}</>
              : p.status.refreshing ? <>{t("Updating…")}</>
              : p.status.loadedAt ? <>{t("Updated {x}", { x: ago(new Date(p.status.loadedAt).toISOString(), p.now) })}</> : <>{t("Loading…")}</>}
        </span>
        <span className="dbtns">
        <button className="fullmap" onClick={p.onCollapse} aria-label={t("Full-screen map")}><Icon name="expand" size={15} strokeWidth={2.2} />{t("Full map")}</button>
        <button onClick={p.onRefresh} disabled={p.status.refreshing} aria-label={t("Refresh data")}>
          <Icon name="refresh" size={15} strokeWidth={2.2} className={p.status.refreshing ? "spin" : ""} />
          {p.status.offline ? t("Retry") : t("Refresh")}
        </button>
        </span>
      </div>
      <MyPlaces mp={p.myPlaces} />
      {p.error && <p className="err" role="alert">{p.error}</p>}
      {p.loading && <p className="muted">{t("Loading official reports…")}</p>}

      {p.pin && a ? (
        <>
          <header className="phead">
            <div>
              <h2>{p.place ?? t("Selected point")}</h2>
              <small className="muted">{p.pin.lat.toFixed(4)}, {p.pin.lon.toFixed(4)} · {t("within {r} km", { r: p.radius })} · {p.days === 1 ? t("last 24 hours") : t("last {n} days", { n: p.days })}</small>
            </div>
            <div className="acts">
              <button className="chipbtn" onClick={p.onShare}><Icon name="share" size={15} />{t("Share")}</button>
              <button className="chipbtn" onClick={p.onClear}><Icon name="close" size={15} />{t("Clear")}</button>
            </div>
          </header>
          {p.toast && <p className="toast" role="status">{p.toast}</p>}
          <SavePlace mp={p.myPlaces} place={p.place} />

          <div className={`level lv-${a.level}`}>
            <div className="lvtitle">{LEVEL_LABEL[a.level]}</div>
            <ul>{a.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
          <ul className="caveats">{a.caveats.map((c) => <li key={c}>{c}</li>)}</ul>
          <details className="how">
            <summary>{t("How this is worked out")}</summary>
            <p><b>{t("High")}:</b> {t("a river station above its danger level, or {a}+ incidents within {k} km in the last {h} h.", { a: RULES.manyRecent, k: RULES.recentKm, h: RULES.recentHours })}</p>
            <p><b>{t("Elevated")}:</b> {t("a station above warning level, any incident within {k} km in the last {h} h, or {a}+ incidents in your radius and time window.", { a: RULES.manyInWindow, k: RULES.recentKm, h: RULES.recentHours })}</p>
            <p><b>{t("Some reports")}:</b> {t("at least one incident in your radius and window.")} <b>{t("None")}:</b> {t("nothing reported.")}</p>
            <p>{t("This only counts official reports and readings. It is a summary of what was reported, not a forecast and not a judgement about whether it is okay to travel or stay.")}</p>
          </details>

          <Trend days={p.trend} radius={p.radius} />
          {p.rain.on && (() => {
            const wet = p.rain.near.filter((r) => r.mm > 0).sort((x, y) => y.mm - x.mm);
            return (
              <section>
                <h3><Icon name="rain" size={17} />{t("Rainfall · last {w} h", { w: p.rain.window })} <span className="count">{wet.length}</span></h3>
                {p.rain.near.length === 0
                  ? <p className="muted">{t("No rain stations with a current reading within {r} km.", { r: p.radius })}</p>
                  : wet.length === 0
                    ? <p className="muted">{tn(p.rain.near.length, "No rain recorded in the last {w} h at the {n} reporting station within {r} km.", "No rain recorded in the last {w} h at the {n} reporting stations within {r} km.", { w: p.rain.window, r: p.radius })}</p>
                    : <p className="muted">{t("Wettest nearby")}: <b>{+wet[0].mm.toFixed(1)} mm</b> {t("at")} {rainLabel(wet[0].name).name} ({wet[0].km.toFixed(1)} km). {tn(p.rain.near.length, "{n} station reporting.", "{n} stations reporting.")}</p>}
                {wet.length > 0 && <ul className="rows">{wet.slice(0, 5).map((r) => <RainRow key={r.id} r={r} w={p.rain.window} sel={p.selected?.id === r.id} onSelect={p.onSelect} showKm />)}</ul>}
              </section>
            );
          })()}
          <List icon="alert" title={t("Incidents nearby")} items={p.incidents} empty={t("No reported incidents nearby.")} render={(i) => <IncidentRow key={i.id} i={i} sel={p.selected?.id === i.id} onSelect={p.onSelect} />} />
          <Forecast lat={p.pin.lat} lon={p.pin.lon} />
          <List icon="river" title={t("River stations nearby")} items={p.stations} empty={t("No river stations in this radius (or the Rivers filter is off).")} render={(s) => <StationRow key={s.id} s={s} sel={p.selected?.id === s.id} onSelect={p.onSelect} />} />
        </>
      ) : (
        <>
          <header className="phead"><div><h2>{p.region ?? t("Nepal right now")}</h2><small className="muted">{p.region ? t("Choose a municipality, or tap the map, to check an area.") : t("Tap the map where you are, or search a place, to check an area.")}</small></div></header>
          <div className="stats">
            <div><Icon name="alert" size={16} /><b>{p.overview.incidents}</b><span>{t("reports · last {d}", { d: p.days === 1 ? t("24 h") : t("{n} d", { n: p.days }) })}</span></div>
            <div className="fl"><Icon name="flood" size={16} /><b>{p.overview.flood}</b><span>{t("floods")}</span></div>
            <div className="ls"><Icon name="landslide" size={16} /><b>{p.overview.landslide}</b><span>{t("landslides")}</span></div>
            <div className={p.overview.alerts.length ? "al" : ""}><Icon name="river" size={16} /><b>{p.overview.alerts.length}</b><span>{t("rivers over warning")}</span></div>
          </div>
          <List icon="river" title={t("Rivers above warning level now")} items={p.overview.alerts} empty={t("No river station currently reports above its warning level.")} render={(s) => <StationRow key={s.id} s={s} sel={p.selected?.id === s.id} onSelect={p.onSelect} />} />
          {p.rain.on && (
            <section>
              <h3><Icon name="rain" size={17} />{t("Heaviest rain · last {w} h", { w: p.rain.window })} <span className="count">{p.rain.top.length}</span></h3>
              {p.rain.top.length === 0
                ? <p className="muted">{t("No rain recorded in the last {w} h at the {n} stations with a current reading.", { w: p.rain.window, n: p.rain.meta?.live ?? 0 })}</p>
                : <ul className="rows">{p.rain.top.map((r) => <RainRow key={r.id} r={r} w={p.rain.window} sel={p.selected?.id === r.id} onSelect={p.onSelect} showKm={false} />)}</ul>}
              {p.rain.meta && <p className="muted">{t("{a} of {b} rain stations have a current reading", { a: p.rain.meta.live, b: p.rain.meta.total })}{p.rain.meta.invalid ? `; ${t("{n} report impossible values and are hidden", { n: p.rain.meta.invalid })}` : ""}.</p>}
            </section>
          )}
        </>
      )}

      <NewsBox terms={p.newsTerms} />

      <footer className="disc">
        {p.onInstall && <button className="chipbtn" onClick={p.onInstall}><Icon name="home" size={15} />{t("Install this app on your phone or computer")}</button>}
        {p.updated && <p>{t("Data from {s}, last checked {x}", { s: SOURCE.name, x: stamp(p.updated) })} ({ago(p.updated, p.now)}).</p>}
        <p>{t("Official reports only, possibly delayed or incomplete. A lack of reports does not mean there is no hazard. Follow local authorities and call the emergency numbers above if you are in danger. Map © OpenStreetMap contributors.")}</p>
      </footer>
    </div>
  );
}
