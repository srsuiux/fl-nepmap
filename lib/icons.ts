// One small stroke-icon set (24x24 grid), drawn for this app. The same path data feeds the React icons
// and the icons painted onto map markers, so the legend, list and map always match.
export type IconName =
  | "flood" | "landslide" | "rain" | "river" | "locate" | "menu" | "close" | "share" | "refresh" | "reset"
  | "police" | "ambulance" | "siren" | "check" | "alert" | "home" | "sidebar" | "chevronLeft" | "chevronRight" | "expand";

const WAVE = (y: number) => `M2 ${y}c2-2 3-2 5 0s3 2 5 0 3-2 5 0 3 2 5 0`;
const dot = (x: number, y: number, r = 0.9) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

export const ICON_PATHS: Record<IconName, string[]> = {
  flood: [WAVE(9), WAVE(15), "M12 3v2.5M7 4.5l1 1.8M17 4.5l-1 1.8"],
  landslide: ["M2 21h20", "M3 19l7-11 4 6 2-3 5 8z", dot(15.5, 5.5), dot(19, 9.5, 0.8), dot(12.5, 3.2, 0.7)],
  rain: ["M7 16a4 4 0 0 1-.6-7.95 5.5 5.5 0 0 1 10.6 1.2A3.4 3.4 0 0 1 17 16", "M8 19l-.9 2.4M12.5 19l-.9 2.4M17 19l-.9 2.4"],
  river: ["M12 3s6 6.2 6 10.5a6 6 0 0 1-12 0C6 9.2 12 3 12 3z", "M8.3 14.2c1.2-1 2.2-1 3.7 0s2.5 1 3.7 0"],
  locate: [dot(12, 12, 4), "M12 2v4M12 18v4M2 12h4M18 12h4"],
  menu: ["M4 6h16M4 12h16M4 18h16"],
  close: ["M6 6l12 12M18 6L6 18"],
  share: ["M12 15V3M8 7l4-4 4 4", "M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"],
  refresh: ["M21 12a9 9 0 1 1-3-6.7M21 4v5h-5"],
  reset: ["M3 12a9 9 0 1 0 3-6.7M3 4v5h5"],
  police: ["M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z", "M9 12l2 2 4-4"],
  ambulance: ["M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z", "M12 8v8M8 12h8"],
  siren: ["M5 20h14M7 20v-5a5 5 0 0 1 10 0v5", "M12 3v2M4.5 7l1.5 1.5M19.5 7L18 8.5"],
  check: ["M5 12l5 5 9-10"],
  alert: ["M12 3L2 21h20z", "M12 10v5", "M12 18v.3"],
  home: ["M3 11l9-8 9 8", "M5 9.5V20h5v-6h4v6h5V9.5"],
  sidebar: ["M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z", "M9 5v14"],
  chevronLeft: ["M15 5l-7 7 7 7"],
  chevronRight: ["M9 5l7 7-7 7"],
  expand: ["M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"],
};
