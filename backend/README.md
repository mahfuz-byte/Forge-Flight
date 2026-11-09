# Forge & Flight — Backend

Django + Django REST Framework API, backed by PostgreSQL.

## First-time setup

1. **Start PostgreSQL.** A `docker-compose.yml` is provided:
   ```
   docker compose up -d
   ```
   (Requires Docker Desktop to be running. If you'd rather use a native PostgreSQL install, create a database and user matching the values in `.env` instead.)

2. **Activate the virtual environment** (already created at `backend/venv`):
   ```
   # PowerShell
   ./venv/Scripts/Activate.ps1

   # Git Bash
   source venv/Scripts/activate
   ```

3. **Configure environment variables.** `.env` already exists with local defaults matching `docker-compose.yml`. `.env.example` documents the variables if you need to point at a different database.

4. **Run migrations, seed demo data, and start the server:**
   ```
   python manage.py migrate
   python manage.py seed_demo          # loads the 5 demo startups + posts from src/data/*.js
   python manage.py createsuperuser    # optional, for /admin/
   python manage.py runserver
   ```

5. **Verify it's up:** `GET http://localhost:8000/api/health/` should return `{"status": "ok"}`.

## Project layout

- `config/` — Django project settings, root URLconf, WSGI/ASGI entrypoints.
- `core/` — health-check endpoint (`/api/health/`) + the `seed_demo` management command.
- `accounts/` — custom `User` model (email login, `bio`/`location`, `saved_startups`/`followed_startups`), register/login/logout/me endpoints.
- `startups/` — `Startup` + `TeamMember`/`TimelineEvent`/`Document`/`UpdateEntry`/`CollaborationRole`/`StartupComment`/`Application`/`Investment`.
- `posts/` — feed `Post` model (startup updates + the one-off event post).
- `messaging/` — `Conversation` + `Message` (one thread per person↔startup pair).
- `notifications/` — per-user `Notification` feed.
- `audit/` — append-only `AuditLog` of sensitive actions (sign-ins, role/status changes, staff edits, investments, every Django-admin change). Viewable read-only by super admins in Django admin.
- CORS is pre-configured to allow the Vite dev server (`http://localhost:5173`).

## API shape

All endpoints live under `/api/`. Auth is Django session auth (`/api/auth/login/`, `/api/auth/register/`, `/api/auth/logout/`, `/api/auth/me/`) — POST/PATCH requests need the `X-CSRFToken` header once a session cookie exists, same as any Django session-auth API. DRF's browsable API at any endpoint URL is the easiest way to explore this without curl.

Key resources: `/api/startups/` (+ `/save/`, `/unsave/`, `/follow/`, `/unfollow/` actions, list vs detail serializers), `/api/comments/?startup=<slug>`, `/api/applications/?startup=<slug>&mine=1`, `/api/investments/`, `/api/posts/?startup=<slug>`, `/api/conversations/`, `/api/messages/?conversation=<id>`, `/api/notifications/`.

Every demo user seeded by `seed_demo` gets the password from `DEMO_PASSWORD`, or a random one printed when the command finishes (e.g. `amara@healthsync.io` owns HealthSync).

## Security rules worth knowing

- **Uploads** (`core/uploads.py`): every file field has an allowlist of extensions, a check that the file's real bytes match the extension, and a size cap (avatar 5 MB, resume 10 MB, startup document 20 MB, post attachment 50 MB). HTML, SVG, scripts, executables, archives and macro-enabled Office files are rejected. Files are stored under random names.
- **Serving uploads in production**: Django only serves `/media/` when `DEBUG=True`. In production serve it from the web server or object storage with `X-Content-Type-Options: nosniff`, and preferably from a separate domain, so an uploaded file can never run as part of the app.
- **Audit log** (`audit/log.py`): call `record('thing.happened', target, **details)` for any new sensitive operation. Never put passwords, tokens or file contents in the details.
- **Admin APIs**: anything under `/api/admin/` must inherit `core.admin_api.AdminAPIMixin`; `core/test_access.py` fails otherwise. That test also fails when a new endpoint accepts anonymous writes or anonymous reads it hasn't been classified for.
- **Django admin**: only super admins can change roles, staff/superuser flags and permissions, or edit accounts with those privileges.

## Notes

- `venv/` and `.env` are gitignored — `requirements.txt` and `.env.example` are the source of truth for recreating them.
- The frontend (`../src`) does not call this API yet — it still runs entirely on in-memory `AppContext` state. Wiring it up is a separate step.
- `seed_demo` is idempotent (`update_or_create` on startup slug) — safe to re-run after pulling changes to the seed data.
