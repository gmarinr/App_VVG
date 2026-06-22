# Propuesta de base de datos Supabase para VVG

Este documento baja el modelo actual del frontend a una estructura relacional para PostgreSQL/Supabase. La app hoy guarda arreglos en `localStorage` (`friendIds`, `memberIds`, `participantes`), pero en Supabase conviene convertirlos en tablas puente para poder aplicar llaves foraneas, consultas eficientes y Row Level Security.

## Revision del diseno actual

El archivo `DiseñoBBDD.drawio` sirve como primer boceto, pero no deberia usarse tal cual para Supabase.

- `Contrasena` no debe estar en una tabla propia de la app. Supabase Auth gestiona credenciales en `auth.users`.
- `Amigos (REVISAR)` debe ser una tabla de relaciones entre usuarios, no un campo de `Usuarios`.
- `UsuariosViaje` debe ser `trip_members`, una tabla puente entre viajes y usuarios.
- `UsuariosGasto` debe ser `expense_participants`, una tabla puente entre gastos y usuarios participantes.
- `IDTransaccion` dentro de viaje no corresponde si un viaje tiene muchos gastos; la relacion correcta es `expenses.trip_id`.
- Las fotos no deberian guardarse como base64 en la tabla. En Supabase se guarda el archivo en Storage y la tabla conserva el `storage_path`.
- Chats necesita al menos tres tablas: `chats`, `chat_members` y `messages`.
- Los balances y liquidaciones se calculan desde gastos y participantes. No conviene persistirlos como verdad principal; solo se deberian guardar pagos reales marcados como hechos.

## Principios recomendados

- Usar `uuid` como PK en todas las entidades principales.
- Usar `profiles.id` como espejo 1:1 de `auth.users.id`.
- Usar `numeric(12,2)` para montos de dinero.
- Usar `date` para fechas de viaje/gasto cuando el usuario solo elige dia.
- Usar `timestamptz` para auditoria (`created_at`, `updated_at`, `paid_at`, etc.).
- Mantener balances como datos derivados por servicio, vista SQL o RPC.
- Habilitar RLS en todas las tablas publicas y dar acceso por pertenencia a viaje/chat.

## Modelo recomendado

### 1. `profiles`

Perfil publico/privado de cada usuario autenticado.

| Campo | Tipo | Llave | Nota |
| --- | --- | --- | --- |
| `id` | `uuid` | PK/FK | Referencia `auth.users(id)` |
| `email` | `text` | UNIQUE | Copia util para busqueda; Auth sigue siendo fuente de verdad |
| `nombre` | `text` |  | Nombre completo |
| `alias` | `text` |  | Nombre corto visible |
| `descripcion` | `text` |  | Bio opcional |
| `avatar_color` | `text` |  | Color actual del avatar de iniciales |
| `avatar_path` | `text` |  | Ruta opcional en Supabase Storage |
| `created_at` | `timestamptz` |  | Default `now()` |
| `updated_at` | `timestamptz` |  | Mantener con trigger |

No guardar `password`.

### 2. `friendships`

Relacion de amistad entre dos usuarios. Permite soportar el MVP actual y, mas adelante, solicitudes pendientes.

| Campo | Tipo | Llave | Nota |
| --- | --- | --- | --- |
| `user_id` | `uuid` | PK/FK | Menor UUID del par o primer lado normalizado |
| `friend_id` | `uuid` | PK/FK | Mayor UUID del par o segundo lado normalizado |
| `requested_by` | `uuid` | FK | Usuario que inicio la solicitud |
| `status` | `text` |  | `pending`, `accepted`, `blocked` |
| `created_at` | `timestamptz` |  | Default `now()` |
| `accepted_at` | `timestamptz` |  | Nulo hasta aceptar |

Restricciones recomendadas: `user_id <> friend_id`, `requested_by in (user_id, friend_id)` y un unico registro por par.

### 3. `trips`

Viajes y salidas comparten la misma tabla, como ya ocurre en el frontend con `ActivityType`.

| Campo | Tipo | Llave | Nota |
| --- | --- | --- | --- |
| `id` | `uuid` | PK |  |
| `owner_id` | `uuid` | FK | Creador/administrador principal |
| `nombre` | `text` |  |  |
| `descripcion` | `text` |  |  |
| `tipo` | `text` |  | `viaje` o `salida` |
| `fecha_inicio` | `date` |  |  |
| `fecha_fin` | `date` |  | Opcional |
| `finalizado` | `boolean` |  | Default `false` |
| `created_at` | `timestamptz` |  | Default `now()` |
| `updated_at` | `timestamptz` |  | Mantener con trigger |

### 4. `trip_members`

Reemplaza `Trip.memberIds`.

| Campo | Tipo | Llave | Nota |
| --- | --- | --- | --- |
| `trip_id` | `uuid` | PK/FK | Referencia `trips(id)` |
| `user_id` | `uuid` | PK/FK | Referencia `profiles(id)` |
| `role` | `text` |  | `owner`, `member` |
| `added_by` | `uuid` | FK | Usuario que agrego al miembro |
| `joined_at` | `timestamptz` |  | Default `now()` |
| `left_at` | `timestamptz` |  | Opcional para bajas sin borrar historial |

Para el MVP, el owner tambien debe existir como miembro con `role = 'owner'`.

### 5. `trip_invites`

Opcional, pero encaja con el boton actual de generar enlace.

| Campo | Tipo | Llave | Nota |
| --- | --- | --- | --- |
| `id` | `uuid` | PK |  |
| `trip_id` | `uuid` | FK | Viaje invitado |
| `token` | `text` | UNIQUE | Parte publica del link |
| `created_by` | `uuid` | FK | Usuario que genero el link |
| `expires_at` | `timestamptz` |  | Opcional |
| `max_uses` | `integer` |  | Opcional |
| `uses_count` | `integer` |  | Default `0` |
| `is_active` | `boolean` |  | Default `true` |
| `created_at` | `timestamptz` |  | Default `now()` |

### 6. `expenses`

Gastos registrados dentro de un viaje/salida.

| Campo | Tipo | Llave | Nota |
| --- | --- | --- | --- |
| `id` | `uuid` | PK |  |
| `trip_id` | `uuid` | FK | Referencia `trips(id)` |
| `titulo` | `text` |  |  |
| `monto` | `numeric(12,2)` |  | Debe ser mayor que cero |
| `moneda` | `char(3)` |  | Default `CLP` |
| `pagado_por` | `uuid` | FK | Usuario que pago |
| `fecha` | `date` |  | Dia del gasto |
| `metodo_reparto` | `text` |  | `equal`, `exact`, `percentage`, `weighted` |
| `created_by` | `uuid` | FK | Usuario que registro el gasto |
| `created_at` | `timestamptz` |  | Default `now()` |
| `updated_at` | `timestamptz` |  | Mantener con trigger |
| `deleted_at` | `timestamptz` |  | Opcional para borrado logico |

### 7. `expense_participants`

Reemplaza `Expense.participantes` y deja preparado el roadmap de division ponderada.

| Campo | Tipo | Llave | Nota |
| --- | --- | --- | --- |
| `expense_id` | `uuid` | PK/FK | Referencia `expenses(id)` |
| `user_id` | `uuid` | PK/FK | Referencia `profiles(id)` |
| `weight` | `numeric(10,4)` |  | Default `1`, util para reparto ponderado |
| `share_amount` | `numeric(12,2)` |  | Para reparto exacto; nulo en reparto igual |
| `share_percentage` | `numeric(5,2)` |  | Para reparto porcentual |
| `created_at` | `timestamptz` |  | Default `now()` |

Para reparto igual: insertar una fila por participante con `weight = 1` y dejar `share_amount`/`share_percentage` en `null`.
Para reparto exacto, usar `share_amount`. Para porcentaje, usar `share_percentage`. Para ponderado, usar `weight`.

### 8. `payments`

Pagos externos marcados en la app como pendientes/hechos. Esto cubre el roadmap "Marcar pagos como realizados / liquidados".

| Campo | Tipo | Llave | Nota |
| --- | --- | --- | --- |
| `id` | `uuid` | PK |  |
| `trip_id` | `uuid` | FK | Viaje asociado |
| `from_user_id` | `uuid` | FK | Quien paga |
| `to_user_id` | `uuid` | FK | Quien recibe |
| `monto` | `numeric(12,2)` |  | Debe ser mayor que cero |
| `status` | `text` |  | `pending`, `paid`, `cancelled` |
| `created_by` | `uuid` | FK | Quien registro la liquidacion |
| `paid_at` | `timestamptz` |  | Fecha real marcada como pagada |
| `created_at` | `timestamptz` |  | Default `now()` |
| `updated_at` | `timestamptz` |  | Mantener con trigger |

No guardar las liquidaciones sugeridas como tabla principal. Esas se calculan desde `expenses`, `expense_participants` y `payments`.

### 9. `trip_photos`

Metadatos de fotos. El archivo vive en Supabase Storage.

| Campo | Tipo | Llave | Nota |
| --- | --- | --- | --- |
| `id` | `uuid` | PK |  |
| `trip_id` | `uuid` | FK | Viaje asociado |
| `storage_path` | `text` | UNIQUE | Ruta en bucket, por ejemplo `trip-photos/{trip_id}/{id}.jpg` |
| `uploaded_by` | `uuid` | FK | Usuario que subio la foto |
| `fecha` | `timestamptz` |  | Default `now()` |
| `caption` | `text` |  | Opcional |
| `created_at` | `timestamptz` |  | Default `now()` |
| `deleted_at` | `timestamptz` |  | Opcional |

Bucket recomendado: `trip-photos`.

### 10. `chats`

Contenedor de conversaciones directas y de grupo.

| Campo | Tipo | Llave | Nota |
| --- | --- | --- | --- |
| `id` | `uuid` | PK |  |
| `tipo` | `text` |  | `dm` o `grupo` |
| `nombre` | `text` |  | Solo grupos |
| `trip_id` | `uuid` | FK/UNIQUE | Nulo para DM; unico para chat automatico de viaje |
| `created_by` | `uuid` | FK |  |
| `created_at` | `timestamptz` |  | Default `now()` |
| `updated_at` | `timestamptz` |  | Mantener con trigger |

Para evitar DMs duplicados, crear el DM mediante una funcion RPC que busque primero un chat `dm` con exactamente ambos miembros.

### 11. `chat_members`

Reemplaza `Chat.memberIds` y permite mensajes no leidos.

| Campo | Tipo | Llave | Nota |
| --- | --- | --- | --- |
| `chat_id` | `uuid` | PK/FK | Referencia `chats(id)` |
| `user_id` | `uuid` | PK/FK | Referencia `profiles(id)` |
| `role` | `text` |  | `member`, `admin` |
| `joined_at` | `timestamptz` |  | Default `now()` |
| `last_read_at` | `timestamptz` |  | Para contador de no leidos |
| `muted_until` | `timestamptz` |  | Opcional |

### 12. `messages`

Mensajes de chat.

| Campo | Tipo | Llave | Nota |
| --- | --- | --- | --- |
| `id` | `uuid` | PK |  |
| `chat_id` | `uuid` | FK | Referencia `chats(id)` |
| `sender_id` | `uuid` | FK | Referencia `profiles(id)` |
| `texto` | `text` |  | Contenido |
| `fecha` | `timestamptz` |  | Default `now()` |
| `edited_at` | `timestamptz` |  | Opcional |
| `deleted_at` | `timestamptz` |  | Opcional |

## Mapeo desde los modelos actuales

| Frontend actual | Base de datos propuesta |
| --- | --- |
| `User` | `profiles` |
| `User.friendIds` | `friendships` |
| `Trip` | `trips` |
| `Trip.memberIds` | `trip_members` |
| `Expense` | `expenses` |
| `Expense.participantes` | `expense_participants` |
| `Photo.dataUrl` | `trip_photos.storage_path` + Supabase Storage |
| `Chat` | `chats` |
| `Chat.memberIds` | `chat_members` |
| `Message` | `messages` |
| `UserBalance`, `Settlement` | Vistas/RPC/servicio calculado, no tabla principal |

## Consultas derivadas recomendadas

Los balances pueden seguir en el frontend al inicio, pero la BBDD deberia permitir estas vistas o funciones:

- `v_expense_shares`: calcula cuanto le corresponde a cada participante por gasto.
- `v_trip_balances`: suma por viaje `pagado - parte`.
- `rpc_trip_settlements(trip_id)`: devuelve transferencias minimas sugeridas.
- `rpc_user_global_balances(user_id)`: equivalente a `globalPersonBalances`.

Cuando `payments.status = 'paid'`, el calculo del saldo pendiente debe descontar esos pagos reales.

## Indices importantes

- `profiles(email)` y, si se busca mucho por alias, `profiles(alias)`.
- `friendships(user_id)` y `friendships(friend_id)`.
- `trip_members(user_id, trip_id)`.
- `expenses(trip_id, fecha desc)`.
- `expense_participants(user_id)`.
- `payments(trip_id, status)`.
- `trip_photos(trip_id, fecha desc)`.
- `chat_members(user_id, chat_id)`.
- `messages(chat_id, fecha)`.

## RLS sugerida

Habilitar RLS en todas las tablas del schema `public`.

- `profiles`: cada usuario puede actualizar solo su perfil; lectura autenticada limitada segun necesidad de busqueda.
- `friendships`: solo los usuarios del par pueden ver/crear/actualizar esa amistad.
- `trips`: visible para miembros en `trip_members`; actualizable por owner o reglas de rol.
- `trip_members`: visible para miembros del viaje; inserciones/bajas controladas por owner.
- `expenses` y `expense_participants`: visibles y modificables solo por miembros del viaje.
- `payments`: visibles por miembros del viaje; marcar como pagado deberia estar limitado a involucrados o owner.
- `trip_photos`: visibles por miembros del viaje; subida permitida a miembros.
- `chats`, `chat_members`, `messages`: visibles solo para miembros del chat.

## Orden de implementacion

1. Crear tablas base: `profiles`, `friendships`, `trips`, `trip_members`.
2. Agregar gastos: `expenses`, `expense_participants`.
3. Agregar chats: `chats`, `chat_members`, `messages`.
4. Agregar fotos con Supabase Storage: bucket `trip-photos` + `trip_photos`.
5. Agregar `payments` y ajustar el calculo de saldos pendientes.
6. Despues de validar el flujo, mover balances a vistas/RPC si el cliente queda con demasiada logica.

## DDL base sugerido

Este SQL es un punto de partida para una migracion de Supabase. Conviene revisarlo antes de ejecutarlo, especialmente las politicas RLS.

```sql
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  nombre text not null,
  alias text not null,
  descripcion text,
  avatar_color text not null default '#5b5fc7',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.friendships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'accepted' check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (user_id, friend_id),
  check (user_id <> friend_id),
  check (requested_by = user_id or requested_by = friend_id)
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  nombre text not null,
  descripcion text not null default '',
  tipo text not null check (tipo in ('viaje', 'salida')),
  fecha_inicio date not null,
  fecha_fin date,
  finalizado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  added_by uuid references public.profiles(id),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (trip_id, user_id)
);

create table public.trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  token text not null unique,
  created_by uuid not null references public.profiles(id),
  expires_at timestamptz,
  max_uses integer,
  uses_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  titulo text not null,
  monto numeric(12,2) not null check (monto > 0),
  moneda char(3) not null default 'CLP',
  pagado_por uuid not null references public.profiles(id),
  fecha date not null,
  metodo_reparto text not null default 'equal' check (metodo_reparto in ('equal', 'exact', 'percentage', 'weighted')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.expense_participants (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  weight numeric(10,4) not null default 1 check (weight > 0),
  share_amount numeric(12,2),
  share_percentage numeric(5,2),
  created_at timestamptz not null default now(),
  primary key (expense_id, user_id),
  check (share_amount is null or share_amount >= 0),
  check (share_percentage is null or (share_percentage >= 0 and share_percentage <= 100))
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  from_user_id uuid not null references public.profiles(id),
  to_user_id uuid not null references public.profiles(id),
  monto numeric(12,2) not null check (monto > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  created_by uuid not null references public.profiles(id),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);

create table public.trip_photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  storage_path text not null unique,
  uploaded_by uuid not null references public.profiles(id),
  fecha timestamptz not null default now(),
  caption text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.chats (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('dm', 'grupo')),
  nombre text,
  trip_id uuid unique references public.trips(id) on delete cascade,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chat_members (
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'admin')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  muted_until timestamptz,
  primary key (chat_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  texto text not null,
  fecha timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create index idx_friendships_friend_id on public.friendships(friend_id);
create index idx_trip_members_user_id on public.trip_members(user_id);
create index idx_expenses_trip_date on public.expenses(trip_id, fecha desc);
create index idx_expense_participants_user_id on public.expense_participants(user_id);
create index idx_payments_trip_status on public.payments(trip_id, status);
create index idx_trip_photos_trip_date on public.trip_photos(trip_id, fecha desc);
create index idx_chat_members_user_id on public.chat_members(user_id);
create index idx_messages_chat_date on public.messages(chat_id, fecha);
```
