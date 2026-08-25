# SmartHostel — setup runbook

Everything needed to go from a clean checkout to a running stack, in order.
You need Docker Desktop and nothing else — Node, Postgres and Prisma all run
inside containers.

Run every command from the repository root
(`D:\Currently_Working_Project\hostel_management\hostel_management`).

---

## 1. Environment file

```bash
cp .env.example .env
```

PowerShell:

```powershell
copy .env.example .env
```

The defaults work for local development. The only value worth changing now is
`APP_PUBLIC_URL` — set it to your machine's LAN address (e.g.
`http://192.168.1.20:5173`) if you want to scan an outpass QR code with a real
phone. A QR containing `localhost` points the phone at itself.

---

## 2. Build and start everything

```bash
docker compose up -d --build
```

This builds four images and starts `postgres`, `backend`, `maintenance-service`
and `frontend`. First run takes a few minutes.

Wait for Postgres to report healthy before continuing:

```bash
docker compose ps
```

---

## 3. Create the maintenance database

Each service owns its own database. `hostel_db` is created by Postgres itself
from `POSTGRES_DB`; `maintenance_db` is not.

```bash
docker compose exec postgres psql -U hostel -d hostel_db -c "CREATE DATABASE maintenance_db;"
```

Two things that trip people up here:

- **`-d hostel_db` is required.** Without it `psql` looks for a database named
  after the user (`hostel`), which does not exist.
- **`already exists` is fine.** `postgres/init/01-create-databases.sh` creates it
  automatically, but only when the Postgres volume is brand new. If you have run
  this project before, the script never ran and you need this command. If it did
  run, this command errors harmlessly. Either way you end up correct.

---

## 4. Migrate and seed the core API

```bash
docker compose exec backend npx prisma migrate dev --name init
docker compose exec backend npm run db:seed
```

Creates `User`, `RefreshToken`, `ProfileChangeRequest`, `Outpass`, `Wallet`,
`PointTransaction`, `Counter` and `MenuItem`, then loads the demo accounts, the
wallet ledgers and three counters with their menus.

Students start with no spending PIN — the Points page asks for one on the first
purchase, and setting it needs the account password (`Password123` for the demo
accounts).

---

## 5. Migrate and seed the maintenance service

```bash
docker compose exec maintenance-service npx prisma migrate dev --name init
docker compose exec maintenance-service npm run db:seed
```

Creates `MaintenanceRequest`, `MaintenanceComment` and `MaintenanceEvent` in
`maintenance_db`, then puts three jobs in the worker queue.

---

## 6. Verify

```bash
docker compose ps
```

All four services `Up`, with `postgres`, `backend` and `maintenance-service`
marked `(healthy)`.

Then check each service answers:

| What | URL | Expect |
| --- | --- | --- |
| Core API | http://localhost:5000/api/health | `status: ok` |
| Core API database | http://localhost:5000/api/health/db | `database: up` |
| Maintenance | http://localhost:5100/api/maintenance/health | `database: up`, `coreApi: up` |
| The app | http://localhost:5173 | sign-in page |

If maintenance reports `coreApi: unreachable`, that is informational, not an
error — the service is up and serving. It means the core API is down, so newly
logged jobs will not carry a reporter snapshot.

---

## 7. Sign in

Password for every demo account: `Password123`

| Account | Role | What to try |
| --- | --- | --- |
| `john@student.edu` | student, room B-302 | Report a fault, request an outpass, spend points |
| `priya@student.edu` | student | Currently out and an hour overdue |
| `worker@hostel.edu` | maintenance worker | Work queue — three jobs waiting |
| `worker2@hostel.edu` | maintenance worker | The second worker, for the accept race |
| `warden@hostel.edu` | warden | Approvals, oversight, reassign, top up wallets |
| `security@hostel.edu` | gate guard | Scan outpass QR codes |
| `admin@hostel.edu` | administrator | Everything |

---

## Everyday commands

```bash
docker compose logs -f backend              # follow API logs
docker compose logs -f maintenance-service  # follow maintenance logs
docker compose up -d <service>              # apply a docker-compose.yml change
docker compose restart <service>            # re-run the process only
docker compose down                         # stop everything, data survives
docker compose --profile tools up -d        # add Adminer on :8080
```

Source-code changes need none of these — both services watch their files and
reload on save, and Vite hot-reloads the frontend.

---

## `restart` is not `up -d`

This distinction causes the most confusing failures in this project, so it is
worth internalising:

- **`docker compose restart <service>`** re-runs the process inside the existing
  container. It never re-reads `docker-compose.yml`.
- **`docker compose up -d <service>`** re-reads the compose file and recreates
  the container when the configuration has drifted.

So after changing an environment variable, port or volume, `restart` silently
does nothing. The classic symptom is a **502 on the maintenance page while
`/api/maintenance/health` works perfectly** — the frontend container predates
`VITE_MAINTENANCE_PROXY_TARGET`, so Vite proxies to `localhost:5100`, which
inside that container is the frontend itself. Fix: `docker compose up -d frontend`.

---

## Adding a dependency

`node_modules` is a **named volume** per service. Docker populates it only when
it is first created, so rebuilding the image alone does not install anything new:

```bash
docker compose exec backend npm install <package>
docker compose restart backend
```

The symptom of getting this wrong is `sh: <package>: not found` in a restart
loop. If the volume itself is corrupt, drop it **by name** — never
`docker compose down -v`, which would take `postgres_data` with it:

```bash
docker compose down
docker volume rm hostel-management_backend_node_modules
docker compose up -d --build backend
```

---

## After changing a schema

Migrate the service that owns the schema you edited:

```bash
docker compose exec backend npx prisma migrate dev --name describe_your_change
docker compose exec maintenance-service npx prisma migrate dev --name describe_your_change
```

`npm run dev` runs `prisma generate` at container start, so a stale client is
fixed by a restart — but only a migration adds the columns to the database.

---

## Starting over

Wipes both databases and rebuilds from nothing:

```bash
docker compose down -v
docker compose up -d --build
```

Then repeat steps 3 through 5. On a genuinely fresh volume, step 3 is done for
you by the init script.

---

## Proving the services are independent

Worth doing once — it is the difference between this being a microservice and
merely being two folders:

```bash
docker compose stop backend
```

Log a maintenance job. It still works: the reporter snapshot degrades, filing
does not fail.

```bash
docker compose start backend
docker compose stop maintenance-service
```

Use outpasses and profiles. Completely unaffected. Only the maintenance page
shows an error card, and it says so.

```bash
docker compose start maintenance-service
```
