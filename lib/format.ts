import { getLang, t } from "./i18n";

const TZ = "Asia/Kathmandu";
// Nepali month names, Latin digits (clearer next to the numbers we show everywhere else)
const MONTHS_NE = ["जनवरी", "फेब्रुअरी", "मार्च", "अप्रिल", "मे", "जुन", "जुलाई", "अगस्ट", "सेप्टेम्बर", "अक्टोबर", "नोभेम्बर", "डिसेम्बर"];
const WEEKDAYS_NE = ["आइत", "सोम", "मंगल", "बुध", "बिही", "शुक्र", "शनि"];
// Many browsers ship no Nepali date data and silently fall back to English, so Nepali dates are built by hand.
// Nepal has no daylight saving: shifting by +5:45 and reading the UTC fields gives the local date and time.
const npt = (date: Date) => new Date(date.getTime() + (5 * 60 + 45) * 60_000);
const two = (n: number) => String(n).padStart(2, "0");
const loc = () => "en-GB";
const cache = new Map<string, Intl.DateTimeFormat>();
const fmt = (key: string, o: Intl.DateTimeFormatOptions) => {
  const k = `${loc()}|${key}`;
  let f = cache.get(k);
  if (!f) { f = new Intl.DateTimeFormat(loc(), { timeZone: TZ, ...o }); cache.set(k, f); }
  return f;
};
const dtEn = () => fmt("dt", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const dEn = () => fmt("d", { day: "numeric", month: "short" });
export const dayMonth = (date: Date) => { if (getLang() !== "ne") return dEn().format(date); const n = npt(date); return `${n.getUTCDate()} ${MONTHS_NE[n.getUTCMonth()]}`; };
export const dayMonthTime = (date: Date) => { if (getLang() !== "ne") return dtEn().format(date); const n = npt(date); return `${n.getUTCDate()} ${MONTHS_NE[n.getUTCMonth()]}, ${two(n.getUTCHours())}:${two(n.getUTCMinutes())}`; };
export const weekdayDay = (date: Date) => {
  if (getLang() !== "ne") return fmt("wd", { weekday: "short", day: "numeric" }).format(date);
  const n = npt(date); return `${WEEKDAYS_NE[n.getUTCDay()]} ${n.getUTCDate()}`;
};
const hm = () => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false, hourCycle: "h23" });

// BIPAD often gives a date only (midnight Nepal time). Don't present that as a precise time.
export function incidentTime(iso: string) {
  const parts = hm().format(new Date(iso));
  return parts === "00:00" ? `${dayMonth(new Date(iso))} (${t("date only")})` : dayMonthTime(new Date(iso));
}
export const stamp = (iso: string) => `${dayMonthTime(new Date(iso))} ${t("NPT")}`;

export function ago(iso: string, now = Date.now()) {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 60) return t("{n} min ago", { n: m });
  if (m < 48 * 60) return t("{n} h ago", { n: Math.round(m / 60) });
  return t("{n} days ago", { n: Math.round(m / 1440) });
}

// Nepali title from BIPAD when the interface is in Nepali
export const incidentName = (i: { place: string | null; title: string; title_ne?: string | null }) =>
  getLang() === "ne" && i.title_ne ? i.title_ne : (i.place ?? i.title);
