# SOURCES.md — Phase 0 findings

Checked 2026-10-01 with plain `curl`. Samples are in `/samples`.

## Summary

| Source | Verdict |
|---|---|
| BIPAD incidents | **Works.** Public, no auth, has coordinates, Nepali titles, updated same day. |
| BIPAD river stations | **Works, with caveats.** Public, no auth, mirrors DHM data. 43% of stations lack thresholds. |
| DHM (hydrology.gov.np) | **Not needed directly.** It is a JS single-page app with no documented API. BIPAD already relays DHM data. |
| GDACS | **Works, low value.** Regional alerts only (about 3 Nepal events in 2.5 years). Optional. |
| Admin boundaries | **Use BIPAD's own lists** (7 provinces, 77 districts, 774 municipalities, with centroids, English and Nepali names). HDX COD-AB is a fallback. |

## BIPAD Portal (NDRRMA) — `https://bipadportal.gov.np/api/v1`

- **Auth:** none. **Format:** Django REST JSON.
- **Rate limits / terms:** none published. No robots.txt (returns the SPA page). `/terms` returned 200 but I have not read it. **Open question: confirm terms of use and consider contacting NDRRMA before launch.**
- **Server cache header:** `max-age=0`.

### Incidents — `GET /incident/`
- Filters that work: `hazard=11,17` (comma list), `incident_on__gt=<ISO>`, `ordering=-incident_on`, `limit`, `offset`.
- Hazard IDs: **Flood = 11**, **Landslide = 17**. Related, to decide on: Inundation 28, Soil Erosion 29, Heavy Rainfall 14, Glacial lake outburst 26. The full list is in `bipad_hazard.json`.
- Fields: `id`, `title`, `titleNe`, `point` (GeoJSON, `[lon, lat]`), `incidentOn`, `reportedOn`, `createdOn`, `modifiedOn`, `hazard`, `verified`, `approved`, `wards`, `dataSource`, `loss`, `description` (usually null), `streetAddress`.
- Freshness: the newest record was created 2026-10-01 10:01 NPT, the same day as the check. The last 7 days of floods and landslides gave ≥200 records (134 landslides and 66 floods in the first 200).
- **Gotchas:**
  - `count` is a bogus value (9223372036854775807). **Paginate by following `next`**, never by `count`.
  - `incidentOn` is often midnight (`T00:00:00`), so it holds a date, not a real time. Show `reportedOn` as well and don't present the incident time as precise.
  - There is no per-incident URL in the response. The `source_url` would have to be a link to the portal (e.g. `https://bipadportal.gov.np/incident/`), and I have not verified a deep link. This matters for the "every item shows a source link" rule.
  - Records are tied to wards and municipality centroids rather than exact sites. Coordinates may be approximate, so label them that way.
  - Titles are generated ("Landslide at Raghuganga Rural Municipality-8"). `verified` and `approved` are both present. Filter on `approved=true` (needs a decision).

### River stations — `GET /river-stations/?limit=500`
- 284 stations in a single request. Fields: `id`, `title`, `basin`, `point`, `waterLevel`, `warningLevel`, `dangerLevel`, `waterLevelOn`, `status`, `steady`, `image`, `dataSource` ("hydrology.gov.np"), `stationSeriesId`, and admin IDs.
- Status values seen: `BELOW WARNING LEVEL` (268), `ABOVE WARNING LEVEL` (9), `ABOVE DANGER LEVEL` (7). The portal has no separate "normal" value. The mapping to normal / warning / danger is straightforward.
- **Gotchas:**
  - 122 of 284 stations have a null `warningLevel` or `dangerLevel`. For those, `status` should be treated as unknown, not "normal".
  - 71 stations have a last observation before 2026-09-01 and 5 have none. Stale stations must be shown with their `waterLevelOn` time, or hidden. They must never read as "normal".
  - There is no `river` field, only `title` ("Pasaha Khola at Maheshpur") and `basin`. The data model's `river` column would need parsing or dropping.
  - It is not confirmed whether the API's `status` is computed by BIPAD or taken from DHM. Recomputing from the thresholds is safer.

### Admin lists — `/province/`, `/district/`, `/municipality/?limit=1000`
- Counts: 7, 77, 774. The municipality response gives `title_en`, `title_ne`, `centroid`, `bbox`, `type` and a `district` ID. This is enough to build `locations` with bilingual search.
- The same `?limit=1000` pagination caveat applies (`next` is non-null but harmless).

## DHM Nepal — `https://hydrology.gov.np`
- The home page is a React SPA that loads Google Maps. There is no documented public API, `robots.txt` returns 404, and the data origin is `daq.hydrology.gov.np` (the same host as the BIPAD station `image` URLs).
- Scraping DHM directly is **not recommended** for v1, because BIPAD relays the same stations. If DHM thresholds ever need to be verified independently, that is a separate task.

## GDACS — `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH`
- Auth: none. Format: GeoJSON FeatureCollection.
- Working query: `?eventlist=FL&country=Nepal&fromdate=YYYY-MM-DD&todate=YYYY-MM-DD`. A `country=NPL` query returned 204 (no content).
- It returned 3 Nepal flood events since 2024-01-01 (Red 2026-08-26, Orange 2025-10-03, Orange 2024-09-26). Only country-level point locations. Each event has a `report` URL, which fits the source-link rule.
- It is too coarse for a "near me, 25 km" view. I suggest leaving it out of v1 or showing it as a single banner. **Decision needed.**
- The RSS feed (`/xml/rss.xml`) is global, with no Nepal items at the moment.

## Admin boundaries — HDX (fallback only)
- `cod-ab-npl`: SHP / GeoJSON / GDB / XLSX downloads, CC BY-IGO, covering 2024-03 to 2025-10. Only needed if polygons are wanted. I did not download it.

## Decisions for you before Phase 1
1. **Hazard scope:** only Flood (11) and Landslide (17), or also Inundation (28), Soil Erosion (29), Heavy Rainfall (14), Glacial lake outburst (26)?
2. **Source link per incident:** BIPAD has no per-incident URL. Is a link to the BIPAD portal's incident page acceptable, or should I look for a deep-link pattern?
3. **GDACS:** skip in v1, or include it as a banner?
4. **River stations without thresholds / stale readings:** show as "status unavailable" with the timestamp, or hide them? (I recommend "status unavailable".)
5. **Terms of use:** please confirm BIPAD's terms allow our 10–15 minute polling and redistribution, and the emergency numbers (100 and 1149), which I have not verified.
6. **Environment for Phase 1:** is Postgres + PostGIS available locally (or Docker)? `which psql docker` was not checked. Also, nothing is installed yet, so I need your go-ahead to add Next.js and the other dependencies.


## Added later

- **BIPAD rain stations** `/api/v1/rain-stations/` (official): 664 stations, 1/3/6/12/24 h totals. About 370 have a reading in the last 3 hours. Impossible values (e.g. 858,993,472 mm) are flagged invalid by the worker and hidden.
- **BIPAD per-record URLs** `/api/v1/{incident|river-stations|rain-stations}/{id}/` return each item as JSON. BIPAD's human pages are `/incidents/` and `/realtime/` (there is no per-incident page).
- **Open-Meteo forecast** (NOT official): daily rain totals and chance for 4 days, no key, cached 1 h on our server. Free tier is for non-commercial use; check terms before any commercial launch.
- **News RSS** (NOT official): Online Khabar, Rising Nepal, Nepalnews feeds; we keep title, outlet, date and link only. Check each outlet's terms before launch.
- **Nepal border**: Survey Department of Nepal via HDX COD-AB (CC BY-IGO), simplified into `public/geo/nepal.json`.
