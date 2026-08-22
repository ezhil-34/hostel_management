# SmartHostel — Hostel Management System

Full-stack hostel management app: outpass requests with QR verification, maintenance
tickets, and a canteen/laundry points wallet.

| Layer    | Stack                                                         |
| -------- | ------------------------------------------------------------- |
| Frontend | React 19 · Vite 8 · Tailwind CSS 3 · React Router 7 · lucide-react |
| Backend  | Node.js 22 · Express 5 (ESM) · JWT auth · zod validation       |
| Database | PostgreSQL 16 · Prisma ORM 6                                   |
| Runtime  | Docker Compose (dev + production stacks)                       |

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

Demo logins after seeding (password `Password123`):

- `john@student.edu` — roll `21CS104`, student
- `priya@student.edu` — roll `21EC211`, student
- `warden@hostel.edu` — warden; starts with one request waiting in **Approvals**
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
| `backend/prisma/schema.prisma`      | Nothing until you migrate              | `docker compose exec backend npx prisma migrate dev --name your_change` |
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
│           └── profile/          # + profile.policy.js (field permissions)
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
        ├── components/           # ProtectedRoute, StatusBadge, ChangeRequestCard, …
        └── pages/                # Home, SignIn, SignUp, Profile, Outpass, Maintenance, Points
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
| POST   | `/auth/change-password` | Bearer | Change password; signs out other sessions      |

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

## Data model

`User` — students, wardens, admins and staff. Unique on both `email` and
`rollNumber`, so sign-in accepts either.

`RefreshToken` — hashed sessions with expiry and revocation.

`Outpass` — destination, leave/return times, reason, status
(`PENDING → APPROVED → COMPLETED`), and a QR payload for gate verification.

`MaintenanceRequest` — category, description, status (`OPEN → IN_PROGRESS →
RESOLVED → CLOSED`), optional photo and assignee.

`Wallet` + `PointTransaction` — one `CANTEEN` and one `LAUNDRY` wallet per
student, each with a balance, an optional spending PIN, and a transaction
ledger. Wallets are created automatically at signup.

`ProfileChangeRequest` — the approval ticket: which field, old and new value,
the requester's reason, status, and who reviewed it with what note.

After editing `prisma/schema.prisma`:

```bash
docker compose exec backend npx prisma migrate dev --name describe_your_change
```

---

## Adding a feature

The auth and profile modules are the template. For outpasses:

1. `src/modules/outpass/outpass.schema.js` — zod shapes for the request body.
2. `src/modules/outpass/outpass.service.js` — Prisma queries, no HTTP concerns.
3. `src/modules/outpass/outpass.controller.js` — read the request, call the
   service, shape the response.
4. `src/modules/outpass/outpass.routes.js` — wire it with `requireAuth` and
   `validate(...)`.
5. Register it in `src/routes/index.js` (the placeholders are already there).

On the frontend, add the calls to `src/lib/api.js` and replace the `useState`
seed arrays in the page with data fetched from the API.

---

## Troubleshooting

**`Database unavailable — is PostgreSQL running and migrated?`**
The API started before the tables existed. Run
`docker compose exec backend npx prisma migrate dev --name init`.

**`Error: P1001: Can't reach database server`**
Postgres is still starting. `docker compose ps` should show it as `healthy`;
give it a few seconds and retry.

**Port 5432 is already in use**
You have a local PostgreSQL running. Change `POSTGRES_PORT` in `.env` to e.g.
`5433` — this only affects the port exposed on your machine, not the one the
backend container uses.

**Changes don't hot-reload in Docker**
See [Seeing your changes](#seeing-your-changes) above — both services poll,
because bind-mount file events are unreliable on Windows and macOS. If polling
still misbehaves, run that service on your host with `npm run dev` instead.

**`sh: <package>: not found` after adding a dependency**
The `node_modules` volume is masking the rebuilt image — a rebuild on its own
does not refresh it. See [Adding a dependency](#adding-a-dependency) above.

**Everything is wedged**
`docker compose down -v && docker compose up -d --build`, then migrate and seed
again. This deletes the database.
