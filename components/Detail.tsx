"use client";
import { useEffect } from "react";
import { ago, incidentName, incidentTime, stamp } from "@/lib/format";
import { t, tn } from "@/lib/i18n";
import { haversineKm } from "@/lib/geo";
import { rainAt, rainColorFor, rainLabel, rainNear } from "@/lib/rain";
import { pageUrl, recordUrl, type RecordKind } from "@/lib/sources";
import { HAZARD_COLOR, SOURCE, STATUS_COLOR } from "@/lib/theme";
import { Badge, Icon } from "./Icon";
import type { OIncident, ORain, OStation, RainWindow, Sel } from "./types";

const NEAR_KM = 10;
const SUB: Record<string, string> = { inundation: "Inundation", glacial_lake_outburst: "Glacial lake outburst" };
const STATUS_LABEL = {
  get normal() { return t("Normal"); }, get warning() { return t("Warning"); }, get danger() { return t("Danger"); }, get unavailable() { return t("Status unavailable"); },
} as const;

type Props = {
  sel: Sel; incidents: OIncident[]; stations: OStation[]; rain: ORain[]; rainWindow: RainWindow; days: number; now: number;
  onSelect: (s: Sel) => void; onClose: () => void; onCheck: (lat: number, lon: number) => void;
};

function Source({ kind, id }: { kind: RecordKind; id: string }) {
  return (
    <p className="dsrc">
      {t("Source")}: {SOURCE.name} · {t("ID")} {id}<br />
      <a href={pageUrl(kind)} target="_blank" rel="noopener noreferrer">{t("BIPAD page")}</a> · <a href={recordUrl(kind, id)} target="_blank" rel="noopener noreferrer">{t("Official record (JSON)")}</a>
    </p>
  );
}

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="drow"><span>{k}</span><b>{v}</b></div>;

export default function Detail({ sel, incidents, stations, rain, rainWindow, days, now, onSelect, onClose, onCheck }: Props) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const inc = sel.kind === "incident" ? incidents.find((x) => x.id === sel.id) : undefined;
  const st = sel.kind === "station" ? stations.find((x) => x.id === sel.id) : undefined;
  const rn = sel.kind === "rain" ? rain.find((x) => x.id === sel.id) : undefined;
  const at = inc ?? st ?? rn;
  if (!at) return null;
  const { lat, lon } = at;

  const dist = <T extends { lat: number; lon: number }>(xs: T[]) =>
    xs.map((x) => ({ x, km: haversineKm(lat, lon, x.lat, x.lon) })).filter((o) => o.km <= NEAR_KM).sort((a, b) => a.km - b.km);
  const nearInc = dist(incidents.filter((i) => !(inc && i.id === inc.id)));
  const nearRiv = dist(stations.filter((s) => !(st && s.id === st.id)));
  const nearRain = rainNear(lat, lon, NEAR_KM, rain.filter((r) => !(rn && r.id === rn.id)), rainWindow).filter((r) => r.mm > 0).sort((a, b) => b.mm - a.mm);

  const head = inc
    ? { icon: <Badge name={inc.hazard} color={HAZARD_COLOR[inc.hazard]} size={34} />, title: `${t(inc.hazard === "flood" ? "Flood" : "Landslide")}${inc.subtype ? ` · ${t(SUB[inc.subtype] ?? inc.subtype)}` : ""}`, sub: incidentName(inc) }
    : st
      ? { icon: <Badge name="river" color={STATUS_COLOR[st.status]} size={34} />, title: st.name, sub: t("River station") }
      : { icon: <Badge name="rain" color={rainColorFor(rainAt(rn!, rainWindow) ?? 0)} size={34} />, title: rainLabel(rn!.name).name, sub: rainLabel(rn!.name).kind ? t(rainLabel(rn!.name).kind!) : t("Rain station") };
  const kind: RecordKind = inc ? "incident" : st ? "river" : "rain";
  const id = (inc ?? st ?? rn)!.id;

  return (
    <aside className="detail" aria-label={t("Selected item details")}>
      <header className="dhead">
        {head.icon}
        <div className="dtitle"><h2>{head.title}</h2><small>{head.sub}</small>{inc?.title_ne && incidentName(inc) !== inc.title_ne && <small lang="ne">{inc.title_ne}</small>}</div>
        <button className="icon x" onClick={onClose} aria-label={t("Close details")} title={t("Close (Esc)")}><Icon name="close" size={20} strokeWidth={2.2} /></button>
      </header>

      <div className="dbody">
        {inc && (
          <section className="dcard">
            <Row k={t("Happened")} v={incidentTime(inc.occurred_at)} />
            {inc.reported_at && <Row k={t("Reported")} v={<>{stamp(inc.reported_at)} <small>({ago(inc.reported_at, now)})</small></>} />}
            {inc.verified != null && <Row k={t("BIPAD review")} v={inc.verified ? t("Verified") : t("Not marked verified")} />}
            <p className="dnote">{t("Location is approximate. BIPAD places most reports at ward or municipality level.")}</p>
          </section>
        )}
        {st && (
          <section className="dcard">
            <Row k={t("Status")} v={<span className={`pill st-${st.status}`}>{STATUS_LABEL[st.status]}</span>} />
            <Row k={t("Last reading")} v={st.observed_at ? <>{stamp(st.observed_at)} <small>({ago(st.observed_at, now)})</small></> : t("None")} />
            {st.status !== "unavailable" && st.water_level != null && <>
              <Row k={t("Water level")} v={`${st.water_level.toFixed(2)} m`} />
              <Row k={t("Warning level")} v={`${st.warning_level} m`} />
              <Row k={t("Danger level")} v={`${st.danger_level} m`} />
            </>}
            {st.basin && <Row k={t("Basin")} v={st.basin} />}
            {st.status === "unavailable" && <p className="dnote">{t("No current reading, or no warning and danger levels, so a status can't be shown.")}</p>}
          </section>
        )}
        {rn && (
          <section className="dcard">
            <div className="rainvals big">
              {([["1 h", rn.r1], ["3 h", rn.r3], ["6 h", rn.r6], ["12 h", rn.r12], ["24 h", rn.r24]] as const).map(([l, v]) => <span key={l}><b>{v ?? "–"}</b>{t(l)}</span>)}<em>mm</em>
            </div>
            <Row k={t("Last reading")} v={<>{stamp(rn.observed_at)} <small>({ago(rn.observed_at, now)})</small></>} />
            {rn.basin && <Row k={t("Basin")} v={rn.basin} />}
          </section>
        )}
        <div className="dacts">
          <button className="chipbtn primary" onClick={() => onCheck(lat, lon)}><Icon name="locate" size={15} />{t("Check this area")}</button>
          <span className="coords">{lat.toFixed(4)}, {lon.toFixed(4)}</span>
        </div>
        <Source kind={kind} id={id} />

        <h3>{t("Incidents within {k} km", { k: NEAR_KM })} <span className="count">{nearInc.length}</span></h3>
        {nearInc.length === 0 ? <p className="muted">{t("No other reported incidents within {k} km in the last {d}.", { k: NEAR_KM, d: days === 1 ? t("24 hours") : t("{n} days", { n: days }) })}</p> : (
          <ul className="nlist">
            {nearInc.slice(0, 8).map(({ x, km }) => (
              <li key={x.id}><button onClick={() => onSelect({ kind: "incident", id: x.id })}>
                <Badge name={x.hazard} color={HAZARD_COLOR[x.hazard]} size={24} />
                <span><b>{t(x.hazard === "flood" ? "Flood" : "Landslide")}</b><em>{incidentName(x)}</em><small>{incidentTime(x.occurred_at)}</small></span>
                <i>{km.toFixed(1)} km</i>
              </button></li>
            ))}
          </ul>
        )}
        {nearInc.length > 8 && <p className="muted">{t("Showing the nearest 8 of {n}.", { n: nearInc.length })}</p>}

        {nearRiv.length > 0 && <>
          <h3>{t("River stations within {k} km", { k: NEAR_KM })} <span className="count">{nearRiv.length}</span></h3>
          <ul className="nlist">
            {nearRiv.slice(0, 5).map(({ x, km }) => (
              <li key={x.id}><button onClick={() => onSelect({ kind: "station", id: x.id })}>
                <Badge name="river" color={STATUS_COLOR[x.status]} size={24} />
                <span><b>{x.name}</b><small>{STATUS_LABEL[x.status]}</small></span><i>{km.toFixed(1)} km</i>
              </button></li>
            ))}
          </ul>
        </>}

        <h3>{t("Rain within {k} km · last {w} h", { k: NEAR_KM, w: rainWindow })} <span className="count">{nearRain.length}</span></h3>
        {nearRain.length === 0 ? <p className="muted">{t("No rain recorded in the last {w} h at nearby stations.", { w: rainWindow })}</p> : (
          <ul className="nlist">
            {nearRain.slice(0, 5).map((r) => (
              <li key={r.id}><button onClick={() => onSelect({ kind: "rain", id: r.id })}>
                <Badge name="rain" color={rainColorFor(r.mm)} size={24} />
                <span><b>{rainLabel(r.name).name}</b><small>{+r.mm.toFixed(1)} mm</small></span><i>{r.km.toFixed(1)} km</i>
              </button></li>
            ))}
          </ul>
        )}
        <p className="disc">{t("Official reports only, possibly delayed or incomplete. Follow local authorities and call the emergency numbers above if you are in danger.")}</p>
      </div>
    </aside>
  );
}
