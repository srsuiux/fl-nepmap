"use client";
import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { circlePolygon } from "@/lib/geo";
const WORLD: [number, number][] = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
import { HAZARD_COLOR, STATUS_COLOR } from "@/lib/theme";
import { registerMapIcons } from "@/lib/mapicons";
import { loadBasemap } from "@/lib/basemap";
import { RAIN_STOPS, rainAt } from "@/lib/rain";
import type { Focus, OIncident, ORain, OStation, Pin, RainWindow, Sel } from "./types";

// Bundlers break MapLibre's worker; serve it from /public (copied by the predev/prebuild scripts).
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const NEPAL_BOUNDS: [[number, number], [number, number]] = [[79.9, 26.25], [88.35, 30.55]];

type Props = {
  places: { id: string; name: string; lat: number; lon: number; level: string | null }[]; onPlaceClick: (id: string) => void;
  incidents: OIncident[]; stations: OStation[]; rain: ORain[]; rainWindow: RainWindow; pin: Pin | null; radiusKm: number; focus: Focus | null;
  selected: Sel | null; now: number;
  onMapClick: (lat: number, lon: number) => void; onSelect: (s: Sel | null) => void; onDragPin: (lat: number, lon: number) => void;
};

type GJ = Exclude<Parameters<maplibregl.GeoJSONSource["setData"]>[0], string>;
type Feat = { type: "Feature"; properties: Record<string, unknown>; geometry: { type: "Point"; coordinates: [number, number] } };
const fc = (features: Feat[]) => ({ type: "FeatureCollection", features }) as GJ;
const pt = (lon: number, lat: number, properties: Record<string, unknown>): Feat => ({
  type: "Feature", properties, geometry: { type: "Point", coordinates: [lon, lat] },
});

export default function MapCanvas(p: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);
  const roRef = useRef<ResizeObserver | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const props = useRef(p);
  props.current = p;

  const sync = () => {
    const m = map.current; if (!m || !ready.current) return;
    const { incidents, stations, rain, rainWindow, pin, radiusKm, now } = props.current;
    (m.getSource("inc") as maplibregl.GeoJSONSource).setData(fc(incidents.map((i) =>
      pt(i.lon, i.lat, { id: i.id, hazard: i.hazard, color: HAZARD_COLOR[i.hazard], recent: now - Date.parse(i.occurred_at) <= 86_400_000 ? 1 : 0 }))));
    (m.getSource("riv") as maplibregl.GeoJSONSource).setData(fc(stations.map((s) =>
      pt(s.lon, s.lat, { id: s.id, status: s.status, color: STATUS_COLOR[s.status], na: s.status === "unavailable" ? 1 : 0 }))));
    (m.getSource("places") as maplibregl.GeoJSONSource).setData(fc(props.current.places.map((q) => pt(q.lon, q.lat, { id: q.id, name: q.name, icon: `place-${q.level ?? "unknown"}` }))));
    (m.getSource("rain") as maplibregl.GeoJSONSource).setData(fc(rain.map((r) => pt(r.lon, r.lat, { id: r.id, mm: rainAt(r, rainWindow) ?? 0 }))));
    const circle = pin ? circlePolygon(pin.lat, pin.lon, radiusKm) : null;
    (m.getSource("radius") as maplibregl.GeoJSONSource).setData((circle ?? fc([])) as GJ);
    (m.getSource("areamask") as maplibregl.GeoJSONSource).setData((circle
      ? { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [WORLD, [...circle.geometry.coordinates[0]].reverse()] } }
      : fc([])) as GJ);
    if (pin) {
      if (!marker.current) {
        const el = document.createElement("div"); el.className = "pin"; el.setAttribute("aria-label", "Selected location");
        el.addEventListener("click", (e) => e.stopPropagation());
        marker.current = new maplibregl.Marker({ element: el, draggable: true, anchor: "bottom" }).setLngLat([pin.lon, pin.lat]).addTo(m);
        marker.current.on("dragend", () => { const l = marker.current!.getLngLat(); props.current.onDragPin(l.lat, l.lng); });
      } else marker.current.setLngLat([pin.lon, pin.lat]);
    } else { marker.current?.remove(); marker.current = null; }
  };

  useEffect(() => {
    let cancelled = false;
    loadBasemap().then(({ style, before }) => { if (!cancelled) init(style as maplibregl.StyleSpecification, before); });
    return () => {
      cancelled = true; roRef.current?.disconnect(); marker.current?.remove(); marker.current = null;
      map.current?.remove(); map.current = null; ready.current = false;
    };

    function init(style: maplibregl.StyleSpecification, before: string | undefined) {
    const m = new maplibregl.Map({
      container: box.current!, center: [84.1, 28.3], zoom: 6.2, minZoom: 5, maxZoom: 17,
      ...(props.current.focus ? {} : { bounds: NEPAL_BOUNDS, fitBoundsOptions: { padding: { top: window.innerWidth < 900 ? 250 : 210, bottom: window.innerWidth < 900 ? 230 : 110, left: 20, right: 20 } } }),
      maxBounds: [[78.5, 25.5], [89.5, 31.2]], attributionControl: false, dragRotate: false, style,
    });
    map.current = m;
    const ro = new ResizeObserver(() => m.resize()); // the map area grows/shrinks when the side panel is pushed away
    ro.observe(box.current!);
    roRef.current = ro;
    m.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    m.touchZoomRotate.disableRotation();

    m.on("load", () => {
      registerMapIcons(m);
      for (const id of ["inc", "riv", "rain", "radius", "areamask", "selpt", "places"]) m.addSource(id, { type: "geojson", data: fc([]) });
      m.addSource("nepal", { type: "geojson", data: "/geo/nepal.json" });

      // Nepal's official outline: dim everything outside, glow the border, faint province lines
      m.addLayer({ id: "mask", type: "fill", source: "nepal", filter: ["==", ["get", "kind"], "mask"], paint: { "fill-color": "#0b1f33", "fill-opacity": 0.3 } }, before);
      m.addLayer({ id: "prov-lines", type: "line", source: "nepal", filter: ["==", ["get", "kind"], "provinces"], paint: { "line-color": "#7a1f2b", "line-opacity": 0.45, "line-width": 1, "line-dasharray": [4, 3] } }, before);
      m.addLayer({ id: "border-glow", type: "line", source: "nepal", filter: ["==", ["get", "kind"], "border"], layout: { "line-join": "round" }, paint: { "line-color": "#e11d48", "line-opacity": 0.5, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 6, 12, 14], "line-blur": 6 } }, before);
      m.addLayer({ id: "border-line", type: "line", source: "nepal", filter: ["==", ["get", "kind"], "border"], layout: { "line-join": "round" }, paint: { "line-color": "#be123c", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.8, 12, 3.2] } }, before);

      // checked area: dim everything outside it, tint the inside, outline it (pulses when it changes)
      m.addLayer({ id: "area-mask", type: "fill", source: "areamask", paint: { "fill-color": "#0b1f33", "fill-opacity": 0.2 } }, before);
      m.addLayer({ id: "radius-fill", type: "fill", source: "radius", paint: { "fill-color": "#0f766e", "fill-opacity": 0.1 } }, before);
      m.addLayer({ id: "radius-line", type: "line", source: "radius", paint: { "line-color": "#0f766e", "line-width": 2.5 } }, before);

      // zoomed out: soft dots (clean overview); zoomed in: icon badges
      const SWITCH = 8.5;
      const ramp: unknown[] = ["interpolate", ["linear"], ["get", "mm"], 0, "#d7e3ee", ...RAIN_STOPS.flatMap(([v, c]) => [v, c])];
      m.addLayer({ id: "rain", type: "circle", source: "rain", maxzoom: SWITCH, paint: {
        "circle-color": ramp as never, "circle-opacity": ["case", ["<", ["get", "mm"], 0.1], 0.35, 0.72],
        "circle-radius": ["interpolate", ["linear"], ["get", "mm"], 0, 3, 5, 9, 30, 16, 100, 26, 200, 34],
        "circle-stroke-width": ["case", ["<", ["get", "mm"], 0.1], 0, 1.5], "circle-stroke-color": "#fff",
      } }, before);
      m.addLayer({ id: "rain-glow", type: "circle", source: "rain", minzoom: SWITCH, filter: [">=", ["get", "mm"], 0.1], paint: {
        "circle-color": ramp as never, "circle-opacity": 0.28, "circle-blur": 0.6,
        "circle-radius": ["interpolate", ["linear"], ["get", "mm"], 0, 14, 5, 22, 30, 32, 100, 44],
      } }, before);
      m.addLayer({ id: "rain-icon", type: "symbol", source: "rain", minzoom: SWITCH, layout: {
        "icon-image": ["step", ["get", "mm"], "rain-0", 0.1, "rain-1", 5, "rain-2", 15.6, "rain-3", 64.5, "rain-4", 115.6, "rain-5"],
        "icon-size": ["interpolate", ["linear"], ["zoom"], SWITCH, ["case", ["<", ["get", "mm"], 0.1], 0.4, 0.62], 14, ["case", ["<", ["get", "mm"], 0.1], 0.6, 1]],
        "icon-allow-overlap": true, "icon-ignore-placement": true,
      } }, before);
      m.addLayer({ id: "riv", type: "circle", source: "riv", maxzoom: SWITCH,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, ["case", ["==", ["get", "na"], 1], 2.5, 4.5], 8.5, ["case", ["==", ["get", "na"], 1], 3.5, 6.5]],
          "circle-color": ["get", "color"], "circle-opacity": ["case", ["==", ["get", "na"], 1], 0.55, 1],
          "circle-stroke-width": ["case", ["==", ["get", "na"], 1], 1, 2.5], "circle-stroke-color": "#fff",
        } }, before);
      m.addLayer({ id: "riv-icon", type: "symbol", source: "riv", minzoom: SWITCH, layout: {
        "icon-image": ["concat", "riv-", ["get", "status"]],
        "icon-size": ["interpolate", ["linear"], ["zoom"], SWITCH, ["case", ["==", ["get", "na"], 1], 0.42, 0.62], 14, ["case", ["==", ["get", "na"], 1], 0.6, 0.95]],
        "icon-allow-overlap": true, "icon-ignore-placement": true,
      }, paint: { "icon-opacity": ["case", ["==", ["get", "na"], 1], 0.7, 1] } }, before);
      m.addLayer({ id: "inc-halo", type: "circle", source: "inc", filter: ["==", ["get", "recent"], 1],
        paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 8, 12, 24], "circle-color": ["get", "color"], "circle-opacity": 0.28, "circle-blur": 0.5 } }, before);
      m.addLayer({ id: "inc", type: "circle", source: "inc", maxzoom: SWITCH,
        paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3.5, 8.5, 6], "circle-color": ["get", "color"], "circle-stroke-width": 1.5, "circle-stroke-color": "#fff", "circle-opacity": 0.92 } }, before);
      m.addLayer({ id: "inc-icon", type: "symbol", source: "inc", minzoom: SWITCH, layout: {
        "icon-image": ["concat", "inc-", ["get", "hazard"]],
        "icon-size": ["interpolate", ["linear"], ["zoom"], SWITCH, 0.66, 14, 1.05],
        "icon-allow-overlap": true, "icon-ignore-placement": true,
      } }, before);
      m.addLayer({ id: "places", type: "symbol", source: "places", layout: {
        "icon-image": ["get", "icon"], "icon-size": 0.8, "icon-allow-overlap": true, "icon-ignore-placement": true,
        "text-field": ["get", "name"], "text-font": ["Noto Sans Bold"], "text-size": 12, "text-offset": [0, 1.6], "text-anchor": "top", "text-optional": true,
      }, paint: { "text-color": "#14212b", "text-halo-color": "#ffffff", "text-halo-width": 2 } });
      m.addLayer({ id: "sel-ring", type: "circle", source: "selpt", paint: { "circle-radius": 22, "circle-color": "#ffffff", "circle-opacity": 0.0, "circle-stroke-width": 3.5, "circle-stroke-color": "#0f766e" } }, before);
      const HITS = ["places", "inc-icon", "riv-icon", "rain-icon", "inc", "riv", "rain"];
      for (const l of HITS) {
        m.on("mouseenter", l, () => (m.getCanvas().style.cursor = "pointer"));
        m.on("mouseleave", l, () => (m.getCanvas().style.cursor = ""));
      }
      ready.current = true;
      sync();
      if (props.current.focus) fit(props.current.focus); // a shared link may set the focus before the basemap finished loading
    });

    m.on("click", (e) => {
      if (!ready.current) return; // layers are added on "load"; ignore taps before then
      const layers = ["places", "inc-icon", "riv-icon", "rain-icon", "inc", "riv", "rain"].filter((l) => m.getLayer(l));
      const hit = m.queryRenderedFeatures([[e.point.x - 8, e.point.y - 8], [e.point.x + 8, e.point.y + 8]], { layers })[0];
      if (hit) {
        const id = String(hit.properties?.id);
        const lid = hit.layer.id;
        if (lid === "places") { props.current.onPlaceClick(id); return; }
        props.current.onSelect({ kind: lid.startsWith("riv") ? "station" : lid.startsWith("rain") ? "rain" : "incident", id });
      } else props.current.onMapClick(e.lngLat.lat, e.lngLat.lng);
    });
    }
  }, []);

  useEffect(sync, [p.incidents, p.stations, p.pin, p.radiusKm, p.now, p.places]);

  // short pulse on the checked area so the eye lands on it
  const raf = useRef(0);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current || !p.pin) return;
    cancelAnimationFrame(raf.current);
    const t0 = performance.now(), dur = 1400;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur), e = (1 - k) * (1 - k);
      if (m.getLayer("radius-fill")) { m.setPaintProperty("radius-fill", "fill-opacity", 0.1 + 0.3 * e); m.setPaintProperty("radius-line", "line-width", 2.5 + 5 * e); }
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [p.pin?.lat, p.pin?.lon, p.radiusKm]);

  const fit = (focus: Focus) => {
    const m = map.current; if (!m) return;
    const mobile = window.innerWidth < 900;
    m.fitBounds(focus.bbox, { padding: focus.wide ? { top: mobile ? 250 : 210, bottom: mobile ? 230 : 110, left: 20, right: 20 } : { top: mobile ? 130 : 70, bottom: mobile ? 250 : 50, left: 40, right: 40 }, maxZoom: 14, duration: 900 });
  };
  useEffect(() => { if (ready.current && p.focus) fit(p.focus); }, [p.focus?.nonce]);

  // selected item: ring on the map + close-range view; the details open in the side drawer (Detail)
  useEffect(() => {
    const m = map.current;
    (m?.getSource("selpt") as maplibregl.GeoJSONSource | undefined)?.setData(fc([]));
    if (!m || !p.selected) return;
    const at = p.selected.kind === "incident" ? p.incidents.find((x) => x.id === p.selected!.id)
      : p.selected.kind === "rain" ? p.rain.find((x) => x.id === p.selected!.id)
      : p.stations.find((x) => x.id === p.selected!.id);
    if (!at) return;
    (m.getSource("selpt") as maplibregl.GeoJSONSource | undefined)?.setData(fc([pt(at.lon, at.lat, {})]));
    const mobile = window.innerWidth < 900;
    // keep the point clear of the drawer: on the right on desktop, at the bottom on phones
    m.easeTo({ center: [at.lon, at.lat], zoom: p.selected.kind === "incident" ? 14.5 : 13, duration: 900,
      padding: { top: mobile ? 130 : 60, bottom: mobile ? 340 : 40, left: 20, right: mobile ? 20 : 390 } });
  }, [p.selected]);

  return <div ref={box} className="map" role="region" aria-label="Map of reported floods, landslides and river stations in Nepal" />;
}
