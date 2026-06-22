# Cambios en `data.service.ts` para Supabase

Este archivo documenta la migracion del servicio de datos desde `localStorage` hacia Supabase.

## Que cambio

- `DataService` ya no usa `StorageService` ni datos semilla locales.
- Ahora usa `SupabaseService`, que contiene el cliente creado con `@supabase/supabase-js`.
- Los `signals` publicos se mantienen:
  - `users`
  - `trips`
  - `expenses`
  - `photos`
  - `chats`
  - `messages`
- Las paginas pueden seguir leyendo datos de forma similar a como lo hacian antes, por ejemplo:
  - `this.data.tripsForUser(userId)`
  - `this.data.getTrip(id)`
  - `this.data.tripExpenses(tripId)`
  - `this.data.chatsForUser(userId)`

La diferencia importante es que las operaciones que escriben en base de datos ahora son asincronas y deben usarse con `await`.

## Tablas usadas

| Modelo frontend | Tabla Supabase |
| --- | --- |
| `User` | `profiles` |
| amigos | `friendships` |
| `Trip` | `trips` |
| participantes de viaje | `trip_members` |
| `Expense` | `expenses` |
| participantes de gasto | `expense_participants` |
| `Photo` | `trip_photos` + Storage bucket `trip-photos` |
| `Chat` | `chats` |
| miembros de chat | `chat_members` |
| `Message` | `messages` |

## Carga inicial de datos

Cuando se crea el servicio:

1. Revisa si existe una sesion activa de Supabase Auth.
2. Si no hay sesion, limpia los `signals`.
3. Si hay sesion, carga desde Supabase:
   - perfiles y amistades
   - viajes y miembros
   - gastos y participantes
   - fotos
   - chats, miembros y mensajes
4. Tambien escucha cambios de sesion con `onAuthStateChange`.

Esto permite que al iniciar sesion o recargar la app, los datos se vuelvan a cargar desde la base.

## Metodos que ahora guardan en Supabase

### `createTrip`

Inserta en este orden:

1. `trips`
2. `trip_members`
3. `chats`
4. `chat_members`

Por eso la pagina `create-trip.page.ts` ahora usa:

```ts
const trip = await this.data.createTrip(...);
```

### `addExpense`

Inserta en:

1. `expenses`
2. `expense_participants`

La division ahora soporta cuatro modos desde la pantalla de nuevo gasto:

| Modo | Campo principal | Como se interpreta |
| --- | --- | --- |
| `equal` | `weight = 1` | Divide el total en partes iguales entre participantes. |
| `exact` | `share_amount` | Cada participante tiene un monto exacto. La suma debe coincidir con el total del gasto. |
| `percentage` | `share_percentage` | Cada participante tiene un porcentaje. La suma debe ser 100%. |
| `weighted` | `weight` | Cada participante tiene un peso relativo. Por ejemplo, peso 2 paga el doble que peso 1. |

El metodo se guarda en `expenses.metodo_reparto`. El detalle por persona se guarda en `expense_participants`.
`BalanceService` usa esos mismos datos para calcular balances, deudas y liquidaciones del viaje.

### `addFriend`

Inserta o actualiza una amistad en `friendships`.

La relacion se guarda normalizada: el UUID menor queda en `user_id` y el mayor en `friend_id`, para evitar duplicados.

### `removeFriend`

Elimina la fila correspondiente en `friendships`.

Tambien usa el par normalizado de UUIDs, por lo que puede borrar la amistad sin importar quien la haya creado originalmente.

### `getOrCreateDm`

Busca primero un DM existente en la cache.

Si no existe:

1. Crea un registro en `chats` con `tipo = 'dm'`.
2. Inserta ambos usuarios en `chat_members`.

### `sendMessage`

Inserta el mensaje en `messages` y actualiza el signal local `messages`.

### Chats no leidos

La app usa `chat_members.last_read_at` para saber si un chat tiene mensajes pendientes.

- `loadChatsAndMessages` carga `last_read_at` junto con los miembros del chat.
- `chatHasUnread(chatId, userId)` revisa si hay mensajes de otra persona posteriores a esa fecha.
- `unreadChatCount(userId)` permite mostrar la indicacion en el icono de Mensajes.
- `markChatRead(chatId, userId)` actualiza `chat_members.last_read_at` cuando el usuario entra a un chat.

La indicacion visual se usa en:

- `tabs.page.ts`: punto rojo sobre el icono de Mensajes.
- `messages.page.html`: punto rojo y texto destacado en cada chat no leido.

### `addPhoto`

Recibe el `dataUrl` que genera el input de archivo, lo convierte a `Blob`, sube el archivo al bucket privado `trip-photos` y luego inserta el metadato en `trip_photos`.

La ruta usada es:

```txt
{trip_id}/{photo_id}.{extension}
```

Esto coincide con las policies de Storage del SQL.

### `updateTrip`, `finalizeTrip`, `addMember`, `removeMember`, `deleteExpense`

Todas estas operaciones ahora escriben en Supabase y refrescan la cache local despues.

## Paginas actualizadas

Se ajustaron estas paginas para esperar operaciones remotas:

- `create-trip.page.ts`
- `add-expense.page.ts`
- `expense-detail.page.ts`
- `trip-detail.page.ts`
- `add-friend.page.ts`
- `user-profile.page.ts`
- `new-chat.page.ts`
- `chat.page.ts`
- `account.page.ts`

## Regla practica para nuevas paginas

Cuando una pagina necesite guardar algo:

1. Validar datos en la pagina.
2. Llamar a un metodo de `DataService` con `await`.
3. Manejar errores con `try/catch`.
4. Mostrar toast solo cuando Supabase responda correctamente.

Ejemplo:

```ts
try {
  await this.data.addExpense(...);
  await this.show('Guardado correctamente.', 'success');
} catch (error) {
  console.error(error);
  await this.show('No se pudo guardar.', 'danger');
}
```

## Pendiente

- Los balances siguen calculandose en `BalanceService` desde los `signals` locales, pero ya respetan reparto igual, exacto, porcentual y ponderado.
- No se agregaron suscripciones realtime.
- El boton "Reiniciar demo" ya no recrea datos semilla en Supabase; solo limpia la cache local y cierra sesion.
- El README aun describe el MVP local con cuenta demo. Conviene actualizarlo cuando se cierre la migracion.

## Reparacion de perfiles faltantes

La app lista usuarios desde `public.profiles`, no desde `Authentication -> Users`. Si hay usuarios en Auth que no aparecen para agregar amigos, ejecuta en Supabase SQL Editor:

```txt
diseno/vvg_reparar_profiles_y_policies.sql
```

Ese script crea las filas faltantes en `profiles` a partir de `auth.users` y vuelve a aplicar las policies basicas de `profiles` y `friendships`.
