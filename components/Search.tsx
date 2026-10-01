"use client";
import { useEffect, useRef, useState } from "react";
import { Badge, Icon } from "./Icon";
import { getLang, t } from "@/lib/i18n";
import { LEVEL_COLOR } from "@/lib/theme";
import { LEVEL_LABEL, type Level } from "@/lib/analysis";
import type { SavedPlace } from "@/lib/places";

export type Loc = { id: number; name_en: string; name_ne: string | null; district: string; district_ne: string | null; province: string; province_ne?: string | null; lat: number; lon: number };
type District = { province: string; province_ne?: string | null; district: string; district_ne?: string | null };
// show Nepali names when the interface is in Nepali; values sent to the API stay English
const ne = () => getLang() === "ne";
export const locName = (l: { name_en: string; name_ne: string | null }) => (ne() && l.name_ne ? l.name_ne : l.name_en);
export const distName = (l: { district: string; district_ne?: string | null }) => (ne() && l.district_ne ? l.district_ne : l.district);
const provName = (l: { province: string; province_ne?: string | null }) => (ne() && l.province_ne ? l.province_ne : l.province);

export default function Search({ places, onOpenPlace, label, onClear, onHome, onPlace, onRegion, onGps, gpsBusy, gpsMsg }: {
  places: { place: SavedPlace; level: Level | null; rose: boolean }[]; onOpenPlace: (id: string) => void;
  label: string | null; onClear: () => void; onHome: () => void;
  onPlace: (l: Loc) => void; onRegion: (bbox: [number, number, number, number], label: string) => void; onGps: () => void; gpsBusy: boolean; gpsMsg: string;
}) {
  const [typed, setTyped] = useState<string | null>(null); // null = show the current selection instead of typed text
  const q = typed ?? "";
  const setQ = (v: string) => setTyped(v);
  const [results, setResults] = useState<Loc[]>([]);
  const [browse, setBrowse] = useState(false);
  const [districts, setDistricts] = useState<District[]>([]);
  const [prov, setProv] = useState(""), [dist, setDist] = useState(""), [muni, setMuni] = useState("");
  const [munis, setMunis] = useState<Loc[]>([]);
  const wrap = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const fromHere = useRef(false); // true when the current label was chosen in this component
  useEffect(() => {
    if (fromHere.current) { fromHere.current = false; return; }
    setProv(""); setDist(""); setMuni(""); setMunis([]); // selection came from the map/GPS: forget the dropdown choices
  }, [label]);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/locations?q=${encodeURIComponent(q.trim())}`).then((r) => r.json()).then((d) => setResults(d.results)).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!browse || districts.length) return;
    fetch("/api/locations?meta=1").then((r) => r.json()).then((d) => setDistricts(d.districts)).catch(() => {});
  }, [browse, districts.length]);

  useEffect(() => {
    const away = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) { setResults([]); setBrowse(false); } };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, []);

  const chooseProv = (v: string) => { setProv(v); setDist(""); setMuni(""); setMunis([]); };
  const chooseDist = (v: string) => {
    setDist(v); setMuni(""); setMunis([]);
    if (!v) return;
    fetch(`/api/locations?district=${encodeURIComponent(v)}`).then((r) => r.json()).then((d: { results: Loc[] }) => {
      setMunis(d.results);
      if (d.results.length) {
        const la = d.results.map((x) => x.lat), lo = d.results.map((x) => x.lon);
        fromHere.current = true;
        onRegion([Math.min(...lo) - 0.05, Math.min(...la) - 0.05, Math.max(...lo) + 0.05, Math.max(...la) + 0.05], t("{d} district, {p}", { d: distObj ? distName(distObj) : v, p: provObj ? provName(provObj) : prov })); // fly to the district
      }
    }).catch(() => {});
  };
  const chooseMuni = (id: string) => { setMuni(id); const l = munis.find((m) => String(m.id) === id); if (l) { fromHere.current = true; setTyped(null); onPlace(l); setBrowse(false); } };
  const pick = (l: Loc) => { setResults([]); setTyped(null); fromHere.current = true; onPlace(l); };
  // full reset: forget typed text and dropdown choices too, then let the app reset the map, filters and view
  const home = () => { setTyped(null); setResults([]); setBrowse(false); setProv(""); setDist(""); setMuni(""); setMunis([]); fromHere.current = false; onHome(); };
  const clear = () => { setTyped(null); setResults([]); setProv(""); setDist(""); setMuni(""); setMunis([]); fromHere.current = false; onClear(); };
  const provinces = [...new Map(districts.map((d) => [d.province, d])).values()];
  const provObj = districts.find((d) => d.province === prov), distObj = districts.find((d) => d.district === dist);

  return (
    <div className="search" ref={wrap}>
      <div className="searchrow">
        <input className="q" value={typed ?? label ?? ""} onChange={(e) => setQ(e.target.value)} onFocus={(e) => { e.target.select(); setFocused(true); }} onBlur={() => { if (!q.trim()) setTyped(null); setTimeout(() => setFocused(false), 150); }}
          placeholder={t("Search a place · काठमाडौँ")} aria-label={t("Search a municipality or district")} autoComplete="off" />
        {(label || typed) && <button className="icon x" onClick={clear} aria-label={t("Clear selected place")} title={t("Clear")}><Icon name="close" size={20} strokeWidth={2.2} /></button>}
        <button className="icon" onClick={home} aria-label={t("Reset the map and show all of Nepal")} title={t("Reset map · show all of Nepal")}><Icon name="home" size={22} /></button>
        <button className="icon" onClick={onGps} disabled={gpsBusy} aria-label={t("Use my location")} title={t("Use my location")}>
          <Icon name="locate" size={22} />
        </button>
        <button className="icon" aria-expanded={browse} onClick={() => setBrowse((b) => !b)} aria-label={t("Browse regions")} title={t("Browse by province, district, municipality")}>
          <Icon name="menu" size={22} />
        </button>
      </div>
      {gpsMsg && <p className="toast" role="status">{gpsMsg}</p>}
      {focused && !browse && !q.trim() && places.length > 0 && (
        <ul className="dd" role="listbox" aria-label={t("My places")}>
          <li className="ddh">{t("My places")}</li>
          {places.map(({ place: pl, level, rose }) => (
            <li key={pl.id}><button onMouseDown={(e) => e.preventDefault()} onClick={() => { setFocused(false); fromHere.current = true; setTyped(null); onOpenPlace(pl.id); }}>
              <span className="mprow"><Badge name="home" color={level ? LEVEL_COLOR[level] : "#8a949e"} size={26} />
                <span><b>{pl.name}</b><small>{pl.label}</small></span>
                <em className={`mplv ${level ?? ""}`}>{level ? LEVEL_LABEL[level] : "…"}{rose ? " ↑" : ""}</em></span>
            </button></li>
          ))}
        </ul>
      )}
      {results.length > 0 && (
        <ul className="dd" role="listbox">
          {results.slice(0, 7).map((l) => (
            <li key={l.id}><button onClick={() => pick(l)}><b>{locName(l)}</b>{l.name_ne && l.name_en !== locName(l) ? <span> · {l.name_en}</span> : l.name_ne ? <span> · {l.name_ne}</span> : null}<small>{distName(l)}, {provName(l)}</small></button></li>
          ))}
        </ul>
      )}
      {browse && (
        <div className="dd browse">
          <div className="crumbs" aria-live="polite">
            {prov ? <><b>{provObj ? provName(provObj) : prov}</b>{dist && <> › <b>{distObj ? distName(distObj) : dist}</b></>}{muni && <> › <b>{(() => { const m = munis.find((x) => String(x.id) === muni); return m ? locName(m) : ""; })()}</b></>}</> : t("Choose a province, then a district, then a municipality")}
          </div>
          <label className={prov ? "filled" : ""}>{prov ? "✓ " : "1. "}{t("Province")}
            <select value={prov} onChange={(e) => chooseProv(e.target.value)}>
              <option value="">{t("Choose province")}</option>
              {provinces.map((p) => <option key={p.province} value={p.province}>{provName(p)}</option>)}
            </select>
          </label>
          <label className={dist ? "filled" : ""}>{dist ? "✓ " : "2. "}{t("District")}
            <select value={dist} onChange={(e) => chooseDist(e.target.value)} disabled={!prov}>
              <option value="">{prov ? t("Choose district") : t("Pick a province first")}</option>
              {districts.filter((d) => d.province === prov).map((d) => <option key={d.district} value={d.district}>{distName(d)}</option>)}
            </select>
          </label>
          <label className={muni ? "filled" : ""}>{muni ? "✓ " : "3. "}{t("Municipality")}
            <select value={muni} onChange={(e) => chooseMuni(e.target.value)} disabled={!dist || !munis.length}>
              <option value="">{!dist ? t("Pick a district first") : munis.length ? t("Choose municipality") : t("Loading…")}</option>
              {munis.map((m) => <option key={m.id} value={m.id}>{locName(m)}</option>)}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
