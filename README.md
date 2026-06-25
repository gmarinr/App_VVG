# VVG

App para organizar los **gastos compartidos** de viajes y salidas entre amigos y familia. Permite registrar quién pagó cada gasto y quiénes participaron, y calcula automáticamente **quién le debe cuánto a quién** para saldar las cuentas de forma justa al final.

> Los pagos se realizan **fuera de la app**; aquí solo se registra si están hechos o no.

Incluye además gestión de amigos, mensajes directos (DM) y chats de grupo automáticos por cada viaje o salida.

---

## ✨ Funcionalidades

- **Viajes y Salidas** — crea actividades, invita amigos y registra gastos.
- **Gastos** — cada gasto guarda quién pagó, el monto y quiénes participaron. Soporta 4 métodos de reparto: partes iguales, monto exacto, porcentaje y ponderado.
- **Balance automático** — el motor calcula el neto de cada persona y las liquidaciones mínimas (quién paga a quién).
- **Menú principal** — viaje actual, balances por viaje, pagos pendientes por persona y gráfico de gastos.
- **Detalle de viaje** — pestañas Detalles · Balance · Fotos · Ajustes (finalizar viaje, editar, agregar/quitar participantes).
- **Fotos** — galería compartida por viaje, agrupada por fecha (almacenadas en Supabase Storage).
- **Social** — amigos, perfiles, chats directos y grupos por viaje/salida.

## 🛠️ Stack

- [Ionic 8](https://ionicframework.com/) + [Angular 20](https://angular.dev/) (standalone components, signals)
- [Capacitor 8](https://capacitorjs.com/) para empaquetado móvil
- **Backend:** [Supabase](https://supabase.com/) — PostgreSQL + Auth (JWT, RLS) + Storage + REST autogenerada (PostgREST). La seguridad la aplica la base de datos vía Row-Level Security sobre `auth.uid()`.

## 🚀 Cómo ejecutar

Requisitos: Node.js 18+ y npm.

```bash
npm install
npm install -g @ionic/cli   # si no tienes la CLI de Ionic
ionic serve                 # abre http://localhost:8100
```

Otros comandos:

```bash
npm run build   # build de producción
npm test        # tests unitarios (Karma)
```

> Necesitas un proyecto de Supabase configurado (URL + anon key en `src/environments/environment.ts`) y el esquema de `diseno/vvg_supabase_schema.sql` aplicado.

### Cuenta de demostración

```
Correo:      demo@vvg.app
Contraseña:  1234
```

## 📂 Estructura

```
src/app/
├── models/        # Interfaces de dominio (User, Trip, Expense, Chat...)
├── services/      # supabase (cliente), data (CRUD), auth (Auth real), balance (motor de cálculo)
├── shared/        # Componentes/pipes reutilizables (avatar, money, bar-chart, amount-card)
├── guards/        # authGuard (async: espera la sesión de Supabase)
└── pages/         # Vistas (login, dashboard, history, trip-detail, chat, account...)
```

Las páginas hablan con `data.service`/`auth.service`, nunca con el cliente Supabase directamente. El motor de balances (`balance.service`) es puro y lee de los signals.

## 🗺️ Roadmap

Hecho:

- [X] Integración con **Supabase** (base de datos + Auth real + RLS).
- [X] División de gastos en 4 métodos (partes iguales, exacto, porcentaje, ponderado).
- [X] Subida real de fotos a almacenamiento en la nube (Supabase Storage).

Pendiente (técnico):

- [X] Liquidación de pagos: marcar desde el menú (total agregado, oldest-first) y desde el viaje. Ver [💸 Liquidación de pagos](#-liquidación-de-pagos).
- [ ] Notificaciones de mensajes no leídos y estado de presencia (realtime).
- [ ] Logo definitivo de la app y `appId` propio (hoy `io.ionic.starter`).

Futuras funcionalidades:

- [ ] Cambiar tipo de moneda.
- [ ] Adjuntar fotos a un gasto.
- [ ] Confirmación de amistad (solicitud → aceptar/rechazar).
- [ ] Confirmación de viaje/salida (que el invitado acepte unirse).
- [ ] Link de invitación a un viaje/salida.
- [ ] Descargar fotos de la galería al dispositivo.
- [ ] Validar que no se creen más de dos perfiles con el mismo nombre.
- [ ] Buscar usuarios por correo.
- [ ] Filtro de viajes/salidas activos vs. archivados.
- [ ] Mayor personalización de perfil, incluida foto de perfil.
- [ ] Calificar salida (por definir).
- [ ] Mostrar en el perfil de otra persona cuánto le debes / te debe.

## 💸 Liquidación de pagos

> Los pagos se realizan **fuera de la app**; aquí solo se registra si están hechos o no.

### Cómo funciona hoy

- **Los pagos son por viaje**, nunca "globales": `payments.trip_id` es `NOT NULL` y referencia a `trip_members`. No existe una fila de pago sin viaje asociado.
- **Un pago confirmado descuenta del balance del viaje**: en `balance.service.tripBalances()`, los pagos con `status='paid'` ajustan el neto (al deudor `+monto`, al acreedor `−monto`).
- **El menú no guarda la deuda en ninguna tabla; la deriva de los viajes**: `dashboard → pagosPorPersona → balance.globalPersonBalances(me)` recorre los viajes del usuario, calcula las liquidaciones mínimas de cada uno (`tripSettlements`, que ya incluye los pagos confirmados) y las **agrega por persona**. Hay una única fuente de verdad (gastos + pagos por viaje); el menú es solo una vista agregada, por eso se sincroniza solo.
- **Flujo de confirmación**: el deudor reporta un pago → fila `payments` con `status='pending'` (admite total o parcial ≤ pendiente); el acreedor lo confirma → `status='paid'` + `paid_at`. Mientras está `pending` no afecta al balance. Disponible desde el menú (agregado por persona) y desde el viaje (pestaña Balance).

### Decisiones de diseño

- **Neteo por persona** entre viajes: si en un viaje le debes a Ana y en otro Ana te debe, se compensan; el pago salda el neto, asignándolo del viaje **más antiguo al más nuevo** (por `trip.fecha`).
- **Se podrá marcar pagos en dos lugares**: desde el menú (total/parcial agregado por persona, con reparto automático entre viajes) y desde el viaje (pestaña Balance).

### Implementación (✅ hecho, 2026-06-25)

1. **Motor — `balance.service.ts`**
   - `personReportableTrips(me, otherId)` → liquidaciones **donde yo le debo** a esa persona, por viaje, **restando los pagos pendientes ya reportados**, ordenadas por `trip.fechaInicio` (más antiguo primero). Los viajes donde *me debe* no se tocan (ya netean en el total).
   - `allocateOldestFirst(me, otherId, monto)` → reparte un monto sobre esa lista y devuelve `[{ tripId, monto }]` hasta agotarlo. Convierte un "pago del total" en filas `payments` por viaje.
2. **Datos — `data.service.ts`**
   - `reportPayments(items[])` → inserta varias filas `payments` (`pending`) de una vez y recarga el signal una sola vez.
   - `confirmPayments(ids[])` → confirma varios pagos (`paid`) de una vez.
   - Se mantienen `addPayment`/`confirmPayment` para la acción individual desde el viaje.
3. **UI menú — `dashboard.page`**: la tarjeta "Saldar cuentas" muestra el saldo **agregado por persona**; si yo debo, input total/parcial → `settlePerson()` llama a `balance.allocateOldestFirst` y reporta con `reportPayments` (reparto oldest-first transparente). Los pagos que la otra persona reportó se confirman uno a uno o con "Confirmar todo" (`confirmAll` → `confirmPayments`). La orquestación vive en el componente para evitar dependencia circular `data → balance`.
4. **UI viaje — `trip-detail` (pestaña Balance)**: por cada liquidación que me involucra, botón "Registrar pago" (deudor, vía alert con monto total/parcial → `addPayment`), estado "esperando confirmación", y "Confirmar" (acreedor → `confirmPayment`). Como el menú deriva de los viajes, marcar aquí lo actualiza solo.

**Sin cambios de esquema**: `payments` ya soportaba status `pending`/`paid`, montos parciales y la relación por viaje. El flujo deudor-reporta → acreedor-confirma funciona en ambos puntos de entrada; solo el estado `paid` afecta al balance.

> Nota: pagar el total desde el menú puede generar varias confirmaciones pendientes para el acreedor (una por viaje). Se muestran agrupadas por persona con un "Confirmar todo".

### Estados e historial (no se borran)

Las cuentas saldadas **no desaparecen**: en la pestaña Balance del viaje, las liquidaciones se calculan sobre la deuda **bruta** (por los gastos) y se anota cuánto cubren los pagos confirmados, mostrando un badge **Pendiente / Parcial / Saldada** (`balance.service.tripSettlementStatuses`). Una liquidación parcial indica "Abonado $X de $Y"; una saldada queda marcada en verde en vez de ocultarse.

Además hay una sección **"Pagos realizados"** que lista los pagos confirmados del viaje (`data.tripPayments`, ordenados por fecha). En la base de datos nada se borra: cada pago es una fila `payments` que pasa de `pending` a `paid` con su `paid_at`.

> El menú (`globalPersonBalances`) sigue mostrando solo lo **pendiente** agregado por persona; el detalle de saldadas/parciales e historial vive en cada viaje.

## 📌 Estado

MVP funcional end-to-end sobre Supabase (Auth + datos + Storage con RLS).
