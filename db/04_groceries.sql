-- Grocery lists: someone (usually Mom or Dad) starts a list and sends it to circles; everyone in them adds
-- what they want from their own account; whoever shops checks things off.

set role service_role;

create table grocery_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles,
  title text not null check (length(title) between 1 and 80),
  shop_on date,
  circle_ids uuid[] not null check (cardinality(circle_ids) > 0),
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create index grocery_lists_circles on grocery_lists using gin (circle_ids);

create table grocery_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references grocery_lists on delete cascade,
  name text not null check (length(name) between 1 and 80),
  qty text check (length(qty) <= 30),
  note text check (length(note) <= 140),
  added_by uuid not null references profiles,
  checked_by uuid references profiles,
  checked_at timestamptz,
  created_at timestamptz not null default now()
);
create index grocery_items_list on grocery_items (list_id, created_at);

create function can_see_grocery_list(l uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from grocery_lists where id = l and is_active()
    and (owner_id = auth.uid() or circle_ids && my_circle_ids()))
$$;
create function owns_grocery_list(l uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from grocery_lists where id = l and owner_id = auth.uid())
$$;
create function grocery_list_open(l uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from grocery_lists where id = l and closed_at is null)
$$;

alter table grocery_lists enable row level security;
alter table grocery_items enable row level security;

-- Written out, not through can_see_grocery_list, so the owner can read back the row they just made.
create policy "see grocery lists" on grocery_lists for select
  using (is_active() and (owner_id = auth.uid() or circle_ids && my_circle_ids()));
-- Sent to the owner's own circles; admins may add any, as with alerts and polls.
create policy "start grocery lists" on grocery_lists for insert
  with check (owner_id = auth.uid() and is_active() and (circle_ids <@ my_circle_ids() or is_admin()));
create policy "owner edits grocery list" on grocery_lists for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner deletes grocery list" on grocery_lists for delete using (owner_id = auth.uid());
revoke update on grocery_lists from authenticated;
grant update (title, shop_on, closed_at) on grocery_lists to authenticated;

create policy "see grocery items" on grocery_items for select using (can_see_grocery_list(list_id));
create policy "add what I want" on grocery_items for insert
  with check (added_by = auth.uid() and can_see_grocery_list(list_id) and grocery_list_open(list_id) and checked_at is null);
-- Anyone on the list can check things off; the trigger below keeps everything else to the item's author.
create policy "check off or edit" on grocery_items for update
  using (can_see_grocery_list(list_id) and grocery_list_open(list_id))
  with check (can_see_grocery_list(list_id) and grocery_list_open(list_id));
create policy "remove mine, or any on my list" on grocery_items for delete
  using (added_by = auth.uid() or owns_grocery_list(list_id));
revoke update on grocery_items from authenticated;
grant update (name, qty, note, checked_by, checked_at) on grocery_items to authenticated;

-- Checking stamps who and when; only the item's author can change what it says.
create function guard_grocery_item() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.added_by <> auth.uid()
     and (new.name <> old.name or new.qty is distinct from old.qty or new.note is distinct from old.note) then
    raise exception 'Only whoever added an item can change it.';
  end if;
  if new.checked_at is not null and old.checked_at is null then
    new.checked_by := coalesce(auth.uid(), new.checked_by);
    new.checked_at := now();
  elsif new.checked_at is null then
    new.checked_by := null;
  end if;
  return new;
end $$;
create trigger grocery_items_guard before update on grocery_items for each row execute function guard_grocery_item();

-- Live refresh follows the lists and every add and check.
create or replace function live_stamp() returns text language sql stable security invoker set search_path = public as $$
  select concat_ws('|',
    (select count(*) || ':' || coalesce(max(greatest(opened_at, coalesce(closed_at, opened_at)))::text, '') from alerts),
    (select count(*) || ':' || coalesce(max(created_at)::text, '') from alert_updates),
    (select count(*) || ':' || coalesce(max(updated_at)::text, '') from member_statuses),
    (select count(*) || ':' || coalesce(max(coalesce(closed_at, created_at))::text, '') from polls),
    (select count(*) || ':' || coalesce(max(voted_at)::text, '') from poll_votes),
    (select count(*) || ':' || coalesce(max(coalesce(closed_at, created_at))::text, '') from grocery_lists),
    (select count(*) || ':' || count(checked_at) || ':' || coalesce(max(greatest(created_at, coalesce(checked_at, created_at)))::text, '') from grocery_items))
$$;

reset role;
