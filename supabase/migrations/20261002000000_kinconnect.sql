-- KinConnect schema. Every table has row level security. Shared rows carry circle_ids and are visible
-- to members whose circles overlap; see my_circle_ids().

create extension if not exists pgcrypto;

-- ---------- enums ----------
create type member_role as enum ('admin', 'member');
create type circle_kind as enum ('core', 'extended', 'branch');
create type alert_kind as enum ('notice', 'emergency_911', 'emergency_family', 'weather_checkin');
create type alert_update_kind as enum ('note', 'on_scene', 'heading_over', 'resolved', 'power_out', 'hurt', 'safe', 'need_contact');
create type offer_type as enum ('loan', 'sell', 'give');
create type listing_status as enum ('available', 'reserved', 'out', 'closed');
create type reservation_status as enum ('pending', 'confirmed', 'declined', 'returned', 'canceled');
create type category_scope as enum ('resource', 'request');
create type request_status as enum ('open', 'claimed', 'done', 'canceled');
create type calendar_kind as enum ('google', 'ics', 'manual');
create type calendar_detail as enum ('busy', 'titles');
create type milestone_kind as enum ('engagement', 'new_baby', 'move', 'graduation', 'new_job', 'loss', 'other');
create type gift_list_kind as enum ('christmas', 'birthday', 'other');
create type ledger_kind as enum ('request', 'offer', 'iou');
create type ledger_status as enum ('open', 'paid', 'canceled');

-- ---------- people and circles ----------
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null unique,
  display_name text not null,
  photo_path text,
  birthday date,
  home_label text,
  lat double precision,
  lon double precision,
  role member_role not null default 'member',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table circles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind circle_kind not null,
  color text not null default '#2f6b4f',
  created_at timestamptz not null default now()
);
create unique index circles_one_core on circles (kind) where kind in ('core', 'extended');

create table circle_members (
  circle_id uuid not null references circles on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  primary key (circle_id, user_id)
);
create index circle_members_user on circle_members (user_id);

create table invites (
  email text primary key,
  display_name text,
  role member_role not null default 'member',
  circle_ids uuid[] not null default '{}',
  invited_by uuid references profiles,
  user_id uuid, -- the pending auth user, so a cancel can remove it directly
  created_at timestamptz not null default now()
);

-- ---------- helpers (security definer so policies don't recurse) ----------
create function is_active() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select active from profiles where id = auth.uid()), false)
$$;

create function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select active and role = 'admin' from profiles where id = auth.uid()), false)
$$;

create function my_circle_ids() returns uuid[] language sql stable security definer set search_path = public as $$
  select case when is_active()
    then coalesce(array_agg(circle_id), '{}') else '{}' end
  from circle_members where user_id = auth.uid()
$$;

-- New auth users get a profile and circles from their invite. No invite: an inactive profile.
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare inv invites;
begin
  select * into inv from invites where lower(email) = lower(new.email);
  insert into profiles (id, email, display_name, role, active)
  values (new.id, new.email, coalesce(inv.display_name, split_part(new.email, '@', 1)),
          coalesce(inv.role, 'member'), inv.email is not null);
  if inv.email is not null then
    insert into circle_members (circle_id, user_id)
    select unnest(inv.circle_ids), new.id on conflict do nothing;
    -- The invite stays listed as pending (and cancelable) until the link is used; /auth/confirm clears it.
    update invites set user_id = new.id where email = inv.email;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

alter table profiles enable row level security;
alter table circles enable row level security;
alter table circle_members enable row level security;
alter table invites enable row level security;

create policy "members read profiles" on profiles for select using (is_active());
create policy "self updates profile" on profiles for update using (id = auth.uid()) with check (id = auth.uid());
-- Role and active are changed by admin actions with the service key only.
revoke update on profiles from authenticated, anon;
grant update (display_name, photo_path, birthday, home_label, lat, lon) on profiles to authenticated;

create policy "members read circles" on circles for select using (is_active());
create policy "admin writes circles" on circles for all using (is_admin()) with check (is_admin());
create policy "members read circle members" on circle_members for select using (is_active());
create policy "admin writes circle members" on circle_members for all using (is_admin()) with check (is_admin());
create policy "admin manages invites" on invites for all using (is_admin()) with check (is_admin());

-- ---------- alerts ----------
create table alerts (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references profiles,
  kind alert_kind not null,
  message text not null check (length(message) between 1 and 1000),
  circle_ids uuid[] not null check (cardinality(circle_ids) > 0),
  location_label text,
  lat double precision,
  lon double precision,
  nws_event_id text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references profiles
);
create index alerts_circles on alerts using gin (circle_ids);
create index alerts_open on alerts (opened_at desc) where closed_at is null;

create table alert_updates (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references alerts on delete cascade,
  author_id uuid not null references profiles,
  kind alert_update_kind not null default 'note',
  body text,
  created_at timestamptz not null default now()
);
create index alert_updates_alert on alert_updates (alert_id, created_at);

create table alert_receipts (
  alert_id uuid not null references alerts on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  read_at timestamptz not null default now(),
  seen_at timestamptz,
  primary key (alert_id, user_id)
);

create function can_see_alert(a uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from alerts where id = a and is_active()
    and (sender_id = auth.uid() or circle_ids && my_circle_ids()))
$$;

alter table alerts enable row level security;
alter table alert_updates enable row level security;
alter table alert_receipts enable row level security;

create policy "see alerts in my circles" on alerts for select
  using (is_active() and (sender_id = auth.uid() or circle_ids && my_circle_ids()));
-- Members send to their own circles; admins may add any circle (e.g. Extended).
create policy "send alerts" on alerts for insert
  with check (is_active() and sender_id = auth.uid() and (circle_ids <@ my_circle_ids() or is_admin()));
create policy "sender or admin closes" on alerts for update
  using (sender_id = auth.uid() or is_admin()) with check (sender_id = auth.uid() or is_admin());
revoke update on alerts from authenticated, anon;
grant update (closed_at, closed_by) on alerts to authenticated;

create policy "read updates" on alert_updates for select using (can_see_alert(alert_id));
create policy "post updates" on alert_updates for insert with check (author_id = auth.uid() and can_see_alert(alert_id));
create policy "own receipts" on alert_receipts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and can_see_alert(alert_id));

-- ---------- categories ----------
create table categories (
  id uuid primary key default gen_random_uuid(),
  scope category_scope not null,
  name text not null,
  sort int not null default 0,
  unique (scope, name)
);
alter table categories enable row level security;
create policy "members read categories" on categories for select using (is_active());
create policy "admin writes categories" on categories for all using (is_admin()) with check (is_admin());

-- ---------- resources ----------
create table listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles,
  title text not null,
  description text,
  category_id uuid references categories on delete set null,
  circle_ids uuid[] not null check (cardinality(circle_ids) > 0),
  offer_type offer_type not null,
  loan_days int check (loan_days > 0),
  price_cents int check (price_cents >= 0),
  quantity int not null default 1 check (quantity > 0),
  pickup_note text,
  digital_link text,
  digital_instructions text,
  status listing_status not null default 'available',
  created_at timestamptz not null default now(),
  check (offer_type <> 'loan' or loan_days is not null),
  check (offer_type <> 'sell' or price_cents is not null)
);
create index listings_circles on listings using gin (circle_ids);

create table listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings on delete cascade,
  path text not null unique,
  sort int not null default 0
);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings on delete cascade,
  requester_id uuid not null references profiles,
  starts_on date not null,
  ends_on date,
  note text,
  status reservation_status not null default 'pending',
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index reservations_listing on reservations (listing_id);

create function can_see_listing(l uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from listings where id = l and is_active()
    and (owner_id = auth.uid() or circle_ids && my_circle_ids()))
$$;
create function owns_listing(l uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from listings where id = l and owner_id = auth.uid())
$$;

alter table listings enable row level security;
alter table listing_photos enable row level security;
alter table reservations enable row level security;

create policy "see listings" on listings for select
  using (is_active() and (owner_id = auth.uid() or circle_ids && my_circle_ids()));
create policy "owner writes listings" on listings for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and is_active());
create policy "see photos" on listing_photos for select using (can_see_listing(listing_id));
create policy "owner writes photos" on listing_photos for all using (owns_listing(listing_id)) with check (owns_listing(listing_id));
create policy "see reservations" on reservations for select
  using (requester_id = auth.uid() or owns_listing(listing_id));
create policy "reserve" on reservations for insert
  with check (requester_id = auth.uid() and can_see_listing(listing_id) and not owns_listing(listing_id));
create policy "owner decides, requester cancels" on reservations for update
  using (owns_listing(listing_id) or requester_id = auth.uid())
  with check (owns_listing(listing_id) or requester_id = auth.uid());

-- RLS can't tell which columns changed, so a trigger holds the line: the requester may only cancel
-- a pending or confirmed reservation; confirming, declining and returning belong to the owner.
create function guard_reservation_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.listing_id <> old.listing_id or new.requester_id <> old.requester_id then
    raise exception 'A reservation can''t be moved to another listing or person.';
  end if;
  if auth.uid() is not null and not owns_listing(old.listing_id) then
    if new.status <> 'canceled' or old.status not in ('pending', 'confirmed')
       or new.starts_on <> old.starts_on or new.ends_on is distinct from old.ends_on then
      raise exception 'Only the owner can change that reservation.';
    end if;
  end if;
  return new;
end $$;
create trigger reservations_guard before update on reservations
  for each row execute function guard_reservation_update();

-- ---------- service requests ----------
create table service_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles,
  category_id uuid references categories on delete set null,
  needed_at timestamptz,
  where_text text,
  note text,
  circle_ids uuid[] not null check (cardinality(circle_ids) > 0),
  status request_status not null default 'open',
  claimed_by uuid references profiles,
  claimed_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index service_requests_circles on service_requests using gin (circle_ids);
alter table service_requests enable row level security;
create policy "see requests" on service_requests for select
  using (is_active() and (requester_id = auth.uid() or claimed_by = auth.uid() or circle_ids && my_circle_ids()));
create policy "open requests" on service_requests for insert
  with check (requester_id = auth.uid() and is_active());
create policy "requester edits" on service_requests for update using (requester_id = auth.uid());

-- Claim and finish go through functions so a claimer can't rewrite someone else's request.
create function claim_request(r uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update service_requests set status = 'claimed', claimed_by = auth.uid(), claimed_at = now()
  where id = r and status = 'open' and requester_id <> auth.uid() and is_active() and circle_ids && my_circle_ids();
  if not found then raise exception 'That request is no longer open.'; end if;
end $$;
create function finish_request(r uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update service_requests set status = 'done', done_at = now()
  where id = r and status = 'claimed' and auth.uid() in (requester_id, claimed_by);
  if not found then raise exception 'Only the requester or the claimer can mark this done.'; end if;
end $$;
create function unclaim_request(r uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update service_requests set status = 'open', claimed_by = null, claimed_at = null
  where id = r and status = 'claimed' and claimed_by = auth.uid();
end $$;

-- ---------- schedule ----------
create table calendar_sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles on delete cascade,
  kind calendar_kind not null,
  label text not null,
  ics_url text,
  google_calendar_id text,
  color text not null default '#3b6ea5',
  detail calendar_detail not null default 'busy',
  circle_ids uuid[] not null default '{}',
  synced_at timestamptz,
  sync_error text,
  created_at timestamptz not null default now()
);
create table google_tokens (
  user_id uuid primary key references profiles on delete cascade,
  email text,
  refresh_token_enc text not null,
  scope text not null,
  updated_at timestamptz not null default now()
);
create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references calendar_sources on delete cascade,
  external_id text,
  title text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  unique (source_id, external_id)
);
create index calendar_events_time on calendar_events (starts_at);

create function owns_source(s uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from calendar_sources where id = s and owner_id = auth.uid())
$$;

alter table calendar_sources enable row level security;
alter table google_tokens enable row level security; -- no policies: service key only
alter table calendar_events enable row level security;
create policy "own sources" on calendar_sources for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own events" on calendar_events for all using (owns_source(source_id)) with check (owns_source(source_id));

-- The family calendar: my events plus those shared with my circles, titles hidden when busy-only.
create function family_events(from_ts timestamptz, to_ts timestamptz)
returns table (id uuid, source_id uuid, owner_id uuid, owner_name text, color text, title text,
               starts_at timestamptz, ends_at timestamptz, all_day boolean)
language sql stable security definer set search_path = public as $$
  select e.id, s.id, s.owner_id, p.display_name, s.color,
    case when s.owner_id = auth.uid() or s.detail = 'titles' then e.title else 'Busy' end,
    e.starts_at, e.ends_at, e.all_day
  from calendar_events e
  join calendar_sources s on s.id = e.source_id
  join profiles p on p.id = s.owner_id and p.active
  where is_active() and e.starts_at < to_ts and e.ends_at > from_ts
    and (s.owner_id = auth.uid() or s.circle_ids && my_circle_ids())
  order by e.starts_at
$$;

-- ---------- dates ----------
create table milestones (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references profiles,
  posted_by uuid not null references profiles,
  kind milestone_kind not null,
  title text not null,
  note text,
  happened_on date not null,
  link_url text,
  circle_ids uuid[] not null check (cardinality(circle_ids) > 0),
  created_at timestamptz not null default now()
);
create index milestones_circles on milestones using gin (circle_ids);
alter table milestones enable row level security;
create policy "see milestones" on milestones for select
  using (is_active() and (subject_id = auth.uid() or posted_by = auth.uid() or circle_ids && my_circle_ids()));
create policy "post milestones" on milestones for insert
  with check (posted_by = auth.uid() and is_active() and (subject_id = auth.uid() or is_admin()));
create policy "poster edits milestones" on milestones for delete using (posted_by = auth.uid() or is_admin());

-- ---------- gift lists ----------
create table gift_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles on delete cascade,
  kind gift_list_kind not null default 'christmas',
  title text not null,
  circle_ids uuid[] not null check (cardinality(circle_ids) > 0),
  created_at timestamptz not null default now()
);
create table gift_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references gift_lists on delete cascade,
  title text not null,
  url text,
  note text,
  price_guess_cents int check (price_guess_cents >= 0),
  created_at timestamptz not null default now()
);
create table gift_claims (
  item_id uuid primary key references gift_items on delete cascade,
  claimed_by uuid not null references profiles,
  claimed_at timestamptz not null default now()
);

create function can_see_gift_list(l uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from gift_lists where id = l and is_active()
    and (owner_id = auth.uid() or circle_ids && my_circle_ids()))
$$;
create function owns_gift_list(l uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from gift_lists where id = l and owner_id = auth.uid())
$$;
-- True when I can see the item's list and the list is not mine: the only people who see claims.
create function can_see_claim(i uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from gift_items gi join gift_lists gl on gl.id = gi.list_id
    where gi.id = i and is_active() and gl.owner_id <> auth.uid() and gl.circle_ids && my_circle_ids())
$$;

alter table gift_lists enable row level security;
alter table gift_items enable row level security;
alter table gift_claims enable row level security;
create policy "see lists" on gift_lists for select
  using (is_active() and (owner_id = auth.uid() or circle_ids && my_circle_ids()));
create policy "owner writes lists" on gift_lists for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "see items" on gift_items for select using (can_see_gift_list(list_id));
create policy "owner writes items" on gift_items for all using (owns_gift_list(list_id)) with check (owns_gift_list(list_id));
-- The list owner matches none of these, so they can never read who claimed what.
create policy "see claims, not on my own list" on gift_claims for select using (can_see_claim(item_id));
create policy "claim" on gift_claims for insert with check (claimed_by = auth.uid() and can_see_claim(item_id));
create policy "unclaim my claim" on gift_claims for delete using (claimed_by = auth.uid());

-- ---------- ledger ----------
create table ledger_entries (
  id uuid primary key default gen_random_uuid(),
  kind ledger_kind not null,
  amount_cents int not null check (amount_cents > 0),
  note text,
  from_id uuid not null references profiles, -- who pays
  to_id uuid not null references profiles,   -- who receives
  created_by uuid not null references profiles,
  status ledger_status not null default 'open',
  from_marked_paid boolean not null default false,
  to_marked_paid boolean not null default false,
  created_at timestamptz not null default now(),
  check (from_id <> to_id),
  check (created_by in (from_id, to_id))
);
create index ledger_from on ledger_entries (from_id);
create index ledger_to on ledger_entries (to_id);
alter table ledger_entries enable row level security;
create policy "parties see entries" on ledger_entries for select using (auth.uid() in (from_id, to_id));
create policy "add entries" on ledger_entries for insert
  with check (created_by = auth.uid() and is_active() and status = 'open' and not from_marked_paid and not to_marked_paid);

create function mark_ledger_paid(e uuid, paid boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  update ledger_entries set
    from_marked_paid = case when from_id = auth.uid() then paid else from_marked_paid end,
    to_marked_paid = case when to_id = auth.uid() then paid else to_marked_paid end
  where id = e and status <> 'canceled' and auth.uid() in (from_id, to_id);
  if not found then raise exception 'Entry not found.'; end if;
  update ledger_entries set status = case when from_marked_paid and to_marked_paid then 'paid'::ledger_status else 'open' end
  where id = e;
end $$;
create function cancel_ledger_entry(e uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update ledger_entries set status = 'canceled' where id = e and status = 'open' and created_by = auth.uid();
  if not found then raise exception 'Only whoever created an open entry can cancel it.'; end if;
end $$;

-- ---------- weather ----------
create table weather_prompts (
  user_id uuid not null references profiles on delete cascade,
  nws_id text not null,
  event text not null,
  severity text not null,
  headline text,
  expires_at timestamptz,
  answered_alert_id uuid references alerts on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, nws_id)
);
alter table weather_prompts enable row level security;
create policy "own prompts" on weather_prompts for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- vault ----------
create table vault_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles on delete cascade,
  title text not null,
  path text not null unique,
  mime text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);
create table vault_shares (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references vault_items on delete cascade,
  user_id uuid references profiles on delete cascade,
  circle_id uuid references circles on delete cascade,
  created_at timestamptz not null default now(),
  check ((user_id is null) <> (circle_id is null))
);
create index vault_shares_item on vault_shares (item_id);

create function owns_vault_item(i uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from vault_items where id = i and owner_id = auth.uid())
$$;
create function vault_shared_with_me(i uuid) returns boolean language sql stable security definer set search_path = public as $$
  select is_active() and exists (select 1 from vault_shares
    where item_id = i and (user_id = auth.uid() or circle_id = any (my_circle_ids())))
$$;

alter table vault_items enable row level security;
alter table vault_shares enable row level security;
create policy "owner or shared reads vault" on vault_items for select
  using (owner_id = auth.uid() or vault_shared_with_me(id));
create policy "owner writes vault" on vault_items for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner manages shares" on vault_shares for all using (owns_vault_item(item_id)) with check (owns_vault_item(item_id));
create policy "grantee sees share" on vault_shares for select
  using (user_id = auth.uid() or circle_id = any (my_circle_ids()));

-- ---------- storage ----------
-- Size and type limits are enforced here as well as in the server actions.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('vault', 'vault', false, 20971520, array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']),
  ('listing-photos', 'listing-photos', false, 20971520, array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic', 'image/heif']),
  ('avatars', 'avatars', false, 20971520, array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

create function can_read_object(bucket text, object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select case bucket
    when 'vault' then exists (select 1 from vault_items v where v.path = object_name
      and (v.owner_id = auth.uid() or vault_shared_with_me(v.id)))
    when 'listing-photos' then exists (select 1 from listing_photos lp where lp.path = object_name
      and can_see_listing(lp.listing_id))
    when 'avatars' then is_active()
    else false end
$$;

create policy "upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id in ('vault', 'listing-photos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "update own folder" on storage.objects for update to authenticated
  using (bucket_id in ('vault', 'listing-photos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own folder" on storage.objects for delete to authenticated
  using (bucket_id in ('vault', 'listing-photos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read own or allowed" on storage.objects for select to authenticated
  using (bucket_id in ('vault', 'listing-photos', 'avatars')
    and ((storage.foldername(name))[1] = auth.uid()::text or can_read_object(bucket_id, name)));

-- ---------- realtime ----------
alter publication supabase_realtime add table alerts, alert_updates;

-- ---------- seed data every install needs ----------
insert into circles (name, kind, color) values ('Core', 'core', '#2f6b4f'), ('Extended', 'extended', '#8a5a2b');
insert into categories (scope, name, sort) select 'resource', n, i from unnest(array[
  'Tools', 'Vehicles', 'Appliances', 'Household', 'Food', 'Tickets', 'Digital subscriptions',
  'Streaming and portal links', 'Software', 'Licenses', 'Family pictures', 'Other']) with ordinality as t(n, i);
insert into categories (scope, name, sort) select 'request', n, i from unnest(array[
  'Dog watching', 'Cat sitting', 'A ride', 'Airport pickup', 'Babysitting', 'A tool', 'A meal', 'Other'])
  with ordinality as t(n, i);

-- ---------- counts ----------
-- Alerts from someone else, in the last 60 days, that I haven't opened. RLS limits it to my circles.
create function unread_alert_count() returns integer language sql stable security invoker set search_path = public as $$
  select count(*)::int from alerts a
  where a.sender_id <> auth.uid() and a.opened_at > now() - interval '60 days'
    and not exists (select 1 from alert_receipts r where r.alert_id = a.id and r.user_id = auth.uid())
$$;
grant execute on function unread_alert_count() to authenticated;
