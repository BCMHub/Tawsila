create table public.accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  phone_e164 text,
  phone_verified boolean not null default false,
  profile_completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint accounts_phone_e164_check
    check (phone_e164 ~ '^\+(?=[1-9])[0-9]{8,15}$'),
  constraint accounts_verified_requires_phone
    check (not phone_verified or phone_e164 is not null)
);

create unique index accounts_verified_phone_unique
  on public.accounts (phone_e164) where phone_verified;

alter table public.accounts enable row level security;
revoke all on table public.accounts from public, anon, authenticated;
grant select on table public.accounts to authenticated;

create policy accounts_select_own on public.accounts
  for select to authenticated
  using ((select auth.uid()) = user_id);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.accounts (user_id) values (new.id);
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
