-- VVG - Supabase schema
-- Ejecutar en Supabase SQL Editor sobre un proyecto nuevo.
-- Incluye tablas, indices, triggers, vistas derivadas, RLS base y bucket de fotos.

create extension if not exists pgcrypto;

do $$
begin
  create type public.activity_type as enum ('viaje', 'salida');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.friendship_status as enum ('pending', 'accepted', 'blocked');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.member_role as enum ('owner', 'member');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.expense_split_method as enum ('equal', 'exact', 'percentage', 'weighted');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.payment_status as enum ('pending', 'paid', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.chat_type as enum ('dm', 'grupo');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.chat_role as enum ('member', 'admin');
exception when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  nombre text not null,
  alias text not null,
  descripcion text,
  avatar_color text not null default '#5b5fc7',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.friendships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  status public.friendship_status not null default 'accepted',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (user_id, friend_id),
  constraint friendships_no_self check (user_id <> friend_id),
  constraint friendships_requested_by_pair check (requested_by = user_id or requested_by = friend_id),
  constraint friendships_normalized_pair check (user_id < friend_id)
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  nombre text not null,
  descripcion text not null default '',
  tipo public.activity_type not null,
  fecha_inicio date not null,
  fecha_fin date,
  finalizado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_fecha_fin_valid check (fecha_fin is null or fecha_fin >= fecha_inicio)
);

create table if not exists public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'member',
  added_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (trip_id, user_id)
);

create table if not exists public.trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  token text not null unique,
  created_by uuid not null references public.profiles(id),
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  uses_count integer not null default 0 check (uses_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  titulo text not null,
  monto numeric(12,2) not null check (monto > 0),
  moneda char(3) not null default 'CLP',
  pagado_por uuid not null references public.profiles(id),
  fecha date not null,
  metodo_reparto public.expense_split_method not null default 'equal',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint expenses_payer_is_trip_member
    foreign key (trip_id, pagado_por) references public.trip_members(trip_id, user_id),
  constraint expenses_creator_is_trip_member
    foreign key (trip_id, created_by) references public.trip_members(trip_id, user_id)
);

create table if not exists public.expense_participants (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  weight numeric(10,4) not null default 1 check (weight > 0),
  share_amount numeric(12,2),
  share_percentage numeric(5,2),
  created_at timestamptz not null default now(),
  primary key (expense_id, user_id),
  constraint expense_participants_share_amount_valid check (share_amount is null or share_amount >= 0),
  constraint expense_participants_share_percentage_valid check (
    share_percentage is null or (share_percentage >= 0 and share_percentage <= 100)
  )
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  from_user_id uuid not null references public.profiles(id),
  to_user_id uuid not null references public.profiles(id),
  monto numeric(12,2) not null check (monto > 0),
  status public.payment_status not null default 'pending',
  created_by uuid not null references public.profiles(id),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_no_self check (from_user_id <> to_user_id),
  constraint payments_from_is_trip_member
    foreign key (trip_id, from_user_id) references public.trip_members(trip_id, user_id),
  constraint payments_to_is_trip_member
    foreign key (trip_id, to_user_id) references public.trip_members(trip_id, user_id),
  constraint payments_creator_is_trip_member
    foreign key (trip_id, created_by) references public.trip_members(trip_id, user_id)
);

create table if not exists public.trip_photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  storage_path text not null unique,
  uploaded_by uuid not null references public.profiles(id),
  fecha timestamptz not null default now(),
  caption text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint trip_photos_uploader_is_trip_member
    foreign key (trip_id, uploaded_by) references public.trip_members(trip_id, user_id)
);

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  tipo public.chat_type not null,
  nombre text,
  trip_id uuid unique references public.trips(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chats_group_name_or_trip check (tipo = 'dm' or nombre is not null or trip_id is not null),
  constraint chats_dm_without_trip check (tipo <> 'dm' or trip_id is null)
);

create table if not exists public.chat_members (
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.chat_role not null default 'member',
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  muted_until timestamptz,
  primary key (chat_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  texto text not null,
  fecha timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint messages_sender_is_chat_member
    foreign key (chat_id, sender_id) references public.chat_members(chat_id, user_id)
);

create or replace function public.validate_expense_participant_member()
returns trigger
language plpgsql
as $$
declare
  expense_trip_id uuid;
begin
  select e.trip_id
  into expense_trip_id
  from public.expenses e
  where e.id = new.expense_id;

  if expense_trip_id is null then
    raise exception 'Expense % does not exist', new.expense_id;
  end if;

  if not exists (
    select 1
    from public.trip_members tm
    where tm.trip_id = expense_trip_id
      and tm.user_id = new.user_id
      and tm.left_at is null
  ) then
    raise exception 'User % is not an active member of trip %', new.user_id, expense_trip_id;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_expense_participant_member on public.expense_participants;
create trigger validate_expense_participant_member
before insert or update on public.expense_participants
for each row execute function public.validate_expense_participant_member();

create or replace function public.validate_chat_member_trip_member()
returns trigger
language plpgsql
as $$
declare
  chat_trip_id uuid;
begin
  select c.trip_id
  into chat_trip_id
  from public.chats c
  where c.id = new.chat_id;

  if chat_trip_id is not null and not exists (
    select 1
    from public.trip_members tm
    where tm.trip_id = chat_trip_id
      and tm.user_id = new.user_id
      and tm.left_at is null
  ) then
    raise exception 'User % is not an active member of trip %', new.user_id, chat_trip_id;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_chat_member_trip_member on public.chat_members;
create trigger validate_chat_member_trip_member
before insert or update on public.chat_members
for each row execute function public.validate_chat_member_trip_member();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_trips_updated_at on public.trips;
create trigger set_trips_updated_at
before update on public.trips
for each row execute function public.set_updated_at();

drop trigger if exists set_expenses_updated_at on public.expenses;
create trigger set_expenses_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

drop trigger if exists set_chats_updated_at on public.chats;
create trigger set_chats_updated_at
before update on public.chats
for each row execute function public.set_updated_at();

create index if not exists idx_profiles_alias on public.profiles(alias);
create index if not exists idx_friendships_friend_id on public.friendships(friend_id);
create index if not exists idx_friendships_status on public.friendships(status);
create index if not exists idx_trips_owner_id on public.trips(owner_id);
create index if not exists idx_trip_members_user_id on public.trip_members(user_id);
create index if not exists idx_trip_invites_trip_id on public.trip_invites(trip_id);
create index if not exists idx_expenses_trip_date on public.expenses(trip_id, fecha desc);
create index if not exists idx_expenses_pagado_por on public.expenses(pagado_por);
create index if not exists idx_expense_participants_user_id on public.expense_participants(user_id);
create index if not exists idx_payments_trip_status on public.payments(trip_id, status);
create index if not exists idx_payments_from_user_id on public.payments(from_user_id);
create index if not exists idx_payments_to_user_id on public.payments(to_user_id);
create index if not exists idx_trip_photos_trip_date on public.trip_photos(trip_id, fecha desc);
create index if not exists idx_chats_trip_id on public.chats(trip_id);
create index if not exists idx_chat_members_user_id on public.chat_members(user_id);
create index if not exists idx_messages_chat_date on public.messages(chat_id, fecha);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fallback_name text;
begin
  fallback_name := coalesce(split_part(new.email, '@', 1), new.id::text);

  insert into public.profiles (
    id,
    email,
    nombre,
    alias,
    descripcion,
    avatar_color
  )
  values (
    new.id,
    coalesce(new.email, new.id::text),
    coalesce(new.raw_user_meta_data->>'nombre', new.raw_user_meta_data->>'name', fallback_name),
    coalesce(new.raw_user_meta_data->>'alias', fallback_name),
    coalesce(new.raw_user_meta_data->>'descripcion', ''),
    coalesce(new.raw_user_meta_data->>'avatar_color', '#5b5fc7')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_trip_member(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trip_members tm
    where tm.trip_id = p_trip_id
      and tm.user_id = auth.uid()
      and tm.left_at is null
  );
$$;

create or replace function public.is_trip_owner(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trips t
    where t.id = p_trip_id
      and t.owner_id = auth.uid()
  );
$$;

create or replace function public.can_access_expense(p_expense_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.expenses e
    join public.trip_members tm
      on tm.trip_id = e.trip_id
     and tm.user_id = auth.uid()
     and tm.left_at is null
    where e.id = p_expense_id
      and e.deleted_at is null
  );
$$;

create or replace function public.is_chat_member(p_chat_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_members cm
    where cm.chat_id = p_chat_id
      and cm.user_id = auth.uid()
  );
$$;

create or replace function public.can_manage_chat(p_chat_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chats c
    where c.id = p_chat_id
      and (
        c.created_by = auth.uid()
        or (c.trip_id is not null and public.is_trip_owner(c.trip_id))
      )
  );
$$;

create or replace function public.storage_trip_id(object_name text)
returns uuid
language plpgsql
stable
as $$
begin
  return split_part(object_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

revoke all on function public.is_trip_member(uuid) from public;
revoke all on function public.is_trip_owner(uuid) from public;
revoke all on function public.can_access_expense(uuid) from public;
revoke all on function public.is_chat_member(uuid) from public;
revoke all on function public.can_manage_chat(uuid) from public;
revoke all on function public.storage_trip_id(text) from public;
grant execute on function public.is_trip_member(uuid) to authenticated;
grant execute on function public.is_trip_owner(uuid) to authenticated;
grant execute on function public.can_access_expense(uuid) to authenticated;
grant execute on function public.is_chat_member(uuid) to authenticated;
grant execute on function public.can_manage_chat(uuid) to authenticated;
grant execute on function public.storage_trip_id(text) to authenticated;

create or replace view public.v_expense_shares
with (security_invoker = true)
as
select
  ep.expense_id,
  e.trip_id,
  ep.user_id,
  round(
    case e.metodo_reparto
      when 'exact' then coalesce(ep.share_amount, 0)
      when 'percentage' then e.monto * coalesce(ep.share_percentage, 0) / 100
      when 'weighted' then e.monto * ep.weight / nullif(stats.total_weight, 0)
      else e.monto / nullif(stats.participants_count, 0)
    end,
    2
  )::numeric(12,2) as share_amount
from public.expense_participants ep
join public.expenses e on e.id = ep.expense_id
join lateral (
  select
    count(*)::numeric as participants_count,
    sum(ep2.weight)::numeric as total_weight
  from public.expense_participants ep2
  where ep2.expense_id = ep.expense_id
) stats on true
where e.deleted_at is null;

create or replace view public.v_trip_balances
with (security_invoker = true)
as
select
  tm.trip_id,
  tm.user_id,
  coalesce(sum(e.monto) filter (where e.pagado_por = tm.user_id), 0)::numeric(12,2) as pagado,
  coalesce(sum(es.share_amount), 0)::numeric(12,2) as parte,
  (
    coalesce(sum(e.monto) filter (where e.pagado_por = tm.user_id), 0)
    - coalesce(sum(es.share_amount), 0)
  )::numeric(12,2) as neto
from public.trip_members tm
left join public.expenses e
  on e.trip_id = tm.trip_id
 and e.deleted_at is null
left join public.v_expense_shares es
  on es.expense_id = e.id
 and es.user_id = tm.user_id
where tm.left_at is null
group by tm.trip_id, tm.user_id;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.v_expense_shares to authenticated;
grant select on public.v_trip_balances to authenticated;

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_invites enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_participants enable row level security;
alter table public.payments enable row level security;
alter table public.trip_photos enable row level security;
alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;

drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated
on public.profiles for select
to authenticated
using (true);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists friendships_select_pair on public.friendships;
create policy friendships_select_pair
on public.friendships for select
to authenticated
using (auth.uid() = user_id or auth.uid() = friend_id);

drop policy if exists friendships_insert_pair on public.friendships;
create policy friendships_insert_pair
on public.friendships for insert
to authenticated
with check (
  (auth.uid() = user_id or auth.uid() = friend_id)
  and requested_by = auth.uid()
);

drop policy if exists friendships_update_pair on public.friendships;
create policy friendships_update_pair
on public.friendships for update
to authenticated
using (auth.uid() = user_id or auth.uid() = friend_id)
with check (auth.uid() = user_id or auth.uid() = friend_id);

drop policy if exists friendships_delete_pair on public.friendships;
create policy friendships_delete_pair
on public.friendships for delete
to authenticated
using (auth.uid() = user_id or auth.uid() = friend_id);

drop policy if exists trips_select_members on public.trips;
create policy trips_select_members
on public.trips for select
to authenticated
using (owner_id = auth.uid() or public.is_trip_member(id));

drop policy if exists trips_insert_owner on public.trips;
create policy trips_insert_owner
on public.trips for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists trips_update_owner on public.trips;
create policy trips_update_owner
on public.trips for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists trips_delete_owner on public.trips;
create policy trips_delete_owner
on public.trips for delete
to authenticated
using (owner_id = auth.uid());

drop policy if exists trip_members_select_trip_members on public.trip_members;
create policy trip_members_select_trip_members
on public.trip_members for select
to authenticated
using (public.is_trip_member(trip_id) or public.is_trip_owner(trip_id));

drop policy if exists trip_members_insert_owner on public.trip_members;
create policy trip_members_insert_owner
on public.trip_members for insert
to authenticated
with check (public.is_trip_owner(trip_id));

drop policy if exists trip_members_update_owner on public.trip_members;
create policy trip_members_update_owner
on public.trip_members for update
to authenticated
using (public.is_trip_owner(trip_id))
with check (public.is_trip_owner(trip_id));

drop policy if exists trip_members_delete_owner on public.trip_members;
create policy trip_members_delete_owner
on public.trip_members for delete
to authenticated
using (public.is_trip_owner(trip_id));

drop policy if exists trip_invites_select_members on public.trip_invites;
create policy trip_invites_select_members
on public.trip_invites for select
to authenticated
using (public.is_trip_member(trip_id) or public.is_trip_owner(trip_id));

drop policy if exists trip_invites_insert_owner on public.trip_invites;
create policy trip_invites_insert_owner
on public.trip_invites for insert
to authenticated
with check (public.is_trip_owner(trip_id) and created_by = auth.uid());

drop policy if exists trip_invites_update_owner on public.trip_invites;
create policy trip_invites_update_owner
on public.trip_invites for update
to authenticated
using (public.is_trip_owner(trip_id))
with check (public.is_trip_owner(trip_id));

drop policy if exists trip_invites_delete_owner on public.trip_invites;
create policy trip_invites_delete_owner
on public.trip_invites for delete
to authenticated
using (public.is_trip_owner(trip_id));

drop policy if exists expenses_select_members on public.expenses;
create policy expenses_select_members
on public.expenses for select
to authenticated
using (public.is_trip_member(trip_id));

drop policy if exists expenses_insert_members on public.expenses;
create policy expenses_insert_members
on public.expenses for insert
to authenticated
with check (public.is_trip_member(trip_id) and created_by = auth.uid());

drop policy if exists expenses_update_creator_or_owner on public.expenses;
create policy expenses_update_creator_or_owner
on public.expenses for update
to authenticated
using (public.is_trip_member(trip_id) and (created_by = auth.uid() or public.is_trip_owner(trip_id)))
with check (public.is_trip_member(trip_id));

drop policy if exists expenses_delete_creator_or_owner on public.expenses;
create policy expenses_delete_creator_or_owner
on public.expenses for delete
to authenticated
using (public.is_trip_member(trip_id) and (created_by = auth.uid() or public.is_trip_owner(trip_id)));

drop policy if exists expense_participants_select_members on public.expense_participants;
create policy expense_participants_select_members
on public.expense_participants for select
to authenticated
using (public.can_access_expense(expense_id));

drop policy if exists expense_participants_insert_members on public.expense_participants;
create policy expense_participants_insert_members
on public.expense_participants for insert
to authenticated
with check (public.can_access_expense(expense_id));

drop policy if exists expense_participants_update_members on public.expense_participants;
create policy expense_participants_update_members
on public.expense_participants for update
to authenticated
using (public.can_access_expense(expense_id))
with check (public.can_access_expense(expense_id));

drop policy if exists expense_participants_delete_members on public.expense_participants;
create policy expense_participants_delete_members
on public.expense_participants for delete
to authenticated
using (public.can_access_expense(expense_id));

drop policy if exists payments_select_members on public.payments;
create policy payments_select_members
on public.payments for select
to authenticated
using (public.is_trip_member(trip_id));

drop policy if exists payments_insert_members on public.payments;
create policy payments_insert_members
on public.payments for insert
to authenticated
with check (public.is_trip_member(trip_id) and created_by = auth.uid());

drop policy if exists payments_update_involved_or_owner on public.payments;
create policy payments_update_involved_or_owner
on public.payments for update
to authenticated
using (
  public.is_trip_member(trip_id)
  and (
    created_by = auth.uid()
    or from_user_id = auth.uid()
    or to_user_id = auth.uid()
    or public.is_trip_owner(trip_id)
  )
)
with check (public.is_trip_member(trip_id));

drop policy if exists payments_delete_creator_or_owner on public.payments;
create policy payments_delete_creator_or_owner
on public.payments for delete
to authenticated
using (public.is_trip_member(trip_id) and (created_by = auth.uid() or public.is_trip_owner(trip_id)));

drop policy if exists trip_photos_select_members on public.trip_photos;
create policy trip_photos_select_members
on public.trip_photos for select
to authenticated
using (public.is_trip_member(trip_id));

drop policy if exists trip_photos_insert_members on public.trip_photos;
create policy trip_photos_insert_members
on public.trip_photos for insert
to authenticated
with check (public.is_trip_member(trip_id) and uploaded_by = auth.uid());

drop policy if exists trip_photos_update_uploader_or_owner on public.trip_photos;
create policy trip_photos_update_uploader_or_owner
on public.trip_photos for update
to authenticated
using (public.is_trip_member(trip_id) and (uploaded_by = auth.uid() or public.is_trip_owner(trip_id)))
with check (public.is_trip_member(trip_id));

drop policy if exists trip_photos_delete_uploader_or_owner on public.trip_photos;
create policy trip_photos_delete_uploader_or_owner
on public.trip_photos for delete
to authenticated
using (public.is_trip_member(trip_id) and (uploaded_by = auth.uid() or public.is_trip_owner(trip_id)));

drop policy if exists chats_select_members on public.chats;
create policy chats_select_members
on public.chats for select
to authenticated
using (created_by = auth.uid() or public.is_chat_member(id));

drop policy if exists chats_insert_creator on public.chats;
create policy chats_insert_creator
on public.chats for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists chats_update_creator_or_member on public.chats;
create policy chats_update_creator_or_member
on public.chats for update
to authenticated
using (created_by = auth.uid() or public.can_manage_chat(id) or public.is_chat_member(id))
with check (created_by = auth.uid() or public.can_manage_chat(id) or public.is_chat_member(id));

drop policy if exists chats_delete_creator on public.chats;
create policy chats_delete_creator
on public.chats for delete
to authenticated
using (created_by = auth.uid() or public.can_manage_chat(id));

drop policy if exists chat_members_select_members on public.chat_members;
create policy chat_members_select_members
on public.chat_members for select
to authenticated
using (public.is_chat_member(chat_id));

drop policy if exists chat_members_insert_creator_or_self on public.chat_members;
create policy chat_members_insert_creator_or_self
on public.chat_members for insert
to authenticated
with check (public.can_manage_chat(chat_id));

drop policy if exists chat_members_update_creator_or_self on public.chat_members;
create policy chat_members_update_creator_or_self
on public.chat_members for update
to authenticated
using (user_id = auth.uid() or public.can_manage_chat(chat_id))
with check (user_id = auth.uid() or public.can_manage_chat(chat_id));

drop policy if exists chat_members_delete_creator_or_self on public.chat_members;
create policy chat_members_delete_creator_or_self
on public.chat_members for delete
to authenticated
using (user_id = auth.uid() or public.can_manage_chat(chat_id));

drop policy if exists messages_select_chat_members on public.messages;
create policy messages_select_chat_members
on public.messages for select
to authenticated
using (public.is_chat_member(chat_id));

drop policy if exists messages_insert_chat_members on public.messages;
create policy messages_insert_chat_members
on public.messages for insert
to authenticated
with check (public.is_chat_member(chat_id) and sender_id = auth.uid());

drop policy if exists messages_update_sender on public.messages;
create policy messages_update_sender
on public.messages for update
to authenticated
using (public.is_chat_member(chat_id) and sender_id = auth.uid())
with check (public.is_chat_member(chat_id) and sender_id = auth.uid());

drop policy if exists messages_delete_sender on public.messages;
create policy messages_delete_sender
on public.messages for delete
to authenticated
using (public.is_chat_member(chat_id) and sender_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('trip-photos', 'trip-photos', false)
on conflict (id) do nothing;

drop policy if exists storage_trip_photos_select on storage.objects;
create policy storage_trip_photos_select
on storage.objects for select
to authenticated
using (
  bucket_id = 'trip-photos'
  and public.is_trip_member(public.storage_trip_id(name))
);

drop policy if exists storage_trip_photos_insert on storage.objects;
create policy storage_trip_photos_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'trip-photos'
  and public.is_trip_member(public.storage_trip_id(name))
);

drop policy if exists storage_trip_photos_update on storage.objects;
create policy storage_trip_photos_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'trip-photos'
  and public.is_trip_member(public.storage_trip_id(name))
)
with check (
  bucket_id = 'trip-photos'
  and public.is_trip_member(public.storage_trip_id(name))
);

drop policy if exists storage_trip_photos_delete on storage.objects;
create policy storage_trip_photos_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'trip-photos'
  and public.is_trip_member(public.storage_trip_id(name))
);
