-- Family status ("Safe" / "Still exploring" / away / SOS ...) and the text-only vault with a PIN-locked
-- section and a 1 GB allowance per member.

set role service_role;

-- ---------- family status ----------
create type member_status as enum ('safe', 'exploring', 'away', 'out_of_town', 'vacation', 'hospitalized', 'incarcerated', 'sos');

-- Off by default: a member turns it on in Settings to share their status and see the family's.
alter table profiles add column status_sharing boolean not null default false;
grant update (status_sharing) on profiles to authenticated;

create table member_statuses (
  user_id uuid primary key references profiles on delete cascade,
  status member_status not null,
  note text check (length(note) <= 140),
  until date,
  updated_at timestamptz not null default now()
);

-- Who shows on my status board. No rows: the Core circle.
create table status_watch (
  user_id uuid not null references profiles on delete cascade,
  member_id uuid not null references profiles on delete cascade,
  primary key (user_id, member_id),
  check (user_id <> member_id)
);

create function shares_circle_with(u uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from circle_members where user_id = u and circle_id = any (my_circle_ids()))
$$;
create function shares_status(u uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = u and active and status_sharing)
$$;

alter table member_statuses enable row level security;
alter table status_watch enable row level security;
create policy "own status" on member_statuses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and is_active());
-- Someone's status is visible to people in a circle with them, and only while both have the feature on.
create policy "family sees shared status" on member_statuses for select
  using (shares_status(user_id) and shares_status(auth.uid()) and shares_circle_with(user_id));
create policy "own watch list" on status_watch for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- vault: text files, a locked section, 1 GB each ----------
-- Images and PDFs from before this change stay readable; new uploads must be plain text.
alter table vault_items add column locked boolean not null default false;
alter table vault_items add constraint vault_items_text_only check (mime like 'text/plain%') not valid;

-- PIN hashes and failed attempts. No policies: only the app's service role reads or writes them.
create table vault_pins (
  user_id uuid primary key references profiles on delete cascade,
  pin_hash text not null,
  failed int not null default 0,
  blocked_until timestamptz
);
alter table vault_pins enable row level security;

-- True when the app has checked this member's PIN in the last 15 minutes (a claim in the request's token).
create function vault_unlocked() returns boolean language sql stable as $$
  select coalesce((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'vault_unlocked')::boolean, false)
$$;

-- Locked items are never shared.
create or replace function vault_shared_with_me(i uuid) returns boolean language sql stable security definer set search_path = public as $$
  select is_active() and exists (select 1 from vault_shares s join vault_items v on v.id = s.item_id
    where s.item_id = i and not v.locked and (s.user_id = auth.uid() or s.circle_id = any (my_circle_ids())))
$$;
create function vault_item_locked(i uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select locked from vault_items where id = i), false)
$$;

drop policy "owner or shared reads vault" on vault_items;
drop policy "owner writes vault" on vault_items;
create policy "owner or shared reads vault" on vault_items for select
  using ((owner_id = auth.uid() and (not locked or vault_unlocked())) or vault_shared_with_me(id));
create policy "owner writes vault" on vault_items for all
  using (owner_id = auth.uid() and (not locked or vault_unlocked()))
  with check (owner_id = auth.uid() and (not locked or vault_unlocked()));
drop policy "owner manages shares" on vault_shares;
create policy "owner manages shares" on vault_shares for all
  using (owns_vault_item(item_id)) with check (owns_vault_item(item_id) and not vault_item_locked(item_id));

create or replace function can_read_object(bucket text, object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select case bucket
    when 'vault' then exists (select 1 from vault_items v where v.path = object_name
      and ((v.owner_id = auth.uid() and (not v.locked or vault_unlocked())) or vault_shared_with_me(v.id)))
    when 'listing-photos' then exists (select 1 from listing_photos lp where lp.path = object_name
      and can_see_listing(lp.listing_id))
    when 'avatars' then is_active()
    else false end
$$;

-- 1 GB per member, locked section included.
create function vault_quota() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select coalesce(sum(size_bytes), 0) from vault_items where owner_id = new.owner_id and id <> new.id) + new.size_bytes > 1073741824 then
    raise exception 'That would put you over your 1 GB vault space.';
  end if;
  return new;
end $$;
create trigger vault_quota before insert or update of size_bytes, owner_id on vault_items
  for each row execute function vault_quota();

create function vault_usage() returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(sum(size_bytes), 0)::bigint from vault_items where owner_id = auth.uid()
$$;

-- ---------- live refresh also follows statuses ----------
create or replace function live_stamp() returns text language sql stable security invoker set search_path = public as $$
  select concat_ws('|',
    (select count(*) || ':' || coalesce(max(greatest(opened_at, coalesce(closed_at, opened_at)))::text, '') from alerts),
    (select count(*) || ':' || coalesce(max(created_at)::text, '') from alert_updates),
    (select count(*) || ':' || coalesce(max(updated_at)::text, '') from member_statuses))
$$;

reset role;
