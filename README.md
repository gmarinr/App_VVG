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

- [ ] Marcar pagos como realizados / liquidados (tablas `payments`/`trip_invites` listas, falta UI).
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

## 📌 Estado

MVP funcional end-to-end sobre Supabase (Auth + datos + Storage con RLS).
