"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FilterBar from "./FilterBar";
import { Badge, Icon } from "./Icon";
import { LEVEL_LABEL } from "@/lib/analysis";
import { HAZARD_COLOR, STATUS_COLOR, RAIN_ZERO } from "@/lib/theme";
import Panel from "./Panel";
import Detail from "./Detail";
import Search, { distName, locName, type Loc } from "./Search";
import { analyze, type Level } from "@/lib/analysis";
import { getLang, t } from "@/lib/i18n";
import { useLang } from "./LangProvider";
import { dailyCounts } from "@/lib/trend";
import { stamp } from "@/lib/format";
// remove the "Near " / " नजिक" wrapper from a place label
const bare = (l: string) => l.replace(/^Near /, "").replace(/ नजिक$/, "");
import { MAX_PLACES, RANK, loadPlaces, sameSpot, savePlaces, type SavedPlace } from "@/lib/places";
import { loadCache, sanitize, saveCache } from "@/lib/cache";
import { circleBbox, haversineKm } from "@/lib/geo";
import { RAIN_STOPS, rainNear } from "@/lib/rain";
import type { Filters, Focus, Overview, Pin, RainWindow, Sel } from "./types";

// "Near Pokhara, Kaski" / "पोखरा, कास्की नजिक", in the current language
const nearLabel = (n: { name_en: string; name_ne?: string | null; district: string; district_ne?: string | null }) =>
  t("Near {x}", { x: lang0() === "ne" && n.name_ne ? `${n.name_ne}, ${n.district_ne ?? n.district}` : `${n.name_en}, ${n.district}` });
const lang0 = () => getLang();
const MapCanvas = dynamic(() => import("./MapCanvas"), { ssr: false, loading: () => <div className="map loading">{t("Loading map…")}</div> });
const NEPAL_BBOX: [number, number, number, number] = [79.9, 26.25, 88.35, 30.55];
const DEFAULTS: Filters = { flood: true, landslide: true, rivers: true, days: 7, radius: 25, rain: true, rainWindow: 3 };

export default function MapApp() {
  const { lang } = useLang(); // re-render everything when the language changes
  const [raw, setRaw] = useState<Overview | null>(null);
  const [loadedAt, setLoadedAt] = useState<number | null>(null); // when the data now on screen was fetched
  const [fromCache, setFromCache] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
    const [now, setNow] = useState(() => Date.now());
  const [f, setF] = useState<Filters>(DEFAULTS);
  const [pin, setPin] = useState<Pin | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null); // a district chosen from the dropdowns, before any point is picked
  const [selected, setSelected] = useState<Sel | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [sheet, setSheet] = useState<"peek" | "open">("peek");
  const [toast, setToast] = useState("");
  const [gps, setGps] = useState({ busy: false, msg: "" });
  // "Install app" button: the browser offers installation through this event
  const [installEvt, setInstallEvt] = useState<{ prompt: () => Promise<void>; userChoice: Promise<unknown> } | null>(null);
  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setInstallEvt(e as unknown as { prompt: () => Promise<void>; userChoice: Promise<unknown> }); };
    const done = () => setInstallEvt(null);
    window.addEventListener("beforeinstallprompt", h); window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", h); window.removeEventListener("appinstalled", done); };
  }, []);
  const install = async () => { if (!installEvt) return; await installEvt.prompt(); await installEvt.userChoice; setInstallEvt(null); };
  const [terms, setTerms] = useState<string[]>([]); // English place names, used to find local news headlines
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  useEffect(() => setPlaces(loadPlaces()), []);
  const persist = (next: SavedPlace[]) => { setPlaces(next); savePlaces(next); };
  const [panelOpen, setPanelOpen] = useState(true);
  useEffect(() => { try { if (localStorage.getItem("nfw-panel") === "closed") setPanelOpen(false); } catch { /* storage blocked */ } }, []);
  // the map is a different size once the panel has opened or closed, so frame the checked area again after it settles
  const pinRef = useRef<Pin | null>(null);
  const radiusRef = useRef(DEFAULTS.radius);
  const firstPanel = useRef(true);
  useEffect(() => {
    if (firstPanel.current) { firstPanel.current = false; return; }
    const t = setTimeout(() => { const p = pinRef.current; if (p) setFocus((o) => ({ bbox: circleBbox(p.lat, p.lon, radiusRef.current), nonce: (o?.nonce ?? 0) + 1 })); }, 380);
    return () => clearTimeout(t);
  }, [panelOpen]);
  const togglePanel = (open: boolean) => { setPanelOpen(open); try { localStorage.setItem("nfw-panel", open ? "open" : "closed"); } catch { /* ignore */ } };
  const appRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const [hydrated, setHydrated] = useState(false); // don't overwrite a shared link's URL before it has been read

  const load = useCallback(() => {
    setRefreshing(true);
    fetch("/api/overview").then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: Overview) => { setRaw(d); setFromCache(false); setOffline(false); setLoadedAt(Date.now()); setNow(Date.now()); saveCache(d); })
      .catch(() => setOffline(true))
      .finally(() => setRefreshing(false));
  }, []);
  // show saved data straight away (if any), then fetch fresh data and swap it in
  useEffect(() => {
    const c = loadCache();
    if (c) { setRaw(c.data); setLoadedAt(c.savedAt); setFromCache(true); }
    load();
    const t = setInterval(load, 5 * 60_000), tick = setInterval(() => setNow(Date.now()), 60_000);
    window.addEventListener("online", load);
    return () => { clearInterval(t); clearInterval(tick); window.removeEventListener("online", load); };
  }, [load]);
  const data = useMemo(() => (raw ? sanitize(raw, now) : null), [raw, now]);
  const fetchError = offline && !raw ? t("Could not load the latest reports. Check your connection and try again.") : "";

  // keep map buttons and the hint clear of the legend, whatever height it wraps to
  useEffect(() => {
    const el = legendRef.current, app = appRef.current; if (!el || !app) return;
    const top = topRef.current;
    const ro = new ResizeObserver(() => {
      app.style.setProperty("--legend-h", `${el.offsetHeight}px`);
      if (top) app.style.setProperty("--top-h", `${top.offsetHeight}px`);
    });
    ro.observe(el); if (top) ro.observe(top); return () => ro.disconnect();
  }, []);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2500); };

  const nameFor = useCallback((lat: number, lon: number) => {
    setPlace(null);
    fetch(`/api/locations?near=${lat},${lon}`).then((r) => r.json())
      .then((d) => {
        if (d.nearest) { setTerms([d.nearest.name_en, d.nearest.district]); setPlace(`${nearLabel(d.nearest)}`); } else { setTerms([]); setPlace(t("Selected point")); }
      }).catch(() => setPlace(t("Selected point")));
  }, []);

  // back to the "Nepal right now" view: nothing selected, so show the whole country
  const showNepal = () => { setPin(null); setPlace(null); setRegion(null); setSelected(null); setFocus((o) => ({ bbox: NEPAL_BBOX, nonce: (o?.nonce ?? 0) + 1, wide: true })); };
  const refit = (lat: number, lon: number, r: number) => setFocus((o) => ({ bbox: circleBbox(lat, lon, r), nonce: (o?.nonce ?? 0) + 1 }));

  // restore from a shared link
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const lat = Number(q.get("lat")), lon = Number(q.get("lon"));
    const nf: Filters = { ...DEFAULTS };
    if ([1, 3, 7, 14].includes(Number(q.get("d")))) nf.days = Number(q.get("d"));
    if ([5, 10, 25, 50].includes(Number(q.get("r")))) nf.radius = Number(q.get("r"));
    if (q.get("h") != null) { const h = q.get("h")!; nf.flood = h.includes("f"); nf.landslide = h.includes("l"); nf.rivers = h.includes("r"); nf.rain = h.includes("w"); }
    if ([1, 3, 6, 24].includes(Number(q.get("rw")))) nf.rainWindow = Number(q.get("rw")) as RainWindow;
    setF(nf);
    if (q.get("lat") && q.get("lon") && Number.isFinite(lat) && Number.isFinite(lon)) {
      setPin({ lat, lon }); setPlace(q.get("n")); if (!q.get("n")) nameFor(lat, lon); refit(lat, lon, nf.radius);
    }
    setHydrated(true);
  }, [nameFor]);

  useEffect(() => {
    if (!hydrated) return;
    const q = new URLSearchParams();
    if (pin) { q.set("lat", pin.lat.toFixed(4)); q.set("lon", pin.lon.toFixed(4)); if (place) q.set("n", place); }
    q.set("d", String(f.days)); q.set("r", String(f.radius));
    q.set("h", `${f.flood ? "f" : ""}${f.landslide ? "l" : ""}${f.rivers ? "r" : ""}${f.rain ? "w" : ""}`); q.set("rw", String(f.rainWindow));
    history.replaceState(null, "", `?${q}`);
  }, [hydrated, pin, place, f]);

  const setPoint = (lat: number, lon: number, label?: string, fit = false) => {
    setPin({ lat, lon }); setRegion(null); setSelected(null); setSheet("peek");
    if (label) setPlace(label); else nameFor(lat, lon);
    if (fit) refit(lat, lon, f.radius);
  };
  // choosing a place pulls its information into the left panel, even from full-screen map mode
  const onPlace = (l: Loc) => { setTerms([l.name_en, l.district]); setPoint(l.lat, l.lon, `${locName(l)}, ${distName(l)}`, true); setPanelOpen(true); };
  const onGps = () => {
    if (!navigator.geolocation) { setGps({ busy: false, msg: t("Location is not available on this device.") }); return; }
    setGps({ busy: true, msg: t("Finding your location…") });
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGps({ busy: false, msg: "" });
        const { latitude: la, longitude: lo } = p.coords;
        if (la < 26 || la > 31 || lo < 79.5 || lo > 88.5) { setGps({ busy: false, msg: t("Your location is outside Nepal. Tap the map to pick a place.") }); return; }
        setPoint(la, lo, undefined, true); setPanelOpen(true);
      },
      () => setGps({ busy: false, msg: t("Could not get your location. Search or tap the map instead.") }),
      { timeout: 15000, maximumAge: 300000 },
    );
  };
  const patch = (p: Partial<Filters>) => {
    setF((o) => ({ ...o, ...p }));
    if (p.radius && pin) refit(pin.lat, pin.lon, p.radius);
  };

  pinRef.current = pin; radiusRef.current = f.radius;
  const filtersChanged = (Object.keys(DEFAULTS) as (keyof Filters)[]).some((k) => f[k] !== DEFAULTS[k]);
  // one tap back to a clean start: no place, no selection, default filters, whole of Nepal, fresh data
  const resetAll = () => { setF(DEFAULTS); setSheet("peek"); showNepal(); load(); };
  const resetFilters = () => { setF(DEFAULTS); if (pin) refit(pin.lat, pin.lon, DEFAULTS.radius); setSelected(null); };

  const share = async () => {
    const url = location.href;
    // a message that makes sense on its own in WhatsApp or SMS, for families checking on each other
    const when = data?.updated ? stamp(data.updated) : "";
    const text = analysis
      ? `${bare(place ?? t("Selected place"))}: ${LEVEL_LABEL[analysis.level]}. ${analysis.reasons[0]}.${when ? ` ${t("Data checked {x}.", { x: when })}` : ""} ${t("Official BIPAD reports only, not a guarantee either way.")}`
      : t("Reported floods and landslides near a place in Nepal");
    try {
      if (navigator.share) await navigator.share({ title: "Nepal Flood & Landslide Watch", text, url });
      else { await navigator.clipboard.writeText(`${text}\n${url}`); flash(t("Status and link copied")); }
    } catch { /* user cancelled */ }
  };

  const since = now - f.days * 86_400_000;
  const incidents = data?.incidents ?? [], stations = data?.stations ?? [];
  const shownIncidents = useMemo(() => incidents.filter((i) => ((i.hazard === "flood" && f.flood) || (i.hazard === "landslide" && f.landslide)) && Date.parse(i.occurred_at) >= since), [incidents, f.flood, f.landslide, since]);
  const shownStations = f.rivers ? stations : [];

  const withKm = <T extends { lat: number; lon: number }>(xs: T[]) =>
    pin ? xs.map((x) => ({ ...x, km: haversineKm(pin.lat, pin.lon, x.lat, x.lon) })).filter((x) => x.km <= f.radius).sort((a, b) => a.km - b.km) : [];
  const nearIncidents = useMemo(() => withKm(shownIncidents), [shownIncidents, pin, f.radius]); // eslint-disable-line react-hooks/exhaustive-deps
  const nearStations = useMemo(() => withKm(shownStations), [shownStations, pin, f.radius]); // eslint-disable-line react-hooks/exhaustive-deps
  const analysis = useMemo(() => (pin && data ? analyze(pin.lat, pin.lon, f.radius, f.days, incidents, stations, now) : null), [pin, data, f.radius, f.days, incidents, stations, now, lang]);
  // status of every saved place, recomputed whenever data refreshes or the radius/period changes
  const placeInfo = useMemo(() => places.map((pl) => {
    const a = data ? analyze(pl.lat, pl.lon, f.radius, f.days, incidents, stations, now) : null;
    return { place: pl, level: (a?.level ?? null) as Level | null, rose: !!a && pl.lastLevel != null && RANK[a.level] > RANK[pl.lastLevel] };
  }), [places, data, f.radius, f.days, incidents, stations, now]);
  const currentSaved = pin ? places.find((pl) => sameSpot(pl, pin)) : undefined;
  // viewing a saved place counts as having looked at it: remember its level so a later rise can be flagged
  useEffect(() => {
    if (currentSaved && analysis && currentSaved.lastLevel !== analysis.level) persist(places.map((pl) => (pl.id === currentSaved.id ? { ...pl, lastLevel: analysis.level } : pl)));
  }, [currentSaved?.id, analysis?.level]); // eslint-disable-line react-hooks/exhaustive-deps
  const savePlace = (name: string) => {
    if (!pin || places.length >= MAX_PLACES || currentSaved) return;
    persist([...places, { id: Date.now().toString(36), name: name.trim().slice(0, 24) || t("My place"), label: bare(place ?? t("Selected point")), terms, lat: pin.lat, lon: pin.lon, lastLevel: analysis?.level }]);
  };
  const removePlace = (id: string) => persist(places.filter((pl) => pl.id !== id));
  const openPlace = (id: string) => {
    const pl = places.find((x) => x.id === id); if (!pl) return;
    setTerms(pl.terms ?? []); setPoint(pl.lat, pl.lon, `${pl.name} · ${pl.label}`, true); setPanelOpen(true);
  };
  const trend = useMemo(() => (pin ? dailyCounts(pin.lat, pin.lon, f.radius, incidents, now) : []), [pin, f.radius, incidents, now, lang]);
  const newsTerms = pin ? terms : [];
  const rainData = data?.rain ?? [];
  const shownRain = f.rain ? rainData : [];
  const nearRain = useMemo(() => (pin && f.rain ? rainNear(pin.lat, pin.lon, f.radius, rainData, f.rainWindow) : []), [pin, f.rain, f.radius, f.rainWindow, rainData]);
  const topRain = useMemo(() => (f.rain ? rainNear(28.3, 84.1, 1000, rainData, f.rainWindow).filter((r) => r.mm > 0).sort((a, b) => b.mm - a.mm).slice(0, 5) : []), [f.rain, f.rainWindow, rainData]);
  const overview = useMemo(() => ({
    incidents: shownIncidents.length,
    flood: shownIncidents.filter((i) => i.hazard === "flood").length,
    landslide: shownIncidents.filter((i) => i.hazard === "landslide").length,
    alerts: stations.filter((s) => s.status === "danger" || s.status === "warning").sort((a, b) => (a.status === "danger" ? -1 : 1) - (b.status === "danger" ? -1 : 1)),
  }), [shownIncidents, stations]);

  return (
    <div className="app" data-sheet={sheet} data-panel={panelOpen ? "open" : "closed"} data-detail={selected ? "open" : "closed"} ref={appRef}>
      <div className="mapwrap">
        <MapCanvas places={placeInfo.map((x) => ({ id: x.place.id, name: x.place.name, lat: x.place.lat, lon: x.place.lon, level: x.level }))} onPlaceClick={openPlace} incidents={shownIncidents} stations={shownStations} rain={shownRain} rainWindow={f.rainWindow} pin={pin} radiusKm={f.radius} focus={focus} selected={selected} now={now}
          onMapClick={(la, lo) => setPoint(la, lo)} onSelect={(s) => setSelected(s)}
          onDragPin={(la, lo) => setPoint(la, lo)} />
        {panelOpen
          ? <button className="ptab" onClick={() => togglePanel(false)} aria-label={t("Hide the details panel for a full-screen map")} title={t("Full-screen map")}><Icon name="chevronLeft" size={18} strokeWidth={2.4} /></button>
          : <button className={`pchip ${analysis ? `lv-${analysis.level}` : ""}`} onClick={() => togglePanel(true)} aria-label={t("Show the details panel")}>
              <Icon name="sidebar" size={18} />
              <span>{analysis ? LEVEL_LABEL[analysis.level] : t("Details")}</span>
              <Icon name="chevronRight" size={16} strokeWidth={2.4} />
            </button>}
        <div className="top" ref={topRef}>
          <Search places={placeInfo} onOpenPlace={openPlace} label={pin ? (place ?? t("Locating…")) : region} onClear={showNepal} onHome={resetAll}
            onPlace={onPlace} onRegion={(b, label) => { setPanelOpen(true); setRegion(label); setPin(null); setPlace(null); setFocus((o) => ({ bbox: b, nonce: (o?.nonce ?? 0) + 1 })); }} onGps={onGps} gpsBusy={gps.busy} gpsMsg={gps.msg} />
          <FilterBar f={f} set={patch} hasPin={!!pin} changed={filtersChanged} onReset={resetFilters} />
        </div>
        {!pin && <p className="hint">{t("Tap anywhere on the map to check that area")}</p>}
        <div className="legend" ref={legendRef} aria-label={t("Map legend")}>
          <div className="lg"><b>{t("Reports")}</b>
            <span><Badge name="flood" color={HAZARD_COLOR.flood} size={18} />{t("Flood")}</span>
            <span><Badge name="landslide" color={HAZARD_COLOR.landslide} size={18} />{t("Landslide")}</span></div>
          <div className="lg"><b>{t("Rivers")}</b>
            {(["normal", "warning", "danger", "unavailable"] as const).map((k) => <span key={k}><Badge name="river" color={STATUS_COLOR[k]} size={18} />{k === "unavailable" ? t("No data") : t(k[0].toUpperCase() + k.slice(1))}</span>)}</div>
          {f.rain && (
            <div className="lg rampg"><b>{t("Rain · last {w} h", { w: f.rainWindow })}</b>
              <span className="ramp" role="img" aria-label={t("Rain colour scale in millimetres: none, under 5, 5, 15.6, 64.5, 115.6 and over")}>
                {[["None", RAIN_ZERO, "0"], ...RAIN_STOPS.map(([v, c, l]) => [l, c, v < 1 ? "<5" : String(v)])].map(([l, c, tick]) => (
                  <span key={l} title={t(l)}><i style={{ background: c }} /><em>{tick}</em></span>
                ))}
                <small>mm</small>
              </span>
            </div>
          )}
        </div>
        {selected && (
          <Detail sel={selected} incidents={shownIncidents} stations={shownStations} rain={shownRain} rainWindow={f.rainWindow} days={f.days} now={now}
            onSelect={setSelected} onClose={() => setSelected(null)}
            onCheck={(la, lo) => { setPoint(la, lo, undefined, true); setPanelOpen(true); }} />
        )}
      </div>
      <aside className="sheet" aria-label={t("Area details")}>
        <button className="grab" onClick={() => setSheet(sheet === "peek" ? "open" : "peek")} aria-expanded={sheet === "open"} aria-label={sheet === "open" ? t("Show less") : t("Show details")}><span /></button>
        <Panel onInstall={installEvt ? install : undefined} newsTerms={newsTerms} trend={trend} myPlaces={{ list: placeInfo, current: currentSaved, canSave: places.length < MAX_PLACES, max: MAX_PLACES, onOpen: openPlace, onSave: savePlace, onRemove: removePlace, days: f.days, radius: f.radius }} region={region} rain={{ on: f.rain, window: f.rainWindow, near: nearRain, top: topRain, meta: data?.rain_meta ?? null }} pin={pin} place={place} radius={f.radius} days={f.days} updated={data?.updated ?? null} now={now} analysis={analysis}
          incidents={nearIncidents} stations={nearStations} overview={overview} selected={selected}
          onSelect={(s) => setSelected(s)} onClear={showNepal}
          onShare={share} toast={toast} loading={!data && !fetchError} error={fetchError}
          status={{ loadedAt, fromCache, refreshing, offline: offline && !!raw }} onRefresh={load} onCollapse={() => togglePanel(false)} />
      </aside>
    </div>
  );
}
