# Nepal Flood & Landslide Watch — MVP

Working name. A mobile-first map that shows flood and landslide incidents and river warnings near a chosen location in Nepal, using official data only.

## Who it's for

- People in Nepal checking their own area, often on a cheap phone with weak signal.
- Nepalis abroad checking their family's area.

## Goal of the MVP

Pick a location → see the nearest official flood/landslide reports and river warnings on a map and a list, with source and "last updated" time on everything.

## Features (v1)

1. **Pick a location**: GPS, search, or province → district → municipality dropdown.
2. **Nearby list + map**: incidents within a radius (default 25 km, last 7 days), nearest first. River stations nearby with status: normal / warning / danger.
3. **Every item shows**: hazard type, place, distance, time, source name, source link.
4. **Watch places**: save up to 5 locations on the device (no login). Shareable link per location.
5. **Language**: Nepali and English UI.
6. **Safety basics**: emergency numbers always visible (Police 100, Ambulance 102, Disaster hotline 1234, which replaced 1149 in July 2026), disclaimer in footer. Never say "safe". Empty state says "No reported incidents nearby."
7. **Weak network**: small page, show last loaded data with its timestamp if offline.

## Not in v1

AI extraction, push/SMS alerts, road closures, user accounts, citizen reports.

## Added after v1 planning (decided with the project owner)

- **My places:** up to 5 saved places on the device, status refreshed with every data refresh.
- **Installable and offline:** service worker keeps the app, last data and viewed map tiles.
- **Nepali interface** (needs native-speaker review before launch).
- **Non-official extras, always labelled and kept apart from official reports:** a model rain forecast (Open-Meteo) and news headlines (public RSS feeds of Nepali outlets). They never feed the activity level. This is a deliberate, owner-approved exception to "official data only".
- Still undecided: push alerts (need a server component and would store locations) and a "what to do" guidance panel (needs official wording).

## Data sources (must verify in Phase 0)

| Source | What we want | Status |
|---|---|---|
| BIPAD Portal (NDRRMA) | Flood and landslide incidents with coordinates | Unverified |
| DHM Nepal (hydrology.gov.np) | River station levels, warning/danger thresholds | Unverified |
| GDACS | International flood alerts for Nepal | Unverified |
| Nepal admin boundaries (e.g. HDX) | Province/district/municipality list + centroids | Unverified |

For each: endpoint, auth needed?, update frequency, fields, rate limits, terms of use.

## Architecture

```
[Worker, every 10–15 min] → fetch sources → normalize → Postgres + PostGIS
[Next.js app] → reads only from our DB → map + list
```

Users never hit government sites directly. If a fetch fails, keep old data and record the failure.

**Stack**: Next.js (App Router, TypeScript), MapLibre GL + OpenStreetMap tiles, Postgres + PostGIS, a scheduled worker (Node). Hosting decided later.

## Data model

**incidents**: id, source, source_id (unique per source), hazard_type (flood | landslide), title, place_name, geom (point), occurred_at, fetched_at, source_url, raw (jsonb)

**river_stations**: id, source, source_id, name, river, geom, water_level, warning_level, danger_level, status, observed_at, fetched_at

**locations**: id, province, district, municipality, name_en, name_ne, geom (centroid)

**fetch_runs**: id, source, started_at, finished_at, ok, items_count, error

## API

- `GET /api/nearby?lat=&lon=&radius_km=25&days=7` → incidents + river stations, sorted by distance
- `GET /api/locations?q=` → municipality search (English + Nepali)
- `GET /api/status` → last successful fetch time per source

## Build phases

**Phase 0 — Source check.** Write small scripts that call each source and save sample responses to `/samples`. Write `SOURCES.md` with findings. **Stop and report before Phase 1.**

**Phase 1 — Ingestion.** DB schema, worker that fetches, normalizes, and upserts. Logs to `fetch_runs`.
Done when: running the worker twice gives no duplicates.

**Phase 2 — API.** `/nearby`, `/locations`, `/status` with PostGIS distance queries.
Done when: a known Kathmandu point returns correct nearest items.

**Phase 3 — UI.** Location picker, map, list, source/timestamp on each item, emergency bar.
Done when: usable on a 360px-wide screen with throttled 3G.

**Phase 4 — Polish.** Watch places, share links, Nepali UI, offline fallback.

## Rules for Claude Code

- Official data only. Never invent, guess, or fill in incident data.
- Every displayed item must keep its source link and timestamp.
- Ask before adding a dependency or changing the stack.
- Finish one phase, report, wait for a go-ahead before the next.