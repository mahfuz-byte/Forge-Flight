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
- CORS is pre-configured to allow the Vite dev server (`http://localhost:5173`).

## API shape

All endpoints live under `/api/`. Auth is Django session auth (`/api/auth/login/`, `/api/auth/register/`, `/api/auth/logout/`, `/api/auth/me/`) — POST/PATCH requests need the `X-CSRFToken` header once a session cookie exists, same as any Django session-auth API. DRF's browsable API at any endpoint URL is the easiest way to explore this without curl.

Key resources: `/api/startups/` (+ `/save/`, `/unsave/`, `/follow/`, `/unfollow/` actions, list vs detail serializers), `/api/comments/?startup=<slug>`, `/api/applications/?startup=<slug>&mine=1`, `/api/investments/`, `/api/posts/?startup=<slug>`, `/api/conversations/`, `/api/messages/?conversation=<id>`, `/api/notifications/`.

Every demo user seeded by `seed_demo` has password `password123` (e.g. `amara@healthsync.io` owns HealthSync).

## Notes

- `venv/` and `.env` are gitignored — `requirements.txt` and `.env.example` are the source of truth for recreating them.
- The frontend (`../src`) does not call this API yet — it still runs entirely on in-memory `AppContext` state. Wiring it up is a separate step.
- `seed_demo` is idempotent (`update_or_create` on startup slug) — safe to re-run after pulling changes to the seed data.
