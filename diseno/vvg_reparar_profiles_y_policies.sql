-- VVG - Reparacion de perfiles y policies basicas
-- Ejecutar una vez en Supabase SQL Editor si:
-- - Authentication muestra usuarios que no aparecen en public.profiles.
-- - La pantalla "Agregar amigos" muestra menos perfiles de los esperados.
-- - El cambio de alias no persiste.

insert into public.profiles (
  id,
  email,
  nombre,
  alias,
  descripcion,
  avatar_color,
  created_at,
  updated_at
)
select
  u.id,
  coalesce(u.email, u.id::text),
  coalesce(
    nullif(u.raw_user_meta_data->>'nombre', ''),
    nullif(u.raw_user_meta_data->>'name', ''),
    split_part(coalesce(u.email, u.id::text), '@', 1)
  ),
  coalesce(
    nullif(u.raw_user_meta_data->>'alias', ''),
    split_part(coalesce(u.email, u.id::text), '@', 1)
  ),
  coalesce(u.raw_user_meta_data->>'descripcion', ''),
  coalesce(nullif(u.raw_user_meta_data->>'avatar_color', ''), '#5b5fc7'),
  now(),
  now()
from auth.users u
on conflict (id) do update set
  email = excluded.email,
  nombre = coalesce(nullif(public.profiles.nombre, ''), excluded.nombre),
  alias = coalesce(nullif(public.profiles.alias, ''), excluded.alias),
  descripcion = coalesce(public.profiles.descripcion, excluded.descripcion),
  avatar_color = coalesce(nullif(public.profiles.avatar_color, ''), excluded.avatar_color),
  updated_at = now();

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.friendships to authenticated;

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;

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

select
  (select count(*) from auth.users) as auth_users,
  (select count(*) from public.profiles) as profiles;
