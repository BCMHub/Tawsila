-- TAW-29 scope revision 2: pilot route configuration, rides and pilot events.
create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  area_label text,
  active boolean not null default true,
  sort_order int not null default 0,
  check (name = btrim(name) and char_length(name) between 1 and 60),
  check (area_label is null or (area_label = btrim(area_label) and char_length(area_label) between 1 and 60))
);
create table public.routes (
  id uuid primary key default gen_random_uuid(),
  place_a_id uuid not null references public.places(id),
  place_b_id uuid not null references public.places(id),
  duration_minutes smallint not null check (duration_minutes between 1 and 600),
  active boolean not null default true,
  sort_order int not null default 0,
  check (place_a_id <> place_b_id),
  unique (place_a_id, place_b_id)
);
alter table public.car_types add column passenger_seats smallint not null default 4
  check (passenger_seats between 1 and 8);

create table public.ride_series (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.accounts(user_id) on delete cascade,
  request_id uuid not null,
  route_id uuid not null references public.routes(id),
  direction text not null check (direction in ('a_to_b', 'b_to_a')),
  first_date date not null,
  departure_time time(0) not null,
  flex_minutes smallint not null check (flex_minutes in (0, 5, 10, 15, 30)),
  seats_offered smallint not null check (seats_offered between 1 and 8),
  pickup_note text,
  notes text,
  repeat text not null check (repeat in ('once', 'weekdays')),
  status text not null default 'active' check (status in ('active', 'cancelled')),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  published_ride_id uuid not null,
  published_ride_count smallint not null check (published_ride_count >= 1),
  unique (owner_id, request_id),
  check (departure_time < time '24:00' and extract(second from departure_time) = 0),
  check (pickup_note is null or (pickup_note = btrim(pickup_note) and char_length(pickup_note) between 1 and 80)),
  check (notes is null or (notes = btrim(notes) and char_length(notes) between 1 and 200)),
  check ((status = 'cancelled') = (cancelled_at is not null))
);
create table public.rides (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.ride_series(id) on delete cascade,
  owner_id uuid not null,
  route_id uuid not null,
  direction text not null,
  ride_date date not null,
  departs_at timestamptz not null,
  seats_offered smallint not null,
  seats_taken smallint not null default 0 check (seats_taken between 0 and seats_offered),
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  cancelled_at timestamptz,
  share_code text not null unique check (share_code ~ '^[0-9A-HJKMNP-TV-Z]{8}$'),
  created_at timestamptz not null default now(),
  check ((status = 'cancelled') = (cancelled_at is not null)),
  unique (series_id, ride_date)
);
-- The series is inserted before its first ride in the publish transaction.
alter table public.ride_series add constraint ride_series_published_ride_id_fkey
  foreign key (published_ride_id) references public.rides(id)
  deferrable initially deferred;
create index rides_route_direction_departs_at on public.rides (route_id, direction, departs_at)
  where status = 'scheduled';
create index rides_owner_departs_at on public.rides (owner_id, departs_at);
create index ride_series_owner_created_at on public.ride_series (owner_id, created_at);

create table public.pilot_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in ('ride_posted', 'ride_viewed')),
  user_id uuid not null references public.accounts(user_id) on delete cascade,
  series_id uuid references public.ride_series(id) on delete set null,
  ride_id uuid references public.rides(id) on delete set null,
  source text,
  ride_state text,
  repeat text check (repeat in ('once', 'weekdays')),
  ride_count smallint check (ride_count >= 1),
  event_day date not null,
  occurred_at timestamptz not null default now(),
  check (
    (event_type = 'ride_posted' and source is null and ride_state is null
      and repeat is not null and ride_count is not null)
    or (event_type = 'ride_viewed' and source is not null and source in ('list', 'link', 'published')
      and ride_state is not null and ride_state in ('available', 'full', 'departed', 'cancelled', 'withdrawn'))
  )
);
create unique index pilot_events_one_daily_view on public.pilot_events (user_id, ride_id, event_day)
  where event_type = 'ride_viewed';

-- Explicit grants avoid reliance on the local installation's default privileges.
alter table public.places enable row level security;
alter table public.routes enable row level security;
alter table public.ride_series enable row level security;
alter table public.rides enable row level security;
alter table public.pilot_events enable row level security;
revoke all on public.places, public.routes, public.ride_series, public.rides,
  public.pilot_events from public, anon, authenticated, service_role;
revoke all on sequence public.pilot_events_id_seq from public, anon, authenticated, service_role;
grant select on public.places, public.routes to authenticated;
grant select, insert, update, delete on public.places, public.routes to service_role;
grant select on public.ride_series, public.rides, public.pilot_events to service_role;

-- Re-assert TAW-4's catalogue grants; the new capacity column is not client-writable.
revoke all on public.car_types from public, anon, authenticated, service_role;
revoke update (passenger_seats) on public.car_types from public, anon, authenticated, service_role;
grant select on public.car_types to authenticated;
grant all on public.car_types to service_role;

create policy places_read on public.places for select to authenticated using (active);
create policy routes_read on public.routes for select to authenticated using (
  active
  and exists (select 1 from public.places a where a.id = place_a_id and a.active)
  and exists (select 1 from public.places b where b.id = place_b_id and b.active)
);
