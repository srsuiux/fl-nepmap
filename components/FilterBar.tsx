"use client";
import { RAIN_WINDOWS } from "@/lib/rain";
import { Icon } from "./Icon";
import { t } from "@/lib/i18n";
import type { Filters } from "./types";

const DAYS = () => [{ v: 1, l: t("24 h") }, { v: 3, l: t("3 days") }, { v: 7, l: t("7 days") }, { v: 14, l: t("14 days") }];
const RADII = [5, 10, 25, 50];

function Seg<T extends number>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.v} aria-pressed={value === o.v} onClick={() => onChange(o.v)}>{o.l}</button>
      ))}
    </div>
  );
}

export default function FilterBar({ f, set, hasPin, changed, onReset }: { f: Filters; set: (p: Partial<Filters>) => void; hasPin: boolean; changed: boolean; onReset: () => void }) {
  return (
    <div className="filters" role="toolbar" aria-label={t("Map filters")}>
      <div className="fcard fshow">
        <div className="fset">
          <span className="flabel lead">{t("Show")}</span>
          <div className="fbody">
            <button className="tog flood" aria-pressed={f.flood} onClick={() => set({ flood: !f.flood })}><span className="ti"><Icon name="flood" size={14} strokeWidth={2.3} /></span>{t("Floods")}</button>
            <button className="tog landslide" aria-pressed={f.landslide} onClick={() => set({ landslide: !f.landslide })}><span className="ti"><Icon name="landslide" size={14} strokeWidth={2.3} /></span>{t("Landslides")}</button>
            <button className="tog rain" aria-pressed={f.rain} onClick={() => set({ rain: !f.rain })}><span className="ti"><Icon name="rain" size={14} strokeWidth={2.3} /></span>{t("Rain")}</button>
            <button className="tog rivers" aria-pressed={f.rivers} onClick={() => set({ rivers: !f.rivers })}><span className="ti"><Icon name="river" size={14} strokeWidth={2.3} /></span>{t("Rivers")}</button>
          </div>
        </div>
        <button className="reset" onClick={onReset} disabled={!changed} title={t("Select every layer again and restore 7 days, 25 km and 3 h rain")}>
          <Icon name="reset" size={16} strokeWidth={2.2} />{t("Reset")}
        </button>
      </div>
      <div className="fcard fperiod">
        <div className="fset">
          <span className="flabel lead">{t("Period")}</span>
          <div className="fbody"><Seg label={t("Time window")} value={f.days} options={DAYS()} onChange={(days) => set({ days })} /></div>
        </div>
        {f.rain && (
          <div className="fset">
            <span className="flabel">{t("Rain over")}</span>
            <div className="fbody"><Seg label={t("Rain accumulated over")} value={f.rainWindow} options={RAIN_WINDOWS.map((w) => ({ v: w.v, l: t(w.l) }))} onChange={(rainWindow) => set({ rainWindow })} /></div>
          </div>
        )}
      </div>
      {hasPin && (
        <div className="fcard fradius">
          <div className="fset">
            <span className="flabel lead">{t("Radius")}</span>
            <div className="fbody"><Seg label={t("Radius")} value={f.radius} options={RADII.map((v) => ({ v, l: t("{n} km", { n: v }) }))} onChange={(radius) => set({ radius })} /></div>
          </div>
        </div>
      )}
    </div>
  );
}
