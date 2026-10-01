// Clean vector basemap (OpenFreeMap "positron", OpenStreetMap data) restyled so rivers, residential areas,
// buildings and roads read clearly. Falls back to plain OSM raster tiles if the style can't be fetched.
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

type Layer = { id: string; type: string; paint?: Record<string, unknown>; filter?: unknown; minzoom?: number; [k: string]: unknown };
type Style = { layers: Layer[]; [k: string]: unknown };

export const RASTER_FALLBACK = {
  version: 8 as const,
  sources: { osm: { type: "raster" as const, tileSize: 256, maxzoom: 17, tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], attribution: "© OpenStreetMap contributors" } },
  layers: [{ id: "osm", type: "raster" as const, source: "osm", paint: { "raster-saturation": -0.35 } }],
};

const riverWidth = (river: number, stream: number) => [
  "interpolate", ["exponential", 1.4], ["zoom"],
  6, ["match", ["get", "class"], "river", river * 0.5, 0.3],
  10, ["match", ["get", "class"], "river", river, stream * 0.6],
  14, ["match", ["get", "class"], "river", river * 3, stream * 2],
  18, ["match", ["get", "class"], "river", river * 8, stream * 5],
];

export function patchStyle(style: Style): Style {
  const by = new Map(style.layers.map((l) => [l.id, l]));
  const paint = (id: string, p: Record<string, unknown>) => { const l = by.get(id); if (l) l.paint = { ...l.paint, ...p }; };

  paint("background", { "background-color": "#f4f1ea" });
  paint("park", { "fill-color": "#dfe8d3" });
  paint("landcover_wood", { "fill-color": "#d5e2c6", "fill-opacity": 0.7 });
  paint("landuse_residential", { "fill-color": "#ebdfca", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0.9, 15, 0.9] });
  // water bodies and rivers: the main thing the app is about
  paint("water", { "fill-color": "#a6cff2" });
  paint("waterway", { "line-color": "#3d93e0", "line-width": riverWidth(1.4, 0.9), "line-opacity": 0.95 });
  paint("waterway_line_label", { "text-color": "#2a6fb5", "text-halo-color": "rgba(255,255,255,0.85)" });
  paint("water_name_point_label", { "text-color": "#2a6fb5" });
  paint("water_name_line_label", { "text-color": "#2a6fb5" });
  // buildings as visible blocks
  const b = by.get("building");
  if (b) { b.minzoom = 12; b.paint = { ...b.paint, "fill-color": "#dccfbb", "fill-outline-color": "#bfae95", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 15, 1] }; }
  // roads with casings so they stand apart from blocks
  paint("highway_path", { "line-color": "#c9bda9", "line-dasharray": [2, 1.5] });
  paint("highway_minor", { "line-color": "#ffffff", "line-opacity": 1, "line-width": ["interpolate", ["exponential", 1.55], ["zoom"], 12, 1, 14, 2.2, 20, 22] });
  paint("highway_major_casing", { "line-color": "#d9ad6f" });
  paint("highway_major_inner", { "line-color": "#fff4d6" });
  paint("highway_motorway_casing", { "line-color": "#d9ad6f" });
  paint("highway_motorway_inner", { "line-color": "#ffd37f" });
  const minor = by.get("highway_minor");
  if (minor) {
    const casing = { ...minor, id: "highway_minor_casing", minzoom: 12, paint: { "line-color": "#dcd4c6", "line-width": ["interpolate", ["exponential", 1.55], ["zoom"], 12, 2, 14, 3.8, 20, 26] } };
    style.layers.splice(style.layers.indexOf(minor), 0, casing);
  }
  return style;
}

// id of the first label layer: our data layers go just under the labels so place names stay readable
export const firstLabelId = (style: Style) => style.layers.find((l) => l.type === "symbol")?.id;

export async function loadBasemap() {
  try {
    const res = await fetch(STYLE_URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(String(res.status));
    const style = patchStyle((await res.json()) as Style);
    return { style, before: firstLabelId(style) };
  } catch {
    return { style: RASTER_FALLBACK as unknown as Style, before: undefined as string | undefined };
  }
}
