# Forge & Flight

A startup-incubator platform connecting founders and investors through a LinkedIn-style feed. Founders post progress updates (milestones, funding rounds, collaboration openings) and investors discover and back them while a funding window is open.

**Stack:** React 19 + Vite (frontend) · Django + Django REST Framework (backend) · PostgreSQL (database).

This is a full-stack app with two halves that both need to be running: the Django API and the React dev server. Follow the steps below in order.

## Prerequisites

Install these first if you don't have them:

- **Git**
- **Node.js** 20+ (comes with npm)
- **Python** 3.11+
- **Docker Desktop** — used to run PostgreSQL without installing it natively. (If you already have a native PostgreSQL server, you can skip Docker — see the note in step 2.)

## 1. Clone the repo

```bash
git clone <this-repo-url>
cd "Forge & Flight"
```

## 2. Start PostgreSQL

The backend needs a Postgres database. The easiest way is Docker:

```bash
cd backend
docker compose up -d
```

This starts a `postgres:16` container with a database named `forge_and_flight` (user `postgres`, password `postgres`) on port 5432.

> **Already have PostgreSQL installed natively instead?** Skip the Docker step and just create a database/user matching whatever you put in `backend/.env` in the next step.

## 3. Set up the backend

```bash
cd backend                       # if not already there
python -m venv venv

# Windows
.\venv\Scripts\Activate.ps1
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

Create your local env file from the template:

```bash
cp .env.example .env             # macOS/Linux
copy .env.example .env           # Windows
```

The defaults in `.env.example` already match the Docker Postgres setup from step 2, so you usually don't need to edit anything for local development.

Run migrations, load the demo data, and start the server:

```bash
python manage.py migrate
python manage.py seed_demo       # loads 5 demo startups + posts + users
python manage.py runserver
```

Leave this running. Check it's alive: open **http://localhost:8000/api/health/** — you should see `{"status": "ok"}`.

Every demo user seeded by `seed_demo` uses the password **`password123`** — e.g. `amara@healthsync.io` (owns HealthSync), `daniel@medai.io` (owns MedAI). Full endpoint reference: [`backend/README.md`](backend/README.md).

## 4. Set up the frontend

Open a **second terminal** (keep the backend running in the first one):

```bash
cd "Forge & Flight"              # the repo root, not backend/
npm install
```

Create your local env file:

```bash
cp .env.example .env             # macOS/Linux
copy .env.example .env           # Windows
```

The default (`VITE_API_URL=http://localhost:8000/api`) matches the backend from step 3 as-is.

Start the dev server:

```bash
npm run dev
```

Open **http://localhost:5173** in your browser.

> **Windows note:** if your clone path contains an `&` or other shell-special character (e.g. a folder literally named `Forge & Flight`), `npm run dev` may fail with `MODULE_NOT_FOUND` — this is a known npm/Windows `.cmd`-shim bug, not a project issue. Work around it by calling Vite directly: `node node_modules/vite/bin/vite.js`.

## 5. Try it out

- Click **Log in** — the form is prefilled with `amara@healthsync.io` / `password123`. Sign in and you'll land on `/feed` with real posts from the seeded startups.
- Open a startup profile and check the Team / Timeline / Documents / Comments tabs — all real data from the database, not mocks.
- Post a comment, then refresh the page — it's still there (confirms it's backend-persisted, not local React state).
- Try **Create Startup** from `/account`, or **Register** a brand-new account from the login screen.

## Project structure

```
Forge & Flight/
├── src/            React app (pages, components, AppContext)
├── backend/        Django project — see backend/README.md for API details
│   ├── config/     settings, root URLconf
│   ├── accounts/   custom User model, auth endpoints
│   ├── startups/   Startup + team/timeline/docs/comments/applications/investments
│   ├── posts/      feed posts
│   ├── messaging/  conversations (not yet wired into the frontend UI)
│   └── notifications/  per-user notifications (not yet wired into the frontend UI)
└── docker-compose.yml (in backend/) — local PostgreSQL
```

## Troubleshooting

- **`docker compose up` fails / can't connect to Docker** — Docker Desktop isn't running; start it and wait ~15s before retrying.
- **Backend `manage.py migrate` can't connect to the database** — check `docker ps` shows `backend-db-1` as `Up`, and that `backend/.env` matches the Docker Compose credentials.
- **Frontend shows a blank/loading screen forever** — the backend isn't running or isn't reachable at the `VITE_API_URL` in your root `.env`. Check the backend terminal for errors and confirm `/api/health/` responds.
- **CORS errors in the browser console** — make sure you're opening the frontend at `http://localhost:5173` (not `127.0.0.1:5173`, or vice versa) — the backend's allowed origins list is exact-match.
# Forge-Flight
