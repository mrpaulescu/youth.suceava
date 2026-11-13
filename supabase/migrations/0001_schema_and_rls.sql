-- Youth Suceava — schema + RLS (v1)
-- ATENȚIE: verifică schema live înainte de rulare (IF NOT EXISTS evită duplicarea, dar nu reconciliază coloane diferite).

-- ========== Tipuri ==========
do $$ begin
  create type content_status as enum ('draft','pending_review','published','rejected','archived');
exception when duplicate_object then null; end $$;
do $$ begin
  create type app_role as enum ('admin','moderator');
exception when duplicate_object then null; end $$;

-- ========== Utilitare ==========
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table if not exists user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  primary key (user_id, role)
);

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid());
$$;

-- ========== Profiluri ==========
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 120),
  avatar_url text,
  bio text check (char_length(bio) <= 1000),
  profile_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)))
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ========== Directoare publice ==========
create table if not exists ngos (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  name text not null check (char_length(name) between 2 and 200),
  tagline text check (char_length(tagline) <= 300),
  description text,
  category text,
  city text,
  address text,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  website text check (website is null or website ~* '^https?://'),
  contact_email text,
  founded_year int check (founded_year between 1800 and 2100),
  status content_status not null default 'draft',
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ngo_members (
  ngo_id uuid not null references ngos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner','editor')),
  primary key (ngo_id, user_id)
);

create or replace function is_ngo_member(n uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from ngo_members where ngo_id = n and user_id = auth.uid());
$$;
create or replace function is_ngo_owner(n uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from ngo_members where ngo_id = n and user_id = auth.uid() and role = 'owner');
$$;

create or replace function ngo_add_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null then
    insert into ngo_members (ngo_id, user_id, role) values (new.id, new.created_by, 'owner') on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists ngos_add_owner on ngos;
create trigger ngos_add_owner after insert on ngos for each row execute function ngo_add_owner();

create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  user_id uuid references auth.users(id) on delete set null,
  ngo_id uuid references ngos(id) on delete set null,
  name text not null check (char_length(name) between 2 and 160),
  role text,
  bio text,
  city text,
  public_contact text,
  status content_status not null default 'draft',
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  ngo_id uuid not null references ngos(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 200),
  description text,
  lifecycle text not null default 'planned' check (lifecycle in ('planned','active','completed','cancelled')),
  starts_on date,
  ends_on date,
  status content_status not null default 'draft',
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  ngo_id uuid references ngos(id) on delete set null,
  title text not null check (char_length(title) between 2 and 200),
  description text,
  category text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  is_online boolean not null default false,
  venue text,
  city text,
  address text,
  capacity int check (capacity is null or capacity > 0),
  registration_deadline timestamptz,
  status content_status not null default 'draft',
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index if not exists events_starts_idx on events (starts_at);

create table if not exists collaborations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  ngo_id uuid references ngos(id) on delete set null,
  title text not null check (char_length(title) between 2 and 200),
  type text not null check (type in ('partner','volunteer','offer','funding')),
  category text,
  description text,
  location text,
  deadline date,
  is_open boolean not null default true,
  status content_status not null default 'draft',
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists funding_opportunities (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  title text not null check (char_length(title) between 2 and 200),
  funder text,
  type text,
  amount_text text,
  deadline date,
  categories text[] not null default '{}',
  description text,
  source_url text check (source_url is null or source_url ~* '^https?://'),
  status content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  title text not null check (char_length(title) between 2 and 200),
  type text,                 -- ghid, șablon, webinar, dataset
  category text,
  description text,
  url text check (url is null or url ~* '^https?://'),
  storage_path text,
  status content_status not null default 'draft',
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (url is not null or storage_path is not null)
);

-- ========== Activitate utilizator ==========
create table if not exists event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  full_name text, email text,
  status text not null default 'registered' check (status in ('registered','cancelled','waitlist')),
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table if not exists collaboration_responses (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references collaborations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  respondent_type text,
  message text not null check (char_length(message) between 1 and 2000),
  status text not null default 'new' check (status in ('new','accepted','declined')),
  created_at timestamptz not null default now(),
  unique (collaboration_id, user_id)
);

create table if not exists saved_funding (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  funding_id uuid not null references funding_opportunities(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, funding_id)
);

-- ========== Feed ==========
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  ngo_id uuid references ngos(id) on delete set null,
  type text not null default 'update',
  body text not null check (char_length(body) between 1 and 5000),
  event_id uuid references events(id) on delete set null,
  collaboration_id uuid references collaborations(id) on delete set null,
  funding_id uuid references funding_opportunities(id) on delete set null,
  status content_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists posts_created_idx on posts (created_at desc);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  body text not null check (char_length(body) between 1 and 2000),
  status content_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists comments_post_idx on comments (post_id, created_at);

create table if not exists post_likes (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  ngo_id uuid references ngos(id) on delete cascade,
  person_id uuid references people(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((ngo_id is not null)::int + (person_id is not null)::int = 1)
);
create unique index if not exists follows_ngo_uq on follows (user_id, ngo_id) where ngo_id is not null;
create unique index if not exists follows_person_uq on follows (user_id, person_id) where person_id is not null;

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  message text not null,
  entity_type text, entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notif_user_idx on notifications (user_id, read_at);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  entity_type text not null, entity_id uuid not null,
  reason text not null check (char_length(reason) <= 1000),
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id bigserial primary key,
  actor_id uuid, action text not null, table_name text not null, row_id uuid,
  old_data jsonb, new_data jsonb, created_at timestamptz not null default now()
);

-- Statistici feed (înlocuiește offset-ul fix din UI)
create or replace view post_stats with (security_invoker = true) as
select p.id as post_id,
  (select count(*) from post_likes l where l.post_id = p.id) as likes,
  (select count(*) from comments c where c.post_id = p.id and c.status = 'published') as comments
from posts p;

-- ========== Triggere: updated_at, guard status, audit ==========
create or replace function guard_status() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not is_staff()
     and (tg_op = 'INSERT' or new.status is distinct from old.status)
     and new.status in ('published','rejected') then
    raise exception 'Doar moderatorii pot publica sau respinge înregistrări';
  end if;
  return new;
end $$;

create or replace function audit_changes() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (actor_id, action, table_name, row_id, old_data, new_data)
  values (auth.uid(), tg_op, tg_table_name,
          coalesce((to_jsonb(new)->>'id'), (to_jsonb(old)->>'id'))::uuid,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

do $$ declare t text; begin
  foreach t in array array['profiles','ngos','people','projects','events','collaborations',
                           'funding_opportunities','resources','posts','comments'] loop
    execute format('drop trigger if exists %1$s_upd on %1$s; create trigger %1$s_upd before update on %1$s for each row execute function set_updated_at();', t);
  end loop;
  foreach t in array array['ngos','people','projects','events','collaborations','resources'] loop
    execute format('drop trigger if exists %1$s_guard on %1$s; create trigger %1$s_guard before insert or update on %1$s for each row execute function guard_status();', t);
  end loop;
  foreach t in array array['ngos','people','projects','events','collaborations','funding_opportunities','resources'] loop
    execute format('drop trigger if exists %1$s_audit on %1$s; create trigger %1$s_audit after insert or update or delete on %1$s for each row execute function audit_changes();', t);
  end loop;
end $$;

-- ========== Notificări (server-side) ==========
create or replace function notify_comment() returns trigger language plpgsql security definer set search_path = public as $$
declare a uuid;
begin
  select author_id into a from posts where id = new.post_id;
  if a is not null and a <> new.user_id then
    insert into notifications (user_id, type, message, entity_type, entity_id)
    values (a, 'comment', 'Cineva a comentat la postarea ta', 'post', new.post_id);
  end if;
  return new;
end $$;
drop trigger if exists comments_notify on comments;
create trigger comments_notify after insert on comments for each row execute function notify_comment();

create or replace function notify_collab_response() returns trigger language plpgsql security definer set search_path = public as $$
declare o uuid;
begin
  select created_by into o from collaborations where id = new.collaboration_id;
  if o is not null and o <> new.user_id then
    insert into notifications (user_id, type, message, entity_type, entity_id)
    values (o, 'collab_response', 'Ai primit un răspuns la o colaborare', 'collaboration', new.collaboration_id);
  end if;
  return new;
end $$;
drop trigger if exists collab_resp_notify on collaboration_responses;
create trigger collab_resp_notify after insert on collaboration_responses for each row execute function notify_collab_response();

-- ========== RLS ==========
do $$ declare t text; begin
  foreach t in array array['user_roles','profiles','ngos','ngo_members','people','projects','events','collaborations',
    'funding_opportunities','resources','event_registrations','collaboration_responses','saved_funding',
    'posts','comments','post_likes','follows','notifications','reports','audit_log'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

create or replace function can_manage(creator uuid, ngo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select creator = auth.uid() or is_staff() or (ngo is not null and is_ngo_member(ngo));
$$;

-- profiles
drop policy if exists profiles_read on profiles;   create policy profiles_read on profiles for select using (true);
drop policy if exists profiles_upd on profiles;    create policy profiles_upd on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- user_roles / audit: doar staff citește; nimeni nu scrie din client
drop policy if exists roles_read on user_roles;    create policy roles_read on user_roles for select using (user_id = auth.uid() or is_staff());
drop policy if exists audit_read on audit_log;     create policy audit_read on audit_log for select using (is_staff());

-- ngos
drop policy if exists ngos_sel on ngos; create policy ngos_sel on ngos for select using (status='published' or can_manage(created_by, id));
drop policy if exists ngos_ins on ngos; create policy ngos_ins on ngos for insert with check (auth.uid() is not null and created_by = auth.uid());
drop policy if exists ngos_upd on ngos; create policy ngos_upd on ngos for update using (can_manage(created_by, id)) with check (can_manage(created_by, id));
drop policy if exists ngos_del on ngos; create policy ngos_del on ngos for delete using (is_staff() or is_ngo_owner(id));

-- ngo_members
drop policy if exists nm_sel on ngo_members; create policy nm_sel on ngo_members for select using (user_id = auth.uid() or is_staff() or is_ngo_owner(ngo_id));
drop policy if exists nm_wr on ngo_members;  create policy nm_wr on ngo_members for all using (is_staff() or is_ngo_owner(ngo_id)) with check (is_staff() or is_ngo_owner(ngo_id));

-- tabele cu proprietar + ngo_id opțional
do $$ declare r record; begin
  for r in select * from (values ('projects','ngo_id'),('events','ngo_id'),('collaborations','ngo_id'),
                                 ('people','null::uuid'),('resources','null::uuid')) v(t,n) loop
    execute format('drop policy if exists %1$s_sel on %1$s; create policy %1$s_sel on %1$s for select using (status=''published'' or can_manage(created_by, %2$s));', r.t, r.n);
    execute format('drop policy if exists %1$s_ins on %1$s; create policy %1$s_ins on %1$s for insert with check (auth.uid() is not null and created_by = auth.uid() and (%2$s is null or is_ngo_member(%2$s)));', r.t, r.n);
    execute format('drop policy if exists %1$s_upd on %1$s; create policy %1$s_upd on %1$s for update using (can_manage(created_by, %2$s)) with check (can_manage(created_by, %2$s));', r.t, r.n);
    execute format('drop policy if exists %1$s_del on %1$s; create policy %1$s_del on %1$s for delete using (can_manage(created_by, %2$s));', r.t, r.n);
  end loop;
end $$;

-- funding: citire publică, scriere doar staff
drop policy if exists fund_sel on funding_opportunities; create policy fund_sel on funding_opportunities for select using (status='published' or is_staff());
drop policy if exists fund_wr on funding_opportunities;  create policy fund_wr on funding_opportunities for all using (is_staff()) with check (is_staff());

-- registrations
drop policy if exists reg_sel on event_registrations;
create policy reg_sel on event_registrations for select using (
  user_id = auth.uid() or is_staff() or exists (select 1 from events e where e.id = event_id and can_manage(e.created_by, e.ngo_id)));
drop policy if exists reg_ins on event_registrations;
create policy reg_ins on event_registrations for insert with check (
  user_id = auth.uid() and exists (select 1 from events e where e.id = event_id and e.status='published'));
drop policy if exists reg_upd on event_registrations; create policy reg_upd on event_registrations for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists reg_del on event_registrations; create policy reg_del on event_registrations for delete using (user_id = auth.uid());

-- collaboration responses
drop policy if exists cr_sel on collaboration_responses;
create policy cr_sel on collaboration_responses for select using (
  user_id = auth.uid() or is_staff() or exists (select 1 from collaborations c where c.id = collaboration_id and can_manage(c.created_by, c.ngo_id)));
drop policy if exists cr_ins on collaboration_responses;
create policy cr_ins on collaboration_responses for insert with check (
  user_id = auth.uid() and exists (select 1 from collaborations c where c.id = collaboration_id and c.status='published' and c.is_open));
drop policy if exists cr_upd on collaboration_responses;
create policy cr_upd on collaboration_responses for update using (
  exists (select 1 from collaborations c where c.id = collaboration_id and can_manage(c.created_by, c.ngo_id)));

-- saved_funding, post_likes, follows: doar rândurile proprii
do $$ declare t text; begin
  foreach t in array array['saved_funding','follows'] loop
    execute format('drop policy if exists %1$s_own on %1$s; create policy %1$s_own on %1$s for all using (user_id = auth.uid()) with check (user_id = auth.uid());', t);
  end loop;
end $$;
drop policy if exists likes_sel on post_likes; create policy likes_sel on post_likes for select using (true);
drop policy if exists likes_ins on post_likes; create policy likes_ins on post_likes for insert with check (user_id = auth.uid());
drop policy if exists likes_del on post_likes; create policy likes_del on post_likes for delete using (user_id = auth.uid());

-- posts / comments
drop policy if exists posts_sel on posts; create policy posts_sel on posts for select using (status='published' or author_id = auth.uid() or is_staff());
drop policy if exists posts_ins on posts; create policy posts_ins on posts for insert with check (author_id = auth.uid() and status = 'published');
drop policy if exists posts_upd on posts; create policy posts_upd on posts for update using (author_id = auth.uid() or is_staff()) with check (author_id = auth.uid() or is_staff());
drop policy if exists posts_del on posts; create policy posts_del on posts for delete using (author_id = auth.uid() or is_staff());

drop policy if exists com_sel on comments; create policy com_sel on comments for select using (status='published' or user_id = auth.uid() or is_staff());
drop policy if exists com_ins on comments; create policy com_ins on comments for insert with check (user_id = auth.uid() and status = 'published');
drop policy if exists com_upd on comments; create policy com_upd on comments for update using (user_id = auth.uid() or is_staff());
drop policy if exists com_del on comments; create policy com_del on comments for delete using (user_id = auth.uid() or is_staff());

-- notifications: citire/marcare citit doar proprii; inserarea se face din triggere
drop policy if exists notif_sel on notifications; create policy notif_sel on notifications for select using (user_id = auth.uid());
drop policy if exists notif_upd on notifications; create policy notif_upd on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- reports
drop policy if exists rep_ins on reports; create policy rep_ins on reports for insert with check (reporter_id = auth.uid());
drop policy if exists rep_sel on reports; create policy rep_sel on reports for select using (reporter_id = auth.uid() or is_staff());
drop policy if exists rep_upd on reports; create policy rep_upd on reports for update using (is_staff());

-- Primul admin (rulează manual din SQL Editor, cu UUID-ul tău):
-- insert into user_roles (user_id, role) values ('<UUID_UTILIZATOR>', 'admin');