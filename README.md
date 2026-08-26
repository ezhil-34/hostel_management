# SmartHostel — Hostel Management System

Full-stack hostel management app in five modules: **accounts** with rotating
sessions, **profiles** with a field-level approval policy, **outpasses** with QR
verification at the gate, a **maintenance service** where students log repair
jobs and trade workers pick them up, and **points** wallets for the canteen and
laundry.

Two backend services, two databases, one address bar. New here? Read
[Services](#services) for the shape of it, then
[Quick start](#quick-start-docker--recommended) — or [`SETUP.md`](SETUP.md) for
the full runbook.

| Layer    | Stack                                                         |
| -------- | ------------------------------------------------------------- |
| Frontend | React 19 · Vite 8 · Tailwind CSS 3 · React Router 7 · lucide-react |
| Services | Node.js 22 · Express 5 (ESM) · JWT auth · zod validation       |
| Database | PostgreSQL 16 · Prisma ORM 6 — one database per service        |
| Runtime  | Docker Compose (dev + production stacks)                       |
| Testing  | Lifecycle, permission, concurrency and cross-service contract suites |

## Services

```
                    ┌───────────────────────────┐
  browser ─────────▶│ gateway                   │
                    │ nginx (prod) / Vite (dev) │
                    └────┬─────────────────┬────┘
       /api/maintenance ─┘                 └─ /api/*
                    │                            │
        ┌───────────▼──────────┐      ┌──────────▼─────────┐
        │ maintenance-service  │      │ backend (core API) │
        │ :5100                │      │ :5000              │
        │ repair jobs, workers │      │ auth, profile,     │
        │                      │      │ outpass            │
        └───────────┬──────────┘      └──────────┬─────────┘
                    │                            │
            ┌───────▼────────┐         ┌────────▼──────┐
            │ maintenance_db │         │ hostel_db     │
            └────────────────┘         └───────────────┘
```

The browser only ever sees `/api` — the gateway decides which service answers, so
`src/lib/api.js` looks the same for both. See [Maintenance](#maintenance) for how
the two services stay decoupled.

---

## Quick start (Docker — recommended)

You need Docker Desktop. Nothing else.

```bash
# 1. Create your environment file
cp .env.example .env          # Windows PowerShell:  copy .env.example .env

# 2. Build and start postgres + backend + maintenance-service + frontend
docker compose up -d --build

# 3. The maintenance service owns its own database, which does not
#    create itself on an existing Postgres volume. See Maintenance below.
docker compose exec postgres psql -U hostel -d hostel_db \
  -c "CREATE DATABASE maintenance_db;"

# 4. Create the tables and load the demo data — once per service
docker compose exec backend npx prisma migrate dev
docker compose exec backend npm run db:seed

docker compose exec maintenance-service npx prisma migrate dev
docker compose exec maintenance-service npm run db:seed
```

**[`SETUP.md`](SETUP.md) is the full runbook** — the same steps with every
gotcha spelled out, plus how to start over. This section is the short version.

| Service             | URL                                                      |
| ------------------- | -------------------------------------------------------- |
| Frontend            | http://localhost:5173                                    |
| Core API health     | http://localhost:5000/api/health                         |
| Core API database   | http://localhost:5000/api/health/db                      |
| Maintenance health  | http://localhost:5100/api/maintenance/health             |
| Adminer (DB UI)     | http://localhost:8080 — `docker compose --profile tools up -d` |

If you are adding the maintenance service to an **existing** install, its
database will not create itself — see [Maintenance](#maintenance).

Demo logins after seeding (password `Password123`):

| Account | Try |
| --- | --- |
| `john@student.edu` | Roll `21CS104`, room B-302. No outpass yet, so he can walk the whole flow; report a fault; set a spending PIN and buy something |
| `priya@student.edu` | Roll `21EC211`. Currently out and an hour overdue |
| `warden@hostel.edu` | One profile request and one overdue pass waiting; oversees maintenance; tops up wallets |
| `security@hostel.edu` | Gate guard — scans outpass QR codes, and nothing else |
| `worker@hostel.edu` · `worker2@hostel.edu` | Maintenance workers. Two of them, so you can watch the accept race |
| `admin@hostel.edu` | Everything |

Students start with **no spending PIN** — the Points page asks for one on the
first purchase, and setting it needs the account password (the same
`Password123`).

Everyday commands:

```bash
docker compose logs -f backend              # follow API logs
docker compose logs -f maintenance-service  # follow maintenance logs
docker compose up -d <service>              # apply a docker-compose.yml change
docker compose restart <service>            # re-run the process only
docker compose down                         # stop everything (data survives)
docker compose down -v                      # stop and wipe BOTH databases
```

`restart` and `up -d` are not interchangeable — see
[Troubleshooting](#troubleshooting). Source changes need neither:
all three services reload on save.

---

## Seeing your changes

All three services reload on save — your project folder is bind-mounted into
the containers, so there is nothing to copy or rebuild for ordinary code edits.

| You changed…                        | What happens                           | What you do                                        |
| ----------------------------------- | -------------------------------------- | -------------------------------------------------- |
| `frontend/src/**` (jsx, css)        | Vite hot-swaps the module              | Nothing — the browser updates in place              |
| `backend/src/**` (js)               | nodemon restarts the API in ~1s        | Nothing — re-trigger the request                    |
| `maintenance-service/src/**` (js)   | nodemon restarts that service only     | Nothing — the core API is untouched                 |
| `backend/prisma/schema.prisma`      | Nothing until you migrate              | `docker compose exec backend npx prisma migrate dev --name your_change` then `docker compose restart backend` |
| `package.json` (added a dependency) | Not installed in the container yet     | See **Adding a dependency** below — a rebuild alone is not enough |
| `.env` or `docker-compose.yml`      | Not picked up by a running container   | `docker compose up -d` (recreates what changed)     |
| `Dockerfile` or `nginx.conf`        | Image is stale                         | `docker compose up -d --build <service>`            |

### Adding a dependency

`node_modules` lives in a **named volume**, not in the image and not in your
project folder — that is what stops a Windows-built `node_modules` from being
mounted into a Linux container. The catch: Docker copies the image's
`node_modules` into that volume only when it creates the volume. Once the volume
exists it is never refreshed, so `docker compose up --build` rebuilds the image
and then mounts the *old* dependencies straight over the top of it. You get
`sh: <package>: not found` for anything newly added.

Two ways to fix it. Quickest, installs into the running volume:

```bash
docker compose exec backend npm install
docker compose restart backend
```

Cleanest, rebuilds the volume from the image so it matches `package-lock.json`
exactly:

```bash
docker compose down
docker volume rm hostel-management_backend_node_modules   # frontend_node_modules for the frontend
docker compose up -d --build
```

**Use `docker compose down`, never `docker compose down -v`** — the `-v` flag
deletes *every* volume in the project, `postgres_data` included, which wipes your
database. Dropping the `node_modules` volume by name is safe: it is a cache and
is rebuilt from the image.

If the volume name is rejected, list them with `docker volume ls` and pick the
one ending in `backend_node_modules` (the prefix comes from `name:` at the top of
`docker-compose.yml`).

Watch it happen — keep this open in a second terminal while you edit:

```bash
docker compose logs -f backend
```

You should see `[nodemon] restarting due to changes...` a second after you save.

**Why polling?** Docker bind mounts from a Windows or macOS host do not deliver
filesystem events into the container, so a watcher that waits for them never
fires. Both services poll instead: `CHOKIDAR_USEPOLLING=true` for Vite (set in
`docker-compose.yml`) and `legacyWatch` for nodemon (set in
`backend/nodemon.json`). It costs a little idle CPU, which is the right trade in
development. Running on Linux, or outside Docker, you can use
`npm run dev:native` in `backend/` for the lighter native watcher.

**If a change is not showing up**

1. `docker compose ps` — is the service actually running, or restart-looping?
2. `docker compose logs --tail=50 backend` — a syntax error stops the reload;
   nodemon prints the crash and waits for your next save.
3. Hard-refresh the browser (Ctrl+Shift+R) to rule out a cached bundle.
4. `docker compose restart backend` as a blunt reset.

---

## Running without Docker

Requires Node.js 20+ and a PostgreSQL 16 server you can reach.

Create both databases first — `hostel_db` and `maintenance_db`.

```bash
# --- Core API ---
cd backend
cp .env.example .env               # then set DATABASE_URL to your postgres
npm install
npx prisma migrate dev
npm run db:seed                    # optional
npm run dev                        # http://localhost:5000

# --- Maintenance service (second terminal) ---
cd maintenance-service
cp .env.example .env               # DATABASE_URL points at maintenance_db,
npm install                        # and JWT_ACCESS_SECRET must MATCH the core API
npx prisma migrate dev
npm run db:seed
npm run dev                        # http://localhost:5100

# --- Frontend (third terminal) ---
cd frontend
cp .env.example .env
npm install
npm run dev                        # http://localhost:5173
```

The shared `JWT_ACCESS_SECRET` is the entire contract between the two services.
If they differ, the maintenance service rejects every token the core API issues
and the maintenance page returns 401s that look like a login problem.

Vite is the gateway in development: it routes `/api/maintenance` to
`VITE_MAINTENANCE_PROXY_TARGET` and everything else under `/api` to
`VITE_PROXY_TARGET`, so the browser only ever talks to one origin.

---

## Production stack

```bash
# Set real secrets in .env first — the prod compose file refuses to start without them.
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

The frontend is built to static files and served by nginx on port 80, which
proxies `/api` to the backend container. The backend runs as a non-root user
with production-only dependencies.

---

## Project layout

```
hostel_management/
├── docker-compose.yml            # dev stack: postgres + backend + maintenance + frontend
├── docker-compose.prod.yml       # production stack: nginx-served frontend
├── .env.example                  # compose configuration
├── SETUP.md                      # the full setup runbook
│
├── backend/                      # the core API :5000 → hostel_db
│   ├── Dockerfile                # multi-stage: development | production
│   ├── prisma/
│   │   ├── schema.prisma         # data model
│   │   ├── migrations/           # committed; some are hand-written, see below
│   │   └── seed.js               # demo accounts, wallets, counters and menus
│   └── src/
│       ├── server.js             # http server + graceful shutdown
│       ├── app.js                # express app: helmet, cors, rate limiting
│       ├── config/
│       │   ├── env.js            # env parsing
│       │   ├── prisma.js         # client singleton
│       │   └── cors.js           # same-origin aware — see Troubleshooting
│       ├── middleware/           # auth guard, zod validation, error handler
│       ├── utils/                # jwt, password hashing, ApiError
│       ├── routes/index.js       # /api router + health checks
│       └── modules/
│           ├── auth/             # routes → controller → service → schema
│           ├── profile/          # + profile.policy.js (field permissions)
│           ├── outpass/          # request → approve → gate scan → return
│           └── points/           # wallets, PIN, counters, spend, credit
│
├── maintenance-service/          # its own process, image, database :5100
│   ├── Dockerfile
│   ├── prisma/
│   │   ├── schema.prisma         # maintenance_db — no FK reaches hostel_db
│   │   ├── migrations/
│   │   └── seed.js
│   └── src/
│       ├── clients/coreApi.js    # the ONE outbound call, at write time only
│       ├── config/cors.js        # a copy, deliberately — see below
│       ├── middleware/           # its own copy of the JWT guard — see below
│       └── modules/maintenance/  # report → accept → resolve → close
│
├── postgres/init/                # creates maintenance_db on a FRESH volume
│
└── frontend/
    ├── Dockerfile                # multi-stage: development | build | nginx
    ├── nginx.conf                # SPA fallback + /api proxy
    ├── vite.config.js            # dev proxy, docker-friendly host binding
    └── src/
        ├── lib/
        │   ├── api.js            # fetch wrapper; refreshes only on a real token 401
        │   ├── datetime.js
        │   └── maintenanceMeta.js   # trade labels and their examples
        ├── context/
        │   ├── AuthContext.jsx
        │   ├── ToastContext.jsx     # useToast() — success/error/info/warning
        │   └── ConfirmContext.jsx   # useConfirm() — promise-based dialog
        ├── components/
        │   ├── ProtectedRoute.jsx   # waits for the session, then guards the route
        │   ├── StatusBadge.jsx      # every status label lives here
        │   ├── NotePromptModal.jsx  # asks for a written note (resolve, reopen)
        │   ├── PinModal.jsx         # set a PIN, and confirm a purchase with it
        │   ├── Outpass*, Maintenance*, ChangeRequest*  # cards and modals
        └── pages/                # Home, SignIn, SignUp, Profile, Outpass,
                                  # GateVerify, Maintenance, Points
```

### Toasts and confirmations

Two providers wrap the app in `App.jsx`, above `AuthProvider` so auth flows can
use them too.

```jsx
const toast = useToast();
toast.success('Profile updated', 'Phone number saved.');
toast.error('Could not save', err.message);   // errors stay until dismissed

const confirm = useConfirm();
if (!(await confirm({
  title: 'Sign out?',
  message: 'You will need your password to sign back in.',
  confirmLabel: 'Sign out',
  tone: 'logout',              // primary | warning | danger | delete | logout
  details: { Field: 'Room Number', Change: 'B-302 → C-101' },
}))) return;
```

`confirm()` resolves `true`/`false` — escape, the backdrop and Cancel all
resolve `false`. Confirmations guard consequential actions (sign out, cancel a
request, approve/reject, change password); everything else reports through a
toast.

---

## API

Base URL `/api`. Every response is `{ success, data }` or `{ success, error }`.

Auth, profile and outpass routes are listed below. The two larger modules have
their endpoint tables in their own sections: [Maintenance](#maintenance) (served
by the other service, under `/api/maintenance`) and [Points](#points).

| Method | Endpoint                | Auth   | Purpose                                        |
| ------ | ----------------------- | ------ | ---------------------------------------------- |
| GET    | `/health`               | –      | Liveness (used by the Docker healthcheck)      |
| GET    | `/health/db`            | –      | Readiness — confirms PostgreSQL answers        |
| POST   | `/auth/signup`          | –      | Register; returns a session and creates wallets |
| POST   | `/auth/signin`          | –      | Sign in with **email or roll number**          |
| POST   | `/auth/refresh`         | cookie | Rotate the refresh token, issue a new access token |
| POST   | `/auth/logout`          | cookie | Revoke the refresh token                       |
| GET    | `/auth/me`              | Bearer | Current profile                                |
| POST   | `/auth/change-password` | Bearer | Change password; signs out **other** devices, keeps this one |

### Profile and change requests

| Method | Endpoint                             | Auth           | Purpose                                     |
| ------ | ------------------------------------ | -------------- | ------------------------------------------- |
| GET    | `/profile`                           | Bearer         | Profile + the field policy for your role    |
| PATCH  | `/profile`                           | Bearer         | Edit self-editable fields only              |
| GET    | `/profile/requests`                  | Bearer         | Your change requests (`?status=` to filter) |
| POST   | `/profile/requests`                  | Bearer         | Raise a request for a locked field          |
| PATCH  | `/profile/requests/:id/cancel`       | Bearer         | Withdraw your own pending request           |
| GET    | `/profile/review/requests`           | Warden / Admin | The review queue, everyone's requests       |
| PATCH  | `/profile/review/requests/:id`       | Warden / Admin | `{ decision: "APPROVED" \| "REJECTED", note }` |

There is deliberately **no** `PATCH /auth/me`. Profile writes go through
`PATCH /api/profile` so the field policy has exactly one enforcement point —
do not add a second route that writes these columns.

### Outpasses

| Method | Endpoint | Who | Purpose |
| --- | --- | --- | --- |
| GET | `/outpasses` | any | Own passes (`?status=`, `?overdue=true`) |
| POST | `/outpasses` | any | Request a pass → `PENDING` |
| GET | `/outpasses/:id` | owner | One pass, with `qrUrl` once approved |
| PATCH | `/outpasses/:id/cancel` | owner | Withdraw (refused once `ACTIVE`) |
| GET | `/outpasses/review` | Warden/Admin | Queue (`?status=`, `?overdue=true`) |
| PATCH | `/outpasses/review/:id` | Warden/Admin | `{ decision: "APPROVED" \| "REJECTED", note }` |
| GET | `/outpasses/verify/:token` | Security/Warden/Admin | Pass + student + next gate action |
| POST | `/outpasses/verify/:token/exit` | Security/Warden/Admin | Check the student out → `ACTIVE` |
| POST | `/outpasses/verify/:token/return` | Security/Warden/Admin | Check them in → `COMPLETED` |

Validation failures return `400` with per-field messages:

```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "details": [{ "field": "email", "message": "Enter a valid email address" }]
  }
}
```

### How auth works

- **Access token** — short-lived (15 min) JWT sent as `Authorization: Bearer …`.
  The frontend keeps it in `localStorage`.
- **Refresh token** — long-lived (7 days), delivered as an `httpOnly` cookie so
  page scripts cannot read it. Stored **hashed** in the database, so a database
  leak cannot be replayed.
- **Rotation** — every refresh revokes the token it consumed and issues a new
  one. A stolen token stops working the moment the real user refreshes.
- **Auto-refresh** — `src/lib/api.js` catches a `401`, refreshes once, and
  replays the original request. Concurrent 401s share a single refresh call.

Other hardening: `helmet` security headers, an allow-list CORS policy, 300
req/min global rate limit with 20 attempts per 15 min on credential endpoints,
bcrypt at cost 12, and identical error messages for "no such account" and "wrong
password" (with matched response timing) so the API cannot be used to discover
which emails are registered.

---

---

## Profile permissions

Students cannot edit institutional facts about themselves. Each field carries one
of three access levels, defined per role in
`backend/src/modules/profile/profile.policy.js` — **the single source of truth**:

| Access      | Meaning                                                        |
| ----------- | -------------------------------------------------------------- |
| `SELF`      | Edit it directly with `PATCH /api/profile`                      |
| `REQUEST`   | Locked — raise a request for a warden or admin to approve       |
| `READ_ONLY` | Never editable through the profile module                       |

|             | Student  | Staff    | Warden   | Admin    |
| ----------- | -------- | -------- | -------- | -------- |
| Phone       | SELF     | SELF     | SELF     | SELF     |
| Name        | REQUEST  | REQUEST  | SELF     | SELF     |
| Room / Block| REQUEST  | REQUEST  | SELF     | SELF     |
| Email       | REQUEST  | REQUEST  | REQUEST  | SELF     |
| Roll number | REQUEST  | REQUEST  | REQUEST  | REQUEST  |
| Role        | READ_ONLY| READ_ONLY| READ_ONLY| READ_ONLY|

`GET /api/profile` ships this table to the browser, so the UI renders each input
editable, locked, or read-only purely from the server's answer — there is no
second copy of the rules in the frontend. **Change a permission in
`profile.policy.js` and both sides follow.**

The request lifecycle: `PENDING → APPROVED | REJECTED | CANCELLED`. Approving
copies `newValue` onto the user row inside a transaction. Guards worth knowing:

- Only one open request per field, per user.
- A mixed `PATCH` containing even one locked field is rejected whole — never a
  partial write.
- Uniqueness on email and roll number is re-checked at approval time, not just
  when the request was raised.
- Reviewers cannot approve their own requests.

---

## Outpasses

```
PENDING ──approve──▶ APPROVED ──gate exit──▶ ACTIVE ──gate return──▶ COMPLETED
   │                     │                      │
   ├──reject──▶ REJECTED │                      └─ past returnAt ⇒ shown OVERDUE
   └──────── cancel ─────┴──▶ CANCELLED             (derived, never stored)
```

A student requests a pass; a **warden or admin** approves or rejects it; approval
mints a QR code; a **gate guard** scans it to check the student out and back in.

**Overdue is computed, not stored.** There is no `OVERDUE` enum value — a stored
flag would need a scheduled job to keep it true and would be wrong between runs.
`serializeOutpass()` in `outpass.service.js` derives `isOverdue` and
`overdueByMinutes` on every read, so the answer is right the moment it is asked.

**Expired is derived too.** A `PENDING` or `APPROVED` pass whose return time
came and went was never used. It reads as `isExpired`, shows as *Expired unused*,
stops counting against the one-pass rule, and will not open the gate. Without
this, one approved-but-unused pass would lock a student out of requesting
another for good.

**Rules the API enforces**

- Return time must be after the leave time; the leave time cannot be in the past
  (5 minutes of slack for clock skew between browser and server).
- One open pass at a time — but only a *live* one. An `ACTIVE` pass always
  blocks (the student is physically out); an expired `PENDING`/`APPROVED` one
  does not.
- A pass in use cannot be cancelled; the gate must check the student back in.
- Exit only from `APPROVED`, and only inside the approved window — 30 minutes of
  grace at the front, nothing after the return time. A pass for next Friday will
  not open the gate today.
- Return only from `ACTIVE`. Re-scanning says "already checked out at 18:42"
  rather than writing twice.
- A reviewer cannot approve their own pass.
- `?overdue=true` with a conflicting `?status=` is rejected rather than silently
  reinterpreted.

`GET /outpasses/verify/:token` returns `nextAction` plus a `blockedReason`, and
the two mirror `markExit`'s checks exactly — so the guard is only ever shown a
button that will actually work.

### Concurrency

Every rule above is a read followed by a write, and two requests can slip
between the two. Two guards scanning one QR, a warden double-clicking Approve,
a student's phone retrying a submit — all of them would otherwise write twice.

**State changes use compare-and-swap.** The expected status goes in the `WHERE`
clause, so the decision and the write are one atomic statement:

```js
// outpass.service.js — returns null if someone else got there first
const transition = async (id, fromStatus, data) => {
  const { count } = await prisma.outpass.updateMany({ where: { id, status: fromStatus }, data });
  return count === 0 ? null : prisma.outpass.findUnique({ where: { id }, select: outpassSelect });
};
```

The loser gets a `409` explaining what happened, never a corrupt record. The
same pattern guards profile-request review and refresh-token rotation — one
token cannot mint two sessions.

**Creating a pass takes a per-student advisory lock.** There is no row yet to
compare-and-swap on, so `createOutpass` wraps the check-and-insert in a
transaction holding `pg_advisory_xact_lock(4711, hashtext(userId))`. It blocks
only that one student's concurrent creates and is released when the transaction
ends, however it ends.

### The QR code

`APP_PUBLIC_URL` + `/verify/<token>`, where the token is 32 random bytes minted
at approval. The guard's phone camera opens that URL — no scanner library needed.

The token is a **bearer capability**, so it is defended accordingly: every
`/verify` route requires a Security, Warden or Admin session, `/verify/:token` in
the browser sits behind `ProtectedRoute`, and the token is wiped when the pass is
cancelled or completed. Photographing someone's pass gets you a sign-in screen.
A student cannot use the verify routes at all — not even on their own pass.

The QR URL is returned **only to the pass's owner**. The warden's review queue
covers every student in the hostel, so it deliberately omits `qrUrl` — a
reviewer needs to decide, not to walk people through the gate.

> **Scanning with a real phone** — set `APP_PUBLIC_URL` in `.env` to your
> machine's LAN address (e.g. `http://192.168.1.20:5173`) and run
> `docker compose up -d`. A QR containing `localhost` points the phone at itself.
> Clicking the link on your computer works without this.

---

## Maintenance

Maintenance runs in **its own service**, with its own database, image and
migrations. Restarting or rebuilding it does not touch the core API, and the core
API knows nothing about it beyond one enum member on `Role`.

```
OPEN ──worker accepts──▶ ACCEPTED ──worker resolves──▶ RESOLVED ──student confirms──▶ CLOSED
 │                                                        │
 └──student withdraws──▶ WITHDRAWN                        └──student reopens──▶ ACCEPTED
```

A student logs a fault — a leaking tap, a dead tube light, no hot water — picking
the trade it belongs to. It lands in an open pool. A maintenance worker accepts
it, fixes it, and resolves it with a note saying what they did. The student gets
an update badge and either confirms the fix or reopens the job.

Trades: `PLUMBING`, `ELECTRICAL`, `CARPENTRY`, `HOUSEKEEPING`, `INTERNET`,
`APPLIANCE`, `PEST_CONTROL`, `OTHER`.

**There is deliberately no anonymous mode.** A worker has to know which room to
go to and who to call when they get there — unlike a grievance system, hiding the
reporter would make the job undoable. The reporter's name, roll number, room and
phone are snapshotted onto the request at write time.

### Adding it to an existing install

The Postgres init script only runs on a **fresh** volume, so create the database
once by hand, then migrate:

```bash
# -d hostel_db matters: without it psql looks for a database named after the
# user ("hostel"), which does not exist.
docker compose exec postgres psql -U hostel -d hostel_db -c "CREATE DATABASE maintenance_db;"
docker compose up -d --build maintenance-service
docker compose exec maintenance-service npx prisma migrate dev --name init
docker compose exec maintenance-service npm run db:seed

# the core API gains one enum member: MAINTENANCE_WORKER
docker compose exec backend npx prisma migrate dev --name maintenance_worker_role
docker compose exec backend npm run db:seed
docker compose restart backend
```

### How the two services stay decoupled

**Auth needs no network call.** The maintenance service verifies the access token
itself with the shared `JWT_ACCESS_SECRET`. The contract between the services is
the *token* — `sub`, `role`, `email` — not shared code. It has no users table and
never looks one up, so a worker's permissions are decided locally in microseconds
even if the core API is unreachable.

**No cross-service foreign keys.** `MaintenanceRequest.studentId` is a bare uuid
pointing at a row in `hostel_db`. Joining across is physically impossible, which
is the point. Names and rooms are **snapshotted** at write time, so a room change
next term does not rewrite where last April's leaking tap was.

**One synchronous dependency, at write time only.** The token carries no name, and
trusting the browser would let a student log a job under someone else's room. So
reporting calls `GET /api/auth/me` with the caller's own token — the service holds
no service account and can never read more than the user could.

**It degrades rather than fails.** If the core API is down: reads keep working,
and a job can still be logged as long as the reporter supplies a room (without a
room and without the snapshot the service refuses clearly, rather than filing a
job nobody can find). `/api/maintenance/health` stays **200** while reporting
`coreApi: unreachable` — failing our own health check because a different service
is down would let one outage cascade into two.

**Duplicated infrastructure, on purpose.** `ApiError`, `validate`, the error
handler and the JWT guard are copied rather than imported so the service stays
independently deployable. The cost is drift; `.verify/cross-service-auth.mjs` is
the contract test that catches it — it mints tokens with the core API's real
signing code and presents them to the running maintenance service.

### Endpoints — all under `/api/maintenance`

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| POST | `/` | any | Log a job |
| GET | `/` | any | Own requests (`?status=`, `?category=`) |
| GET | `/:id` | owner or handler | Detail + comments + timeline |
| PATCH | `/:id/withdraw` | owner | Withdraw while `OPEN` |
| POST | `/:id/comments` | owner or handler | Add a message (`isInternal` for handlers) |
| POST | `/:id/reopen` | owner | Not actually fixed — back to the same worker |
| POST | `/:id/close` | owner | Confirm the fix |
| GET | `/queue` | Worker | Open pool + own accepted work, urgent first |
| POST | `/:id/accept` | Worker | Claim it |
| POST | `/:id/resolve` | Worker, Warden/Admin | Mark done with a note |
| GET | `/admin` | Warden/Admin | Everything, with counts |
| POST | `/:id/reassign` | Warden/Admin | Hand it to another worker |
| GET | `/health` | – | Liveness + core API reachability |

Every status change uses the same **compare-and-swap** pattern as the outpass
module — the expected status sits in the `WHERE` clause of the update, so two
workers tapping Accept at the same instant produce exactly one owner and the
loser gets a `409` naming who beat them. The concurrency suite proves it: run
against a deliberately un-guarded version of `transition()`, 3 of 5 simultaneous
accepts get through.

Internal notes (`isInternal`) are handler-only triage — the student's detail
view never receives one, and a student attempting to post one is refused rather
than silently downgraded. Timeline entries never carry `actorId`.

`hasUnreadUpdate` is derived, not stored: true when the last status change is
newer than the student's last view. Same reasoning as `isOverdue` and
`isExpired` — no scheduler, correct the moment it is read.

### Proving the architecture

Two things demonstrate that these really are separate services:

```bash
docker compose stop backend            # log a job → still works
docker compose stop maintenance-service # outpass and profile keep working
```

---


## Points

Canteen and laundry wallets. This lives in the **core API**, not its own
service: a wallet belongs to a user and the two are joined on every read, which
is the test for whether something can stand alone.

```
warden credits ──▶ WALLET ──student scans a counter──▶ menu ──PIN──▶ DEBIT + receipt
                     │
                     └─ every movement writes a ledger row carrying the balance it left behind
```

### How points get in

Only a **warden or admin** can credit a wallet, with a note saying what it is
for. There is no self-service top-up, because there is no payment gateway behind
one — money is paid at the hostel office and the credit records who added it.
The note and the staff member's name appear on the student's statement.

### How points go out

A student scans a counter's QR code, picks from **that counter's menu**, and
confirms with a four-digit PIN. Prices come from the server: the spend request
carries a counter token and an item id, never an amount, so the browser cannot
say what a samosa costs. An item id from a different counter's menu is refused.

### The PIN

bcrypt-hashed at the same cost as an account password, verified server-side,
and never returned in any response — the wallet payload carries `hasPin`, not
the hash. Setting or changing it requires the **account password**, so a
borrowed unlocked phone cannot set a fresh PIN and drain the balance. Five wrong
attempts lock the wallet for fifteen minutes, and a per-device rate limit sits
in front of that so an attacker cannot spray one guess each across many
accounts without tripping any single wallet's counter.

### Not overdrawing, and not double-charging

The balance is never read, decided on, and then written. The check lives inside
the write:

```sql
UPDATE wallets SET balance = balance - :cost
 WHERE id = :id AND balance >= :cost
```

Zero rows updated means the points were gone, whoever got there first. The
ledger row is written in the same transaction, so a balance cannot move without
a receipt explaining it. Verified against a real PostgreSQL: ten simultaneous
30-point spends against a 100-point balance leave exactly three receipts and 10
points. The same test against a read-then-write version ends at **−200**.

### Two things that bit us here

**A wrong PIN returns 403, not 401.** The browser's API client answers a 401 by
refreshing the token and replaying the request — correct for a stale session,
and wrong for a refused action. Returning 401 for a wrong PIN meant one tap on
Pay was posted twice, so the wallet locked after three attempts instead of five.
The client now replays only a 401 tagged `TOKEN_INVALID` / `TOKEN_MISSING`, so a
future endpoint making the same mistake cannot silently double-post a payment.

**The PIN boxes update through a function of the previous value.** Reading the
`value` prop looked fine and dropped a digit whenever two arrived before React
re-rendered — a wrong PIN, for no visible reason, costing a lockout attempt.

### Endpoints — all under `/api/points`

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| GET | `/wallets` | any | Both wallets, balances and recent statement |
| GET | `/transactions` | any | Full statement (`?type=`, `?limit=`) |
| GET | `/counters` | any | Open counters — backs the picker standing in for a camera |
| GET | `/counters/:token` | any | Resolve a scanned QR to a counter and its menu |
| POST | `/pin` | any | Set or change the PIN, confirmed with the account password |
| POST | `/spend` | any | Buy one menu item |
| GET | `/students` | Warden/Admin | Find a student and see both balances |
| POST | `/credit` | Warden/Admin | Add points, with a reason |

### Counters and menus

Seeded with three counters — Main Canteen, Night Canteen and Laundry Counter —
each with a menu. `qrToken` is what a printed QR code contains, so a counter can
be issued a new code without touching its menu or its history. Reseeding
upserts by token, which refreshes menus without invalidating printed codes.

---


## Data model

`User` — students, wardens, admins and staff. Unique on both `email` and
`rollNumber`, so sign-in accepts either.

`RefreshToken` — hashed sessions with expiry and revocation.

`Outpass` — destination, leave/return times, reason, status, the reviewer and
their note, the `verifyToken` behind the QR, and the gate log (`exitedAt`,
`returnedAt`, and which guard recorded each). See [Outpasses](#outpasses) above.

`Wallet` + `PointTransaction` — one `CANTEEN` and one `LAUNDRY` wallet per
student, each with a balance, a bcrypt-hashed spending PIN and its lockout
state, plus an append-only ledger. Every ledger row carries the `balanceAfter`
it left behind, so the statement always explains the balance. Wallets are
created at signup, and any that are missing are created on first read.

`Counter` + `MenuItem` — the canteen and laundry counters students scan, and
what each one sells. Prices live here and are read server-side at spend time.

`ProfileChangeRequest` — the approval ticket: which field, old and new value,
the requester's reason, status, and who reviewed it with what note.

`maintenance_db` is a **separate database** with its own schema —
`MaintenanceRequest`, `MaintenanceComment` and the append-only
`MaintenanceEvent` timeline. See [Maintenance](#maintenance).

After editing a schema, migrate the service that owns it:

```bash
docker compose exec backend npx prisma migrate dev --name describe_your_change
docker compose exec maintenance-service npx prisma migrate dev --name describe_your_change
```

If the change adds a **required** column to a table that already has rows,
`migrate dev` will refuse rather than invent values. Write that migration by
hand — see [Conventions](#conventions).

---

## Conventions

Every one of these exists because breaking it cost a real bug.

**Shapes.** Every response is `{ success, data }` or
`{ success, error: { message, code?, details? } }`. Validation failures are 400
with `details: [{ field, message }]`.

**Never return a raw database row.** Everything leaves a service through a
serializer that decides what is public. This is what keeps internal ids out of
payloads — maintenance timeline entries were once returned untouched, and every
one carried the id of the person who caused the event.

**401 means the session is invalid. Nothing else.** The browser answers a 401 by
refreshing the token and replaying the request, so using it for a refused
*action* causes a silent double-post. A wrong spending PIN returned 401 once,
and one tap on Pay became two failed attempts. A refused action is **403**. The
client also only replays a 401 carrying `code: "TOKEN_INVALID"` or
`"TOKEN_MISSING"`, so a future endpoint making the same mistake cannot
double-post a payment.

**A retry key identifies an operation, not just a request.** The spend endpoint
accepts an `idempotencyKey` so a double-tap cannot charge twice. It stores a
fingerprint of what was bought alongside it, and the same key presented for a
*different* item is refused with a 409. It used to derive the receipt code from
the key and match on that alone — so buying a 15-point tea with key `aaaaaa` and
then sending `aaaaaa` with a 120-point biryani returned "already paid" and
handed the item over for nothing, repeatably. Receipt codes are always
server-generated.

**Do not answer questions the caller should not be able to ask.** Raising a
profile change request used to reject a value already in use, which let any
student probe whether an email or roll number belonged to a registered account —
undoing the non-enumeration property `/auth/signin` deliberately maintains. The
request is now accepted either way; approval re-checks uniqueness before writing,
and the reviewer's queue carries a `valueUnavailable` flag the student never sees.

**A new status needs a badge entry.** `StatusBadge.jsx` maps every status to a
label. `CLOSED` was missing once, and the fallback quietly borrowed `PENDING`'s
label — so a closed maintenance job displayed "Pending review". An unrecognised
status now renders its own name and logs a warning in development, so the next
omission announces itself instead of impersonating another state.

**A user's own action is not an unread update.** `hasUnreadUpdate` means
"something happened while you were not looking". Owner actions — close, withdraw,
reopen — record the view time in the same write, or the student's own click
lights up their own badge.

**Derive, don't store, anything time-dependent.** `isOverdue`, `isExpired` and
`hasUnreadUpdate` are computed on read. A stored flag needs a scheduler and is
wrong between runs.

**zod v4 gotchas.** `.trim()` runs *after* validation, so normalise with
`z.preprocess` first. And `z.object` **strips unknown keys** — anything the
handler reads off `req.body` must be declared in the schema. That one bit
`changePassword`'s `refreshToken`, which meant non-browser clients revoked their
own session.

**Match Prisma errors by `err.name`, never `instanceof`.** The error classes are
`undefined` until `prisma generate` has run, and `x instanceof undefined`
throws — inside the error handler, turning a tidy 500 into a crash in exactly
the situation where you most need a readable message.

**Hand-write a migration when a new column is required.** `migrate dev` refuses
to add a `NOT NULL` column to a table with rows, and it is right to. Add it
nullable, backfill it, then enforce it — see
`backend/prisma/migrations/*_points_module/migration.sql`, which reconstructs a
running balance for ledger rows that predate the column.

---

## Adding a feature

Every module in both services has the same four files. Copy `outpass/` (core API)
or `maintenance/` (maintenance service) and rename:

1. `<name>.schema.js` — zod shapes for body, query and params.
2. `<name>.service.js` — Prisma queries and all business rules, no HTTP concerns.
   Status changes go through a `transition()` compare-and-swap, never a
   read-then-write.
3. `<name>.controller.js` — read the request, call the service, shape the response.
4. `<name>.routes.js` — wire it with `requireAuth`, `requireRole(...)` and
   `validate(...)`, then register it in `src/routes/index.js`.

**Whose service does it belong in?** If the feature needs to join against `User`,
it goes in the core API. If it can live off a bare `studentId` plus a snapshot,
it can be its own service — copy `maintenance-service/` as the template.

On the frontend, add the calls to `src/lib/api.js`, and if the feature
introduces a status, add it to `StatusBadge.jsx` at the same time. A new
*service* also needs a proxy entry in `vite.config.js` and a `location` in
`nginx.conf`, both placed **before** the general `/api` rule.

Read [Conventions](#conventions) before the first commit — it is short, and
every line in it is a bug somebody already shipped.

---

## Troubleshooting

**`Database unavailable — is PostgreSQL running and migrated?`**
The API started before the tables existed. Run
`docker compose exec backend npx prisma migrate dev --name init`.

**`The database client is out of date with the schema`**
You edited `schema.prisma` but never migrated, so the generated client still
knows the old columns — the giveaway in the log is Prisma suggesting field names
you removed. Fix it with:

```bash
docker compose exec backend npx prisma migrate dev --name your_change
docker compose restart backend
```

The restart matters: Node loaded the old client into memory at boot, and
regenerating files on disk does not change what is already running. (`npm run
dev` also runs `prisma generate` at container start, so a plain
`docker compose restart backend` fixes a client that is merely stale — but only
a migration adds the columns to the database itself.)

**`Error: P1001: Can't reach database server`**
Postgres is still starting. `docker compose ps` should show it as `healthy`;
give it a few seconds and retry.

**Port 5432 is already in use**
You have a local PostgreSQL running. Change `POSTGRES_PORT` in `.env` to e.g.
`5433` — this only affects the port exposed on your machine, not the one the
backend container uses.

**`Request failed (502)` on the maintenance page, but the service is healthy**
The gateway could not reach it, which is a different thing from the service being
down — if maintenance were down you would get a readable 503 instead. Check
`docker compose ps`: if `hostel_frontend` was **created** before the last change
to `docker-compose.yml`, its environment is stale and
`VITE_MAINTENANCE_PROXY_TARGET` is unset, so Vite falls back to
`http://localhost:5100` — which, inside the frontend container, is the frontend
itself. Recreate it:

```bash
docker compose up -d frontend
```

**A button does nothing, or an action returns 500 with a CORS message**
Chrome attaches an `Origin` header to every non-GET request, even a same-origin
one. Requests reach a service through the gateway, so they *are* same-origin —
but a POST still arrives carrying `Origin: http://127.0.0.1:5173`, and if
`CORS_ORIGINS` happens to spell that host `localhost` it used to be refused.
The symptom was distinctive: every page loaded and every list rendered (GETs
carry no Origin), and then every button failed.

Both services now compare the origin against the request's own host and let a
genuinely same-origin request through however it is spelled, and in development
also allow loopback and private LAN addresses so testing from a phone works. A
refused origin no longer throws — it simply gets no `Access-Control-Allow-Origin`
header, which is what CORS is supposed to do, and the reason is logged
server-side naming the origin to add to `CORS_ORIGINS`. See
`src/config/cors.js` in either service.

**`restart` is not `up -d`**
`docker compose restart` re-runs the process inside the *existing* container. It
never re-reads `docker-compose.yml`, so a changed environment variable, port or
volume is silently ignored. After editing the compose file always use
`docker compose up -d <service>`, which recreates the container when the config
has drifted. Source-code changes need neither — both services watch their files.

**Changes don't hot-reload in Docker**
See [Seeing your changes](#seeing-your-changes) above — both services poll,
because bind-mount file events are unreliable on Windows and macOS. If polling
still misbehaves, run that service on your host with `npm run dev` instead.

**`sh: <package>: not found` after adding a dependency**
The `node_modules` volume is masking the rebuilt image — a rebuild on its own
does not refresh it. See [Adding a dependency](#adding-a-dependency) above.

**Maintenance returns 500, or `relation "MaintenanceRequest" does not exist`**
The maintenance service's own database was never created or never migrated. It
is a separate database from `hostel_db` — see
[Adding it to an existing install](#adding-it-to-an-existing-install).

**Maintenance health reports `coreApi: unreachable`**
That is informational, not an error — the service is up and serving. It means the
core API is down, so newly logged jobs will not carry a reporter snapshot unless
the room is supplied. Start the backend and it clears itself.

**`migrate dev` refuses: "changes that cannot be executed"**
You added a required column to a table that already has rows, and Prisma will
not invent values for them. It is right to refuse. Write the migration by
hand — add the column nullable, backfill it, then enforce it. See
[Conventions](#conventions) and the points migration for a worked example.

**A badge shows the wrong label**
Check `StatusBadge.jsx` has an entry for that status. A missing one used to
fall back to `PENDING` and display "Pending review"; it now renders the raw
status and logs a warning in development naming what to add.

**Points: "Set a spending PIN before using your points"**
Expected on a first purchase. Students start without a PIN; setting one needs
the account password, which for the demo accounts is `Password123`.

**Everything is wedged**
`docker compose down -v && docker compose up -d --build`, then create
`maintenance_db`, migrate and seed **both** services again. This deletes both
databases.

---

## Testing

There is no test runner wired into `npm test`. The suites are written and run
against an in-memory stand-in for the Prisma client, plus a real PostgreSQL for
anything where the guarantee being relied on is the database's own.

| Suite | Covers |
| --- | --- |
| Lifecycle and permissions | Every status transition, who may drive it, and what each role can see |
| Concurrency | Simultaneous accepts, double-submits, reopen racing close, parallel wallet debits |
| Cross-service contract | A token minted by the core API's real signing code, presented to the maintenance service — this is what catches the two copies of the JWT guard drifting apart |
| End-to-end | The real UI driven in a headless browser: report → accept → resolve → close, and credit → set PIN → spend → reload |

**Every concurrency test was verified to fail against deliberately unguarded
code before it was trusted.** A green test that cannot go red is not evidence.
Remove the compare-and-swap and ten simultaneous 30-point spends against a
100-point balance end at **−200** instead of stopping at three.
