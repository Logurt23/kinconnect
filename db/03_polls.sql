-- Quick polls: yes/no or pick-one questions ("What's for dinner?"), sent to chosen circles, with an
-- optional write-in answer. One vote per person, which they can change until the poll closes.

set role service_role;

create type poll_kind as enum ('yes_no', 'choice');

create table polls (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles,
  question text not null check (length(question) between 1 and 200),
  kind poll_kind not null,
  allow_other boolean not null default false,
  circle_ids uuid[] not null check (cardinality(circle_ids) > 0),
  closes_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create index polls_circles on polls using gin (circle_ids);

create table poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls on delete cascade,
  label text not null check (length(label) between 1 and 80),
  sort int not null default 0
);
create index poll_options_poll on poll_options (poll_id, sort);

create table poll_votes (
  poll_id uuid not null references polls on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  option_id uuid references poll_options on delete cascade,
  other_text text check (length(other_text) between 1 and 140),
  voted_at timestamptz not null default now(),
  primary key (poll_id, user_id),
  check ((option_id is null) <> (other_text is null))
);

create function can_see_poll(p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from polls where id = p and is_active()
    and (author_id = auth.uid() or circle_ids && my_circle_ids()))
$$;
create function owns_poll(p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from polls where id = p and author_id = auth.uid())
$$;
create function poll_open(p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from polls where id = p and closed_at is null and (closes_at is null or closes_at > now()))
$$;

-- A vote's option must belong to its poll, and a write-in needs a poll that allows one.
create function check_poll_vote() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.option_id is not null and not exists (select 1 from poll_options where id = new.option_id and poll_id = new.poll_id) then
    raise exception 'That answer isn''t part of this poll.';
  end if;
  if new.other_text is not null and not exists (select 1 from polls where id = new.poll_id and allow_other) then
    raise exception 'This poll doesn''t take written answers.';
  end if;
  new.voted_at := now();
  return new;
end $$;
create trigger poll_votes_check before insert or update on poll_votes for each row execute function check_poll_vote();

alter table polls enable row level security;
alter table poll_options enable row level security;
alter table poll_votes enable row level security;

-- Written out (not can_see_poll) so the author can read back the row they just inserted.
create policy "see polls" on polls for select
  using (is_active() and (author_id = auth.uid() or circle_ids && my_circle_ids()));
-- Members send to their own circles; admins may add any circle, as with alerts.
create policy "post polls" on polls for insert
  with check (author_id = auth.uid() and is_active() and (circle_ids <@ my_circle_ids() or is_admin()));
create policy "author closes" on polls for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "author deletes" on polls for delete using (author_id = auth.uid());
revoke update on polls from authenticated;
grant update (closed_at) on polls to authenticated;

create policy "see options" on poll_options for select using (can_see_poll(poll_id));
create policy "author adds options" on poll_options for insert with check (owns_poll(poll_id));

-- Everyone who can see a poll sees who answered what: it's family.
create policy "see votes" on poll_votes for select using (can_see_poll(poll_id));
create policy "vote" on poll_votes for insert
  with check (user_id = auth.uid() and can_see_poll(poll_id) and poll_open(poll_id));
create policy "change my vote" on poll_votes for update
  using (user_id = auth.uid() and poll_open(poll_id)) with check (user_id = auth.uid() and poll_open(poll_id));
create policy "take back my vote" on poll_votes for delete using (user_id = auth.uid() and poll_open(poll_id));

-- Live refresh follows polls and votes too.
create or replace function live_stamp() returns text language sql stable security invoker set search_path = public as $$
  select concat_ws('|',
    (select count(*) || ':' || coalesce(max(greatest(opened_at, coalesce(closed_at, opened_at)))::text, '') from alerts),
    (select count(*) || ':' || coalesce(max(created_at)::text, '') from alert_updates),
    (select count(*) || ':' || coalesce(max(updated_at)::text, '') from member_statuses),
    (select count(*) || ':' || coalesce(max(coalesce(closed_at, created_at))::text, '') from polls),
    (select count(*) || ':' || coalesce(max(voted_at)::text, '') from poll_votes))
$$;

reset role;
