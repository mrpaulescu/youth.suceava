-- Youth Suceava — optional guest event registration (v1)
-- Browsing and event RSVP remain available without creating an account.
-- Guest contact details are insert-only for anonymous visitors and are not publicly readable.

alter table public.event_registrations alter column user_id drop not null;

create unique index if not exists event_guest_email_uq
  on public.event_registrations (event_id, lower(email))
  where user_id is null and email is not null;

drop policy if exists reg_ins on public.event_registrations;
create policy reg_ins on public.event_registrations
for insert to anon, authenticated
with check (
  (
    (auth.uid() is not null and user_id = auth.uid())
    or
    (
      auth.uid() is null
      and user_id is null
      and full_name is not null
      and char_length(trim(full_name)) between 2 and 160
      and email is not null
      and email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    )
  )
  and exists (
    select 1 from public.events e
    where e.id = event_id
      and e.status = 'published'
      and (e.registration_deadline is null or e.registration_deadline > now())
  )
);

create or replace function public.enforce_event_capacity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  event_capacity integer;
  current_count integer;
begin
  select capacity into event_capacity
  from public.events where id = new.event_id for update;
  if not found then raise exception 'Evenimentul nu există.'; end if;

  if event_capacity is not null then
    select count(*) into current_count
    from public.event_registrations
    where event_id = new.event_id
      and status = 'registered'
      and (tg_op = 'INSERT' or id <> new.id);

    if current_count >= event_capacity then
      raise exception 'Nu mai sunt locuri disponibile la acest eveniment.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists event_registration_capacity on public.event_registrations;
create trigger event_registration_capacity
before insert or update of event_id, status on public.event_registrations
for each row execute function public.enforce_event_capacity();

grant insert on public.event_registrations to anon, authenticated;
