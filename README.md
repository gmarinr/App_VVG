# VVG

App para organizar los **gastos compartidos** de viajes y salidas entre amigos y familia. Permite registrar quién pagó cada gasto y quiénes participaron, y calcula automáticamente **quién le debe cuánto a quién** para saldar las cuentas de forma justa al final.

> Los pagos se realizan **fuera de la app**; aquí solo se registra si están hechos o no.

Incluye además gestión de amigos, mensajes directos (DM) y chats de grupo automáticos por cada viaje o salida.

---

## ✨ Funcionalidades

- **Viajes y Salidas** — crea actividades, invita amigos y registra gastos.
- **Gastos** — cada gasto guarda quién pagó, el monto y quiénes participaron; se divide en partes iguales entre los participantes.
- **Balance automático** — el motor calcula el neto de cada persona y las liquidaciones mínimas (quién paga a quién).
- **Menú principal** — viaje actual, balances por viaje, pagos pendientes por persona y gráfico de gastos.
- **Detalle de viaje** — pestañas Detalles · Balance · Fotos · Ajustes (finalizar viaje, editar, agregar/quitar participantes).
- **Fotos** — galería compartida por viaje, agrupada por fecha.
- **Social** — amigos, perfiles, chats directos y grupos por viaje/salida.

## 🛠️ Stack

- [Ionic 8](https://ionicframework.com/) + [Angular 20](https://angular.dev/) (standalone components, signals)
- [Capacitor 8](https://capacitorjs.com/) para empaquetado móvil
- **Persistencia actual:** `localStorage` (local-first). **Supabase está pendiente de integración.**

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

### Cuenta de demostración

La app arranca con datos de ejemplo (un viaje activo, una salida pasada, gastos, amigos y chats):

```
Correo:      demo@vvg.app
Contraseña:  1234
```

En **Cuenta → Reiniciar datos de demo** puedes restaurar el ejemplo en cualquier momento.

## 📂 Estructura

```
src/app/
├── models/        # Interfaces de dominio (User, Trip, Expense, Chat...)
├── services/      # storage, data (CRUD + seed), auth, balance (motor de cálculo)
├── shared/        # Componentes/pipes reutilizables (avatar, money, bar-chart, amount-card)
├── guards/        # authGuard
└── pages/         # Vistas (login, dashboard, history, trip-detail, chat, account...)
```

La capa de datos está aislada en `services/`, de modo que migrar a Supabase implica reemplazar `storage`, `data` y `auth` sin tocar las vistas ni el motor de balances.

## 🗺️ Roadmap

- [X] Integración con **Supabase** (base de datos + Auth real).
- [X] División de gastos **ponderada** (porcentajes o montos exactos), hoy solo partes iguales.
- [ ] Marcar pagos como realizados / liquidados.
- [X] Subida real de fotos a almacenamiento en la nube.
- [ ] Notificaciones de mensajes no leídos y estado de presencia.
- [ ] Logo definitivo de la app.

## 📌 Estado

MVP funcional en local. Sin backend todavía; pensado para validar flujos y UI antes de conectar Supabase.
