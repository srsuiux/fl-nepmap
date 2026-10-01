export type Hazard = "flood" | "landslide";
export type StationStatus = "normal" | "warning" | "danger" | "unavailable";

export type OIncident = {
  id: string; hazard: Hazard; subtype: string | null; title: string; place: string | null;
  occurred_at: string; reported_at: string | null; lat: number; lon: number;
  title_ne?: string | null; verified?: boolean | null;
};
export type OStation = {
  id: string; name: string; basin: string | null; water_level: number | null; warning_level: number | null;
  danger_level: number | null; status: StationStatus; observed_at: string | null; lat: number; lon: number;
};
export type ORain = {
  id: string; name: string; basin: string | null; r1: number | null; r3: number | null; r6: number | null; r12: number | null; r24: number | null;
  observed_at: string; lat: number; lon: number;
};
export type RainWindow = 1 | 3 | 6 | 24;
export type Overview = {
  updated: string | null; incidents: OIncident[]; stations: OStation[]; rain: ORain[];
  rain_meta: { total: number; live: number; invalid: number };
};

export type Pin = { lat: number; lon: number };
export type Sel = { kind: "incident" | "station" | "rain"; id: string };
export type Focus = { bbox: [number, number, number, number]; nonce: number; wide?: boolean }; // wide: whole-country view, needs room for the top controls
export type Filters = { flood: boolean; landslide: boolean; rivers: boolean; days: number; radius: number; rain: boolean; rainWindow: RainWindow };
