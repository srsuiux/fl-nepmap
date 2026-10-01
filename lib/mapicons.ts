import { ICON_PATHS, type IconName } from "./icons";
import { HAZARD_COLOR, LEVEL_COLOR, RAIN_ZERO, STATUS_COLOR } from "./theme";
import { RAIN_STOPS } from "./rain";
import type { StyleImageInterface } from "maplibre-gl";

// Paint a round badge with a white icon; returns raw pixels MapLibre can use as a marker image.
function badge(name: IconName, color: string, size = 56) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const x = c.getContext("2d")!;
  x.shadowColor = "rgba(0,0,0,.35)"; x.shadowBlur = 4; x.shadowOffsetY = 1.5;
  x.beginPath(); x.arc(size / 2, size / 2, size / 2 - 5, 0, Math.PI * 2); x.fillStyle = color; x.fill();
  x.shadowColor = "transparent"; x.lineWidth = 3.5; x.strokeStyle = "#fff"; x.stroke();
  const s = (size * 0.54) / 24;
  x.translate(size / 2 - 12 * s, size / 2 - 12 * s); x.scale(s, s);
  x.strokeStyle = "#fff"; x.lineWidth = 2.3; x.lineCap = "round"; x.lineJoin = "round";
  for (const d of ICON_PATHS[name]) x.stroke(new Path2D(d));
  return x.getImageData(0, 0, size, size);
}

type Adder = { addImage: (id: string, img: ImageData, o?: { pixelRatio?: number }) => void; hasImage: (id: string) => boolean };

export function registerMapIcons(m: Adder) {
  const add = (id: string, name: IconName, color: string) => { if (!m.hasImage(id)) m.addImage(id, badge(name, color), { pixelRatio: 2 }); };
  add("inc-flood", "flood", HAZARD_COLOR.flood);
  add("inc-landslide", "landslide", HAZARD_COLOR.landslide);
  for (const [k, c] of Object.entries(STATUS_COLOR)) add(`riv-${k}`, "river", c);
  for (const [k, c] of Object.entries(LEVEL_COLOR)) add(`place-${k}`, "home", c);
  add("place-unknown", "home", "#8a949e");
  add("rain-0", "rain", RAIN_ZERO);
  RAIN_STOPS.forEach(([, c], i) => add(`rain-${i + 1}`, "rain", c));
}
export type { StyleImageInterface };
