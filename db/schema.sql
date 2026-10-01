create extension if not exists postgis;

create table if not exists incidents (
  id            bigserial primary key,
  source        text not null,
  source_id     text not null,
  hazard_type   text not null check (hazard_type in ('flood','landslide')),
  subtype       text,                       -- e.g. 'inundation', 'glacial_lake_outburst'; null = plain flood/landslide
  title         text not null,
  title_ne      text,
  place_name    text,
  geom          geography(Point,4326) not null,
  occurred_at   timestamptz not null,       -- BIPAD often gives date only (midnight NPT)
  reported_at   timestamptz,
  verified      boolean,
  fetched_at    timestamptz not null default now(),
  source_url    text,                       -- null when the source has no real per-item link
  raw           jsonb not null,
  unique (source, source_id)
);
create index if not exists incidents_geom_idx on incidents using gist (geom);
create index if not exists incidents_occurred_idx on incidents (occurred_at desc);

create table if not exists river_stations (
  id            bigserial primary key,
  source        text not null,
  source_id     text not null,
  name          text not null,
  river         text,                       -- BIPAD has no river field; left null
  basin         text,
  geom          geography(Point,4326) not null,
  water_level   double precision,
  warning_level double precision,
  danger_level  double precision,
  status        text not null check (status in ('normal','warning','danger','unavailable')),
  observed_at   timestamptz,
  fetched_at    timestamptz not null default now(),
  source_url    text,
  raw           jsonb not null,
  unique (source, source_id)
);
create index if not exists river_stations_geom_idx on river_stations using gist (geom);

create table if not exists locations (
  id            bigserial primary key,
  source_id     text not null unique,       -- BIPAD municipality id
  province      text not null,
  province_ne   text,
  district      text not null,
  district_ne   text,
  municipality  text not null,
  name_en       text not null,
  name_ne       text,
  geom          geography(Point,4326) not null
);
create index if not exists locations_geom_idx on locations using gist (geom);

create table if not exists fetch_runs (
  id            bigserial primary key,
  source        text not null,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  ok            boolean,
  items_count   integer,
  error         text
);
create index if not exists fetch_runs_source_idx on fetch_runs (source, started_at desc);

-- Lock out the public PostgREST API: only server-side connections (DATABASE_URL) read these tables.
alter table incidents enable row level security;
alter table river_stations enable row level security;
alter table locations enable row level security;
alter table fetch_runs enable row level security;

create table if not exists rain_stations (
  id            bigserial primary key,
  source        text not null,
  source_id     text not null,
  name          text not null,
  basin         text,
  elevation     double precision,
  geom          geography(Point,4326) not null,
  rain_1h       double precision,   -- accumulated mm over the last 1/3/6/12/24 hours, as reported
  rain_3h       double precision,
  rain_6h       double precision,
  rain_12h      double precision,
  rain_24h      double precision,
  valid         boolean not null,   -- false when the reading is physically impossible (sensor error)
  observed_at   timestamptz,
  fetched_at    timestamptz not null default now(),
  source_url    text,
  raw           jsonb not null,
  unique (source, source_id)
);
create index if not exists rain_stations_geom_idx on rain_stations using gist (geom);
alter table rain_stations enable row level security;
