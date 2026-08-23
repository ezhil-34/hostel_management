# SmartHostel — Hostel Management System

Full-stack hostel management app: outpass requests with QR verification, a
maintenance service where students log repair jobs and hostel trade workers pick
them up, and a canteen/laundry points wallet.

| Layer    | Stack                                                         |
| -------- | ------------------------------------------------------------- |
| Frontend | React 19 · Vite 8 · Tailwind CSS 3 · React Router 7 · lucide-react |
| Services | Node.js 22 · Express 5 (ESM) · JWT auth · zod validation       |
| Database | PostgreSQL 16 · Prisma ORM 6 — one database per service        |
| Runtime  | Docker Compose (dev + production stacks)                       |

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

# 2. Build and start postgres + backend + frontend
docker compose up -d --build

# 3. Create the database tables
docker compose exec backend npx prisma migrate dev --name init

# 4. (optional) Load demo accounts and sample data
docker compose exec backend npm run db:seed
```

| Service         | URL                                                          |
| --------------- | ------------------------------------------------------------ |
| Frontend        | http://localhost:5173                                        |
| API health      | http://localhost:5000/api/health                             |
| Database health | http://localhost:5000/api/health/db                           |
| Adminer (DB UI) | http://localhost:8080 — start with `docker compose --profile tools up -d` |

If you are adding the maintenance service to an **existing** install, its
database will not create itself — see [Maintenance](#maintenance).

Demo logins after seeding (password `Password123`):

- `john@student.edu` — roll `21CS104`; no outpass yet, so he can walk the whole flow
- `priya@student.edu` — roll `21EC211`; currently out and an hour overdue
- `warden@hostel.edu` — warden; one profile request and one overdue pass waiting
- `security@hostel.edu` — gate guard; scans outpass QR codes
- `worker@hostel.edu` / `worker2@hostel.edu` — maintenance workers; see the job queue
- `admin@hostel.edu` — administrator

Everyday commands:

```bash
docker compose logs -f backend     # follow API logs
docker compose restart backend     # restart after an env change
docker compose down                # stop everything (data survives)
docker compose down -v             # stop and wipe the database volume
```

---

## Seeing your changes

Both services reload on save — your project folder is bind-mounted into the
containers, so there is nothing to copy or rebuild for ordinary code edits.

| You changed…                        | What happens                           | What you do                                        |
| ----------------------------------- | -------------------------------------- | -------------------------------------------------- |
| `frontend/src/**` (jsx, css)        | Vite hot-swaps the module              | Nothing — the browser updates in place              |
| `backend/src/**` (js)               | nodemon restarts the API in ~1s        | Nothing — re-trigger the request                    |
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

```bash
# --- Backend ---
cd backend
cp .env.example .env               # then set DATABASE_URL to your postgres
npm install
npx prisma migrate dev --name init
npm run db:seed                    # optional
npm run dev                        # http://localhost:5000

# --- Frontend (second terminal) ---
cd frontend
cp .env.example .env
npm install
npm run dev                        # http://localhost:5173
```

The Vite dev server proxies `/api` to `VITE_PROXY_TARGET` (default
`http://localhost:5000`), so the browser only ever talks to one origin and
there are no CORS surprises in development.

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
├── docker-compose.yml            # dev stack: postgres + backend + frontend (+ adminer)
├── docker-compose.prod.yml       # production stack: nginx-served frontend
├── .env.example                  # compose configuration
│
├── backend/
│   ├── Dockerfile                # multi-stage: development | production
│   ├── prisma/
│   │   ├── schema.prisma         # data model
│   │   └── seed.js               # demo accounts and sample records
│   └── src/
│       ├── server.js             # http server + graceful shutdown
│       ├── app.js                # express app: helmet, cors, rate limiting
│       ├── config/               # env parsing, prisma client singleton
│       ├── middleware/           # auth guard, zod validation, error handler
│       ├── utils/                # jwt, password hashing, ApiError
│       ├── routes/index.js       # /api router + health checks
│       └── modules/
│           ├── auth/             # routes → controller → service → schema
│           ├── profile/          # + profile.policy.js (field permissions)
│           └── outpass/          # request → approve → gate scan → return
│
├── maintenance-service/          # its own process, image, database, migrations
│   ├── Dockerfile
│   ├── prisma/
│   │   ├── schema.prisma         # maintenance_db — no FK reaches hostel_db
│   │   └── seed.js
│   └── src/
│       ├── clients/coreApi.js    # the ONE outbound call, at write time only
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
        ├── lib/api.js            # fetch wrapper with auto token refresh
        ├── context/
        │   ├── AuthContext.jsx
        │   ├── ToastContext.jsx     # useToast() — success/error/info/warning
        │   └── ConfirmContext.jsx   # useConfirm() — promise-based dialog
        ├── components/           # ProtectedRoute, StatusBadge, OutpassCard, …
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


## Data model

`User` — students, wardens, admins and staff. Unique on both `email` and
`rollNumber`, so sign-in accepts either.

`RefreshToken` — hashed sessions with expiry and revocation.

`Outpass` — destination, leave/return times, reason, status, the reviewer and
their note, the `verifyToken` behind the QR, and the gate log (`exitedAt`,
`returnedAt`, and which guard recorded each). See [Outpasses](#outpasses) above.

`Wallet` + `PointTransaction` — one `CANTEEN` and one `LAUNDRY` wallet per
student, each with a balance, an optional spending PIN, and a transaction
ledger. Wallets are created automatically at signup.

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

On the frontend, add the calls to `src/lib/api.js`. A new service also needs a
proxy entry in `vite.config.js` and a `location` in `nginx.conf`, both placed
**before** the general `/api` rule.

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

**Everything is wedged**
`docker compose down -v && docker compose up -d --build`, then migrate and seed
**both** services again. This deletes both databases.
