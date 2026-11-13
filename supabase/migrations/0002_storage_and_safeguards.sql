-- Youth Suceava — Storage, indexuri, căutare, limite anti-abuz (v1)

-- ========== Indexuri + căutare ==========
create extension if not exists pg_trgm;

create index if not exists ngos_status_cat_idx      on ngos (status, category);
create index if not exists ngos_name_trgm           on ngos using gin (name gin_trgm_ops);
create index if not exists people_status_idx        on people (status);
create index if not exists people_name_trgm         on people using gin (name gin_trgm_ops);
create index if not exists projects_ngo_idx         on projects (ngo_id, status);
create index if not exists events_status_start_idx  on events (status, starts_at);
create index if not exists events_title_trgm        on events using gin (title gin_trgm_ops);
create index if not exists collab_status_type_idx   on collaborations (status, type, is_open);
create index if not exists funding_status_dl_idx    on funding_opportunities (status, deadline);
create index if not exists resources_status_type    on resources (status, type);
create index if not exists reg_user_idx             on event_registrations (user_id);
create index if not exists cresp_collab_idx         on collaboration_responses (collaboration_id);
create index if not exists follows_user_idx         on follows (user_id);

-- ========== Limite anti-abuz ==========
create or replace function limit_submissions() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null or is_staff() then return new; end if;
  execute format('select count(*) from %I where created_by = $1 and created_at > now() - interval ''24 hours''', tg_table_name)
    into n using auth.uid();
  if n >= 10 then
    raise exception 'Ai atins limita de 10 trimiteri pe zi pentru această secțiune.';
  end if;
  return new;
end $$;

create or replace function limit_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; col text; lim int;
begin
  if auth.uid() is null or is_staff() then return new; end if;
  col := case tg_table_name when 'posts' then 'author_id' else 'user_id' end;
  lim := case tg_table_name when 'posts' then 20 else 60 end;
  execute format('select count(*) from %I where %I = $1 and created_at > now() - interval ''1 hour''', tg_table_name, col)
    into n using auth.uid();
  if n >= lim then raise exception 'Prea multe acțiuni într-un interval scurt. Încearcă mai târziu.'; end if;
  return new;
end $$;

do $$ declare t text; begin
  foreach t in array array['ngos','people','projects','events','collaborations','resources'] loop
    execute format('drop trigger if exists %1$s_limit on %1$s; create trigger %1$s_limit before insert on %1$s for each row execute function limit_submissions();', t);
  end loop;
  foreach t in array array['posts','comments'] loop
    execute format('drop trigger if exists %1$s_rate on %1$s; create trigger %1$s_rate before insert on %1$s for each row execute function limit_activity();', t);
  end loop;
end $$;

-- ========== Storage ==========
-- Convenție de cale: <user_id>/<nume-fișier>. Doar proprietarul scrie în folderul lui.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars',        'avatars',        true, 2097152,  array['image/jpeg','image/png','image/webp']),
  ('ngo-logos',      'ngo-logos',      true, 2097152,  array['image/jpeg','image/png','image/webp','image/svg+xml']),
  ('event-images',   'event-images',   true, 5242880,  array['image/jpeg','image/png','image/webp']),
  ('resource-files', 'resource-files', true, 15728640, array['application/pdf','image/jpeg','image/png','text/csv',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

do $$ declare b text; begin
  foreach b in array array['avatars','ngo-logos','event-images','resource-files'] loop
    execute format('drop policy if exists "%1$s_read" on storage.objects; create policy "%1$s_read" on storage.objects for select using (bucket_id = %2$L);', b, b);
    execute format('drop policy if exists "%1$s_ins" on storage.objects; create policy "%1$s_ins" on storage.objects for insert to authenticated with check (bucket_id = %2$L and (storage.foldername(name))[1] = auth.uid()::text);', b, b);
    execute format('drop policy if exists "%1$s_upd" on storage.objects; create policy "%1$s_upd" on storage.objects for update to authenticated using (bucket_id = %2$L and (storage.foldername(name))[1] = auth.uid()::text);', b, b);
    execute format('drop policy if exists "%1$s_del" on storage.objects; create policy "%1$s_del" on storage.objects for delete to authenticated using (bucket_id = %2$L and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));', b, b);
  end loop;
end $$;

-- Coloane pentru imagini
alter table ngos   add column if not exists logo_url  text check (logo_url  is null or logo_url  ~* '^https?://');
alter table events add column if not exists image_url text check (image_url is null or image_url ~* '^https?://');