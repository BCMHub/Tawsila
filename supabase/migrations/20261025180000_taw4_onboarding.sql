-- TAW-4 scope revision 7: profile completion and manual car-owner review.
create table public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  active boolean not null default true
);
create table public.legal_documents (
  kind text not null check (kind in ('terms', 'privacy')),
  version text not null,
  effective_at timestamptz not null default now(),
  is_current boolean not null default false,
  primary key (kind, version)
);
create unique index legal_documents_one_current on public.legal_documents (kind) where is_current;
create table public.car_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true
);
create table public.car_models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.car_brands(id),
  name text not null,
  active boolean not null default true,
  unique (brand_id, name),
  unique (id, brand_id)
);
create table public.car_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true
);
insert into public.car_types (code, name) values ('other', 'Other');
create table public.profiles (
  user_id uuid primary key references public.accounts(user_id) on delete cascade,
  first_name text not null,
  last_name text not null,
  community_id uuid not null references public.communities(id),
  role text not null check (role in ('rider', 'car_owner', 'both')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts(user_id) on delete cascade,
  kind text not null check (kind in ('age_18', 'terms', 'privacy')),
  version text,
  accepted_at timestamptz not null default now(),
  unique (user_id, kind, version),
  check ((kind = 'age_18' and version is null) or (kind in ('terms', 'privacy') and version is not null))
);
create unique index consents_one_age_confirmation on public.consents(user_id, kind) where kind = 'age_18';
create table public.vehicles (
  user_id uuid primary key references public.accounts(user_id) on delete cascade,
  brand_id uuid references public.car_brands(id),
  brand_other text,
  model_id uuid,
  model_other text,
  type_id uuid not null references public.car_types(id),
  year smallint not null,
  plate_number text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((brand_id is null) <> (brand_other is null)),
  check ((model_id is null) <> (model_other is null)),
  check (model_id is null or brand_id is not null),
  check (brand_other is null or (brand_other = btrim(brand_other) and char_length(brand_other) between 1 and 50)),
  check (model_other is null or (model_other = btrim(model_other) and char_length(model_other) between 1 and 50)),
  foreign key (model_id, brand_id) references public.car_models(id, brand_id)
);
create table public.verification_items (
  user_id uuid not null references public.accounts(user_id) on delete cascade,
  kind text not null check (kind = 'car_owner'),
  status text not null check (status in ('pending', 'approved', 'rejected')),
  revision int not null check (revision > 0),
  submission_key uuid not null,
  reviewer_note text,
  reviewed_revision int,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  primary key (user_id, kind)
);
create table public.verification_submissions (
  user_id uuid not null references public.accounts(user_id) on delete cascade,
  kind text not null check (kind = 'car_owner'),
  submission_key uuid not null,
  revision int not null check (revision > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, kind, submission_key),
  unique (user_id, kind, revision)
);

-- Explicit grants avoid reliance on the local installation's default privileges.
alter table public.communities enable row level security;
alter table public.legal_documents enable row level security;
alter table public.car_brands enable row level security;
alter table public.car_models enable row level security;
alter table public.car_types enable row level security;
alter table public.profiles enable row level security;
alter table public.consents enable row level security;
alter table public.vehicles enable row level security;
alter table public.verification_items enable row level security;
alter table public.verification_submissions enable row level security;
revoke all on public.communities, public.legal_documents, public.car_brands,
  public.car_models, public.car_types, public.profiles, public.consents,
  public.vehicles, public.verification_items, public.verification_submissions
  from public, anon, authenticated;
grant select on public.communities, public.legal_documents, public.car_brands,
  public.car_models, public.car_types, public.profiles, public.consents,
  public.vehicles, public.verification_items, public.verification_submissions to authenticated;
grant all on public.communities, public.legal_documents, public.car_brands,
  public.car_models, public.car_types, public.profiles, public.consents,
  public.vehicles, public.verification_items, public.verification_submissions to service_role;
create policy communities_read on public.communities for select to authenticated using (true);
create policy legal_documents_read on public.legal_documents for select to authenticated using (true);
create policy car_brands_read on public.car_brands for select to authenticated using (true);
create policy car_models_read on public.car_models for select to authenticated using (true);
create policy car_types_read on public.car_types for select to authenticated using (true);
create policy profiles_read_own on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy consents_read_own on public.consents for select to authenticated using ((select auth.uid()) = user_id);
create policy vehicles_read_own on public.vehicles for select to authenticated using ((select auth.uid()) = user_id);
create policy verification_items_read_own on public.verification_items for select to authenticated using ((select auth.uid()) = user_id);
create policy verification_submissions_read_own on public.verification_submissions for select to authenticated using ((select auth.uid()) = user_id);

create function public.taw4_guard_review() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.status, new.reviewer_note, new.reviewed_revision)
     is distinct from (old.status, old.reviewer_note, old.reviewed_revision)
     and coalesce(pg_catalog.current_setting('taw4.review_writer', true), '') not in ('submit_car', 'review_item') then
    raise exception 'review_write_forbidden';
  end if;
  return new;
end;
$$;
create trigger verification_items_guard before update on public.verification_items
for each row execute function public.taw4_guard_review();
create function public.taw4_immutable() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Cascades run after the parent account has been removed. Direct mutations
  -- remain forbidden for every role, including the service role.
  if tg_op = 'UPDATE' then
    raise exception 'immutable_record';
  end if;
  if exists (select 1 from public.accounts where user_id = old.user_id) then
    raise exception 'immutable_record';
  end if;
  return old;
end;
$$;
create trigger verification_submissions_immutable before update or delete on public.verification_submissions
for each row execute function public.taw4_immutable();
create trigger consents_immutable before update or delete on public.consents
for each row execute function public.taw4_immutable();
revoke all on function public.taw4_guard_review(), public.taw4_immutable() from public, anon, authenticated, service_role;

create function public.plate_normalized(p text) returns text
language sql immutable security definer set search_path = '' as $$
  select pg_catalog.translate(
    pg_catalog.translate(pg_catalog.normalize(p, 'NFKC'), ' -ـ', ''),
    '٠١٢٣٤٥٦٧٨٩', '0123456789');
$$;
create function public.plate_is_valid(p text) returns boolean
language sql immutable security definer set search_path = '' as $$
  select coalesce(public.plate_normalized(p) ~ '^(?:[0123456789]{1,4}|[ءآأؤإئابتثجحخدذرزسشصضطظعغفقكلمنهويىة]{1,4}[0123456789]{1,4}|[0123456789]{1,4}[ءآأؤإئابتثجحخدذرزسشصضطظعغفقكلمنهويىة]{1,4})$', false);
$$;

create function public.complete_profile(
  p_first_name text, p_last_name text, p_community_id uuid, p_role text,
  p_age_confirmed boolean, p_terms_version text, p_privacy_version text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_first text := pg_catalog.btrim(p_first_name);
  v_last text := pg_catalog.btrim(p_last_name);
begin
  perform 1 from public.accounts where user_id = v_user for update;
  if not found then raise exception 'account_missing'; end if;
  if v_first is null or v_last is null
     or pg_catalog.char_length(v_first) not between 1 and 50
     or pg_catalog.char_length(v_last) not between 1 and 50
     or v_first !~ '^[ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzءآأؤإئابتثجحخدذرزسشصضطظعغفقكلمنهويىة ''-]+$'
     or v_last !~ '^[ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzءآأؤإئابتثجحخدذرزسشصضطظعغفقكلمنهويىة ''-]+$' then
    raise exception 'invalid_name';
  end if;
  perform 1 from public.communities where id = p_community_id and active for share;
  if not found then raise exception 'invalid_community'; end if;
  if p_role is null or p_role not in ('rider', 'car_owner', 'both') then raise exception 'invalid_role'; end if;
  if p_age_confirmed is distinct from true then raise exception 'age_not_confirmed'; end if;
  -- Hold the current rows through completion so an in-flight version change waits.
  perform 1 from public.legal_documents where kind = 'terms' and version = p_terms_version and is_current for share;
  if not found then raise exception 'consent_version_stale'; end if;
  perform 1 from public.legal_documents where kind = 'privacy' and version = p_privacy_version and is_current for share;
  if not found then raise exception 'consent_version_stale'; end if;
  insert into public.profiles as p (user_id, first_name, last_name, community_id, role)
  values (v_user, v_first, v_last, p_community_id, p_role)
  on conflict (user_id) do update set first_name = excluded.first_name,
    last_name = excluded.last_name, community_id = excluded.community_id,
    role = excluded.role, updated_at = pg_catalog.now()
  where (p.first_name, p.last_name, p.community_id, p.role)
    is distinct from (excluded.first_name, excluded.last_name, excluded.community_id, excluded.role);
  insert into public.consents (user_id, kind, version) values
    (v_user, 'age_18', null), (v_user, 'terms', p_terms_version), (v_user, 'privacy', p_privacy_version)
  on conflict do nothing;
  update public.accounts set profile_completed_at = pg_catalog.now()
    where user_id = v_user and profile_completed_at is null;
end;
$$;
create function public.set_role(p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  perform 1 from public.accounts where user_id = v_user for update;
  if not found then raise exception 'account_missing'; end if;
  perform 1 from public.profiles where user_id = v_user for update;
  if not found then raise exception 'profile_missing'; end if;
  if p_role is null or p_role not in ('rider', 'car_owner', 'both') then raise exception 'invalid_role'; end if;
  update public.profiles set role = p_role, updated_at = pg_catalog.now()
    where user_id = v_user and role is distinct from p_role;
end;
$$;

create function public.submit_car(
  p_submission_key uuid, p_brand_id uuid, p_brand_other text, p_model_id uuid,
  p_model_other text, p_type_id uuid, p_year int, p_plate text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_item public.verification_items%rowtype;
  v_replay int;
  v_revision int;
  v_created boolean;
  v_guard text := coalesce(pg_catalog.current_setting('taw4.review_writer', true), '');
begin
  -- Also serialize role changes with submission and protect account lifetime.
  perform 1 from public.accounts where user_id = v_user for update;
  if not found then raise exception 'account_missing'; end if;
  -- Existing items are locked before checking replay or approval.
  select * into v_item from public.verification_items
    where user_id = v_user and kind = 'car_owner' for update;
  select revision into v_replay from public.verification_submissions
    where user_id = v_user and kind = 'car_owner' and submission_key = p_submission_key;
  if found then
    return pg_catalog.jsonb_build_object('revision', v_replay, 'status', 'pending',
      'superseded', v_item.revision > v_replay);
  end if;
  if not exists (select 1 from public.profiles where user_id = v_user and role in ('car_owner', 'both')) then
    raise exception 'role_not_car_owner';
  end if;
  if v_item.status = 'approved' then raise exception 'already_approved'; end if;
  if p_submission_key is null
     or (p_brand_id is null) = (p_brand_other is null)
     or (p_model_id is null) = (p_model_other is null)
     or (p_model_id is not null and p_brand_id is null)
     or (p_brand_other is not null and pg_catalog.char_length(pg_catalog.btrim(p_brand_other)) not between 1 and 50)
     or (p_model_other is not null and pg_catalog.char_length(pg_catalog.btrim(p_model_other)) not between 1 and 50) then
    raise exception 'invalid_car';
  end if;
  if p_brand_id is not null then
    perform 1 from public.car_brands where id = p_brand_id and active for share;
    if not found then raise exception 'invalid_car'; end if;
  end if;
  if p_model_id is not null then
    perform 1 from public.car_models where id = p_model_id and brand_id = p_brand_id and active for share;
    if not found then raise exception 'invalid_car'; end if;
  end if;
  perform 1 from public.car_types where id = p_type_id and active for share;
  if not found then raise exception 'invalid_car'; end if;
  if p_year is null or p_year < 1980 or p_year > extract(year from current_date)::int + 1 then
    raise exception 'invalid_year';
  end if;
  if not public.plate_is_valid(p_plate) then raise exception 'invalid_plate'; end if;

  perform pg_catalog.set_config('taw4.review_writer', 'submit_car', true);
  -- Safe first insert: conflict waits for the other writer; then lock its row.
  insert into public.verification_items (user_id, kind, status, revision, submission_key)
    values (v_user, 'car_owner', 'pending', 1, p_submission_key)
    on conflict (user_id, kind) do nothing;
  v_created := found;
  select * into v_item from public.verification_items
    where user_id = v_user and kind = 'car_owner' for update;
  -- Recheck history and approval under the item lock, including the first-insert path.
  select revision into v_replay from public.verification_submissions
    where user_id = v_user and kind = 'car_owner' and submission_key = p_submission_key;
  if found then
    perform pg_catalog.set_config('taw4.review_writer', v_guard, true);
    return pg_catalog.jsonb_build_object('revision', v_replay, 'status', 'pending',
      'superseded', v_item.revision > v_replay);
  end if;
  if v_item.status = 'approved' then raise exception 'already_approved'; end if;
  v_revision := case when v_created then 1 else v_item.revision + 1 end;
  insert into public.vehicles (user_id, brand_id, brand_other, model_id, model_other, type_id, year, plate_number)
  values (v_user, p_brand_id, pg_catalog.btrim(p_brand_other), p_model_id,
    pg_catalog.btrim(p_model_other), p_type_id, p_year, public.plate_normalized(p_plate))
  on conflict (user_id) do update set brand_id = excluded.brand_id, brand_other = excluded.brand_other,
    model_id = excluded.model_id, model_other = excluded.model_other, type_id = excluded.type_id,
    year = excluded.year, plate_number = excluded.plate_number, updated_at = pg_catalog.now();
  insert into public.verification_submissions (user_id, kind, submission_key, revision)
    values (v_user, 'car_owner', p_submission_key, v_revision);
  update public.verification_items set status = 'pending', revision = v_revision,
    submission_key = p_submission_key, reviewer_note = null, reviewed_revision = null,
    submitted_at = pg_catalog.now(), reviewed_at = null
    where user_id = v_user and kind = 'car_owner';
  perform pg_catalog.set_config('taw4.review_writer', v_guard, true);
  return pg_catalog.jsonb_build_object('revision', v_revision, 'status', 'pending', 'superseded', false);
end;
$$;

create function public.review_item(p_user_id uuid, p_kind text, p_revision int, p_status text, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_revision int;
  v_guard text := coalesce(pg_catalog.current_setting('taw4.review_writer', true), '');
begin
  select revision into v_revision from public.verification_items
    where user_id = p_user_id and kind = p_kind for update;
  if not found then raise exception 'item_missing'; end if;
  if p_revision is distinct from v_revision then raise exception 'stale_revision'; end if;
  if p_status is null or p_status not in ('approved', 'rejected') then raise exception 'invalid_status'; end if;
  perform pg_catalog.set_config('taw4.review_writer', 'review_item', true);
  update public.verification_items set status = p_status, reviewer_note = p_note,
    reviewed_revision = p_revision, reviewed_at = pg_catalog.now()
    where user_id = p_user_id and kind = p_kind;
  perform pg_catalog.set_config('taw4.review_writer', v_guard, true);
end;
$$;
create function public.my_verification() returns jsonb
language sql stable security definer set search_path = '' as $$
  select pg_catalog.jsonb_build_object('car_owner',
    (select pg_catalog.jsonb_build_object('status', i.status, 'revision', i.revision, 'reviewer_note', i.reviewer_note)
      from public.verification_items i where i.user_id = auth.uid() and i.kind = 'car_owner'),
    'has_car_details', exists (select 1 from public.vehicles v where v.user_id = auth.uid()));
$$;
create function public.can_request_rides() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.accounts a where a.user_id = auth.uid() and a.profile_completed_at is not null);
$$;
create function public.can_post_rides() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p join public.verification_items i on i.user_id = p.user_id
    where p.user_id = auth.uid() and p.role in ('car_owner', 'both') and i.kind = 'car_owner'
      and i.status = 'approved' and i.reviewed_revision = i.revision);
$$;
revoke all on function public.plate_normalized(text), public.plate_is_valid(text),
  public.complete_profile(text,text,uuid,text,boolean,text,text), public.set_role(text),
  public.submit_car(uuid,uuid,text,uuid,text,uuid,int,text), public.my_verification(),
  public.can_request_rides(), public.can_post_rides() from public, anon;
grant execute on function public.plate_normalized(text), public.plate_is_valid(text),
  public.complete_profile(text,text,uuid,text,boolean,text,text), public.set_role(text),
  public.submit_car(uuid,uuid,text,uuid,text,uuid,int,text), public.my_verification(),
  public.can_request_rides(), public.can_post_rides() to authenticated;
revoke all on function public.review_item(uuid,text,int,text,text) from public, anon, authenticated;
grant execute on function public.review_item(uuid,text,int,text,text) to service_role;
