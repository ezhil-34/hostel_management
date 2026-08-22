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

- `john@student.edu` — roll `21CS104`
- `priya@student.edu` — roll `21EC211`
- `warden@hostel.edu` — warden role

Everyday commands:

```bash
docker compose logs -f backend     # follow API logs
docker compose restart backend     # restart after an env change
docker compose down                # stop everything (data survives)
docker compose down -v             # stop and wipe the database volume
```

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
│       └── modules/auth/         # routes → controller → service → schema
│
└── frontend/
    ├── Dockerfile                # multi-stage: development | build | nginx
    ├── nginx.conf                # SPA fallback + /api proxy
    ├── vite.config.js            # dev proxy, docker-friendly host binding
    └── src/
        ├── lib/api.js            # fetch wrapper with auto token refresh
        ├── context/AuthContext.jsx
        ├── components/ProtectedRoute.jsx
        └── pages/                # Home, SignIn, SignUp, Outpass, Maintenance, Points
```

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
| PATCH  | `/auth/me`              | Bearer | Update name / phone / room / block             |
| POST   | `/auth/change-password` | Bearer | Change password; signs out other sessions      |

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

After editing `prisma/schema.prisma`:

```bash
docker compose exec backend npx prisma migrate dev --name describe_your_change
```

---

## Adding a feature

The auth module is the template. For outpasses:

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

**Frontend changes don't hot-reload in Docker**
Bind-mount file events are unreliable on Windows and macOS. `CHOKIDAR_USEPOLLING`
is already set to `true` in `docker-compose.yml`; if it still misbehaves, run
the frontend on your host with `npm run dev` instead.

**`npm ci` fails inside the backend container after adding a package**
Rebuild rather than restarting: `docker compose up -d --build backend`. The
`node_modules` volume is intentionally separate from your host folder.

**Everything is wedged**
`docker compose down -v && docker compose up -d --build`, then migrate and seed
again. This deletes the database.
