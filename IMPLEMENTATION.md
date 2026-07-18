# Implementation Guide

This document explains how Forge & Flight is actually built — the architecture, every moving part, why things are structured the way they are, and where the rough edges are. It's written for someone joining the project with zero prior context. If you just want to run the app, see [README.md](README.md) instead; come here when you're ready to change code.

---

## 1. What this app is

Forge & Flight is a startup-incubator platform. The core idea: **accounts are people, and startups are pages a person creates and owns** — like a Facebook profile vs. a Facebook Page. Any signed-in person can:

- create one or more startup pages
- post progress updates to a shared feed (milestones, funding announcements, "we're hiring" posts, etc.)
- browse other startups, save/follow them, comment, apply to open roles, or invest

There is no "Founder account" vs. "Investor account" toggle. Whether you see founder controls (Edit/Manage) or investor controls (Save/Follow/Invest) on a given startup is decided by one check: **do you own it?** (`startup.ownerId === currentUser.id`).

---

## 2. Tech stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 19 + Vite + react-router-dom | Fast dev server, no framework opinions beyond routing |
| Backend | Django 6 + Django REST Framework | Batteries-included: ORM, admin, auth, serialization |
| Database | PostgreSQL 16 (via Docker) | Relational data (users own startups own posts/comments/...), plus native array fields for tags |
| Auth | Django session cookies + CSRF token | Simplest thing that works for a same-origin-ish dev setup; not JWT |

The frontend and backend are **two separate processes** that talk over HTTP. The frontend never touches the database directly — everything goes through the Django REST API.

---

## 3. Repository layout

```
Forge & Flight/
├── README.md                 ← setup/run instructions (start here to get it running)
├── IMPLEMENTATION.md          ← this file
├── src/                       ← React app
│   ├── main.jsx                entry point
│   ├── App.jsx                 <AppProvider> + <BrowserRouter> + route table
│   ├── context/AppContext.jsx  ★ the most important file — see §6
│   ├── api/client.js           fetch wrapper (auth cookies, CSRF)
│   ├── utils/timeAgo.js        "2h ago" style relative timestamps
│   ├── pages/                  one file per route (Feed, Profile, Login, ...)
│   ├── components/             shared UI (Topbar, FeedCard, modals, ...)
│   ├── data/startups.js        NOT live data anymore — just helper functions (see §6.4)
│   ├── data/posts.js           same — helpers + a local "load more" simulation pool
│   └── styles/                 plain CSS, one file per page/concern
│
└── backend/                   ← Django project
    ├── manage.py
    ├── docker-compose.yml      local PostgreSQL
    ├── requirements.txt
    ├── .env.example            copy to .env — see README
    ├── config/                 settings.py, root urls.py, wsgi/asgi
    ├── core/                   health check + the demo-data seeder
    ├── accounts/                custom User model + auth endpoints
    ├── startups/                Startup and everything that hangs off it
    ├── posts/                   feed posts
    ├── messaging/                conversations (backend only — not wired to UI yet)
    └── notifications/            per-user notifications (backend only — not wired to UI yet)
```

---

## 4. How a request actually flows

Example: viewing the HealthSync profile page.

1. Browser loads `http://localhost:5173/profile/healthsync` (Vite dev server, port 5173).
2. React Router matches `/profile/:id` → renders `src/pages/Profile.jsx`.
3. `Profile.jsx` calls `useApp()` to read `startups.healthsync` out of `AppContext`.
4. That data didn't come from `Profile.jsx` itself — `AppContext` fetched **every** startup, fully populated, once, when the app first loaded (see §6.1). `Profile.jsx` just reads from that already-loaded object.
5. If you post a comment: `Profile.jsx` calls `addComment(id, text)` from context → that function does `POST http://localhost:8000/api/comments/` (Django, port 8000) → Django saves a `StartupComment` row in Postgres → the response comes back → `AppContext` updates its local `comments` state → React re-renders the Comments tab.

The two servers are separate origins (`5173` vs `8000`), so every API call is cross-origin. That's why `django-cors-headers` and the CSRF cookie dance in `src/api/client.js` exist (see §7.3).

---

## 5. Backend deep dive

### 5.1 Django project structure

`backend/config/` is the Django *project* (global settings, root URL routing). Everything else (`accounts/`, `startups/`, `posts/`, `messaging/`, `notifications/`, `core/`) is a Django *app* — a self-contained module with its own `models.py` / `serializers.py` / `views.py` / `urls.py` / `admin.py`. This is standard Django convention: one app per bounded concern.

All app URLs are mounted under `/api/` in `config/urls.py`:

```python
path('api/', include('core.urls')),
path('api/', include('accounts.urls')),
path('api/', include('startups.urls')),
path('api/', include('posts.urls')),
path('api/', include('messaging.urls')),
path('api/', include('notifications.urls')),
```

### 5.2 The data model

**`accounts.User`** (custom user model, replaces Django's default) — a person.
- `email` (login identifier, unique), `first_name`, `last_name`
- `slug` — auto-generated from name (e.g. `amara-chen`), used nowhere critical right now but kept for readable URLs later
- `bio`, `location`
- `name` and `initials` are **computed properties**, not database columns (derived from first/last name)
- `saved_startups`, `followed_startups` — many-to-many to `Startup`

**`startups.Startup`** — a startup's page. Primary key is `slug` (e.g. `"healthsync"`), not a numeric id — this is what shows up in URLs (`/profile/healthsync`).
- `name`, `initials`, `verified`, `tagline`, `overview`
- `owner` — ForeignKey to `User`. **This single field is what "ownership" means everywhere in the app.**
- `status` — one of `open` / `soon` / `closed` (funding status)
- `tags` — a Postgres `ArrayField` of strings (not a separate Tag table — tags are always just a flat list here)
- `goal`, `raised` — integers (dollars)
- `deadline` — a free-text label like `"3 days left"` (deliberately just a string, not a computed date — matches how the original frontend mockup displayed it)

Everything else about a startup is a **separate model with a ForeignKey back to `Startup`**, because each one is a list:
- `TeamMember` (name, title, order)
- `TimelineEvent` (date_label, title, description, order)
- `Document` (name, size, optional file upload, order)
- `UpdateEntry` (text, timestamp) — the "recent updates" bullet list
- `StartupComment` (author, text, timestamp)
- `CollaborationRole` — **one-to-one**, not one-to-many (a startup has at most one open role at a time): role title + description
- `Application` — someone applying to a `CollaborationRole`: applicant, role, name, email, link, message, `status` (`pending`/`accepted`/`declined`)
- `Investment` — someone offering to invest: investor, amount, `status` (`pending`/`accepted`/`rejected`/`completed`)

**`posts.Post`** — one feed entry. `kind` is either `'update'` (tied to a startup) or `'event'` (the one platform-wide "Pitch Day" announcement, `startup` is null). Has its own `post_type` (free text like "Milestone Update", "Funding Announcement" — not a fixed enum, since the UI lets founders type anything), `title`, `text`, `tags`, optional `media` label.

**`messaging.Conversation`** / **`messaging.Message`** and **`notifications.Notification`** exist as full Django apps with models/serializers/views, but **the frontend doesn't call them yet** — `Messages.jsx` and `Notifications.jsx` still show hardcoded mock arrays. See §9.

### 5.3 API endpoints (all under `/api/`)

| Method + path | What it does |
|---|---|
| `GET /health/` | liveness check |
| `GET /csrf/` | sets the CSRF cookie (call before your first POST/PATCH/DELETE) |
| `POST /auth/register/` | create account, logs you in |
| `POST /auth/login/` | `{email, password}` → logs in |
| `POST /auth/logout/` | ends the session |
| `GET` / `PATCH /auth/me/` | read/update your own profile |
| `GET /users/` | list users (read-only) |
| `GET /startups/`, `GET /startups/<slug>/` | **always returns the full nested shape** — team, timeline, docs, updates, comments, collab role all included, even in the list view (see §5.4 for why) |
| `POST /startups/` | create a startup (you become the owner automatically) |
| `PATCH /startups/<slug>/` | edit — only the owner can (`IsOwnerOrReadOnly`) |
| `POST /startups/<slug>/save/` \| `unsave/` \| `follow/` \| `unfollow/` | toggle actions on the *logged-in user's* saved/followed lists |
| `GET /comments/?startup=<slug>` | comments, optionally filtered |
| `POST /comments/` | `{startup, text}` — author is always the logged-in user |
| `GET /applications/?startup=<slug>&mine=1` | collaboration applications |
| `POST /applications/`, `PATCH /applications/<id>/` | apply / change status |
| `GET /investments/?startup=<slug>&mine=1`, `POST`, `PATCH`, `DELETE` | same pattern for investment requests |
| `GET /posts/?startup=<slug>`, `POST /posts/` | the feed |
| `GET/POST /conversations/`, `GET/POST /messages/?conversation=<id>` | messaging (unused by frontend) |
| `GET/PATCH /notifications/` | notifications (unused by frontend) |

The **Django admin** (`/admin/`) is also wired up for every model — useful for poking at data directly without writing curl commands. Create a superuser with `python manage.py createsuperuser`.

### 5.4 Why `StartupViewSet` always returns the full nested object

A more "correct" REST API would have a lightweight list endpoint (just name/tagline/status) and a heavier detail endpoint (everything). This one doesn't — `list` and `retrieve` both use `StartupDetailSerializer`. That's deliberate: the frontend keeps *every* startup, fully loaded, in memory at all times (see §6.1) — components like `RightRail.jsx` reach into `startups['medai']` synchronously with no loading state of their own. At this app's scale (a handful of demo startups), the cost of over-fetching is negligible and it removes an entire class of "did I fetch the detail yet?" bugs. If this app ever needs to support thousands of startups, this is the first thing to revisit — you'd want a slim list serializer and to teach the frontend to fetch details lazily per-profile-page.

### 5.5 A DRF gotcha worth knowing about

`StartupViewSet` uses **different serializers for reading vs. writing** (`StartupDetailSerializer` for GET, `StartupWriteSerializer` — just `name/tagline/tags/goal/overview` — for POST/PATCH, because you shouldn't be able to set `raised` or `owner` directly from the create form). DRF's default `create()`/`update()` behavior is to serialize the **response** with whatever serializer handled the **request** — which means a plain `ModelViewSet` would hand back only `name/tagline/tags/goal/overview` after creating a startup, missing `slug`, `owner`, `team`, etc. The frontend needs the full object back (it uses the response directly to update its local state). Fixed by overriding `create()`/`update()` to re-serialize the saved instance with `StartupDetailSerializer` before returning it — see `startups/views.py`. Keep this pattern in mind any time you split read/write serializers on a viewset.

### 5.6 Auth: sessions, not tokens

Login (`POST /auth/login/`) calls Django's built-in `login()`, which sets a session cookie. Every subsequent request must include that cookie (`credentials: 'include'` on the frontend's `fetch` calls) for Django to know who you are.

Django also requires a **CSRF token** on any unsafe method (POST/PATCH/DELETE) as a second line of defense — a value that must be sent both as a cookie and as a request header (`X-CSRFToken`), so a malicious third-party site can't forge a POST on your behalf just by having your cookie. `GET /api/csrf/` is a dedicated endpoint (`@ensure_csrf_cookie`) that guarantees the cookie is set; `src/api/client.js` calls it automatically the first time it needs to make a write request.

Two settings make this work cross-origin in dev: `CORS_ALLOW_CREDENTIALS = True` (let the browser send/receive cookies to a different origin) and `CSRF_TRUSTED_ORIGINS` (tell Django that `http://localhost:5173` is allowed to submit CSRF-protected requests).

### 5.7 Seed data

`python manage.py seed_demo` (defined in `backend/core/management/commands/seed_demo.py`) populates the database with 5 demo startups (HealthSync, EcoRide, MedAI, FarmChain, Nimbus Robotics) — including their team, timeline, documents, updates, comments, and one seed post each — transcribed directly from the original frontend-only mockup's hardcoded data. It also creates a `User` for each startup's owner and each comment's author, all with the password `password123`.

It's **idempotent** — built on `Startup.objects.update_or_create(slug=...)`, so re-running it after a fresh `migrate` (e.g. after wiping the database) just re-syncs the same data rather than erroring on duplicates.

---

## 6. Frontend deep dive

### 6.1 `AppContext.jsx` — the center of gravity

Almost the entire app reads and writes state through one React Context, via the `useApp()` hook. If you're trying to understand how data gets from the database to the screen, **start here**.

On mount, `AppProvider` fires off three requests in parallel:
```js
const [startupList, postList, me] = await Promise.all([
  api.get('/startups/'),
  api.get('/posts/'),
  api.get('/auth/me/').catch(() => null),   // null if not logged in — not an error
]);
```
Until that resolves, `AppProvider` renders a plain "Loading…" screen instead of `children` — **nothing in the app tree ever has to handle "startups aren't loaded yet."** This is why `RightRail.jsx` can safely do `startups['medai'].initials` with no null-check.

If `/auth/me/` succeeds, it also fetches `applications` and `investments` (these require login — a logged-out visitor gets empty arrays instead of a 403 crash).

Every mutating function in the context follows the same shape: call the API, then update local React state from the response so the UI reflects it immediately without a full refetch. For example:
```js
async function addComment(startupId, text) {
  const created = await api.post('/comments/', { startup: startupId, text });
  setComments((cur) => ({
    ...cur,
    [startupId]: [...(cur[startupId] || []), { id: created.id, name: created.author_name, text: created.text, time: timeAgo(created.created_at) }],
  }));
}
```

### 6.2 The shape-preservation trick

This is the single most important design decision in the frontend integration, and the reason the rewrite didn't require touching almost any page component.

Before the backend existed, `AppContext` was seeded from two static JS files (`src/data/startups.js`, `src/data/posts.js`) using specific, slightly quirky shapes — e.g. a startup's team was an array of `[name, title]` **tuples**, not `{name, title}` objects, because that's how someone hand-wrote the original mock data.

Every page component (`Profile.jsx`, `FeedCard.jsx`, `AccountProfile.jsx`, ...) was written against those exact shapes: `s.team.map(([name, title]) => ...)`.

When wiring up the real backend, the Django REST API naturally returns a *different* shape — proper JSON objects like `{id, name, title, order}`. Rather than rewriting every page to match the API's shape, `AppContext.jsx` **transforms** each API response back into the exact shape the pages already expect, right at the fetch boundary:

```js
function transformStartup(s) {
  return {
    // ...
    team: (s.team || []).map((t) => [t.name, t.title]),          // object → tuple
    timeline: (s.timeline || []).map((t) => [t.date_label, t.title, t.description]),
    docs: (s.docs || []).map((d) => [d.name, d.size]),
    // ...
  };
}
```

**The lesson:** when swapping a data source under an existing UI, it's often far less risky to translate at one boundary than to propagate the new shape through every consumer. If you add a new field to the API, decide deliberately whether it belongs in a `transformX` function (keeping the old shape) or whether it's time to update the shape everywhere (bigger change, but more "correct" long-term).

All the `transformX` functions live at the top of `AppContext.jsx`: `transformUser`, `transformStartup`, `transformComments`, `transformPost`, `transformApplication`, `transformInvestment`.

### 6.3 Derived vs. stored state

Some things in context are **not** stored directly — they're computed with `useMemo` from other state, every render:

- `saved` / `followed` (JS `Set`s) — derived from `currentUser.saved_startups` / `followed_startups` (arrays of slugs the API returns)
- `myStartups` — `Object.entries(startups).filter(([, s]) => s.ownerId === currentUser.id)`
- `collaboratingIds` — startups where you have an *accepted* collaboration `Application` and you're *not* the owner

This matters because it means, for example, accepting someone's collaboration application on the Founder Dashboard makes that startup show up under "Collaborating On" on *their* account page automatically — there's no separate step to "add" it, it just falls out of the `applications` list already containing that accepted record.

### 6.4 What `src/data/*.js` are for now

These two files used to be the actual data source. Now they're pure utility exports — `statusMeta()`, `fmtMoney()`, `fundingPct()`, `initialsOf()`, `slugify()`, `LOGO_GRADIENTS`, `POST_TYPES` — still imported all over the UI, but the `STARTUPS` and `INITIAL_POSTS` objects they also export are **dead** (nothing imports them anymore). Don't be confused into thinking these files feed the app.

One exception: `posts.js`'s `nextPostBatch()` / `MORE_POOL` is still live — it's the local pool of extra posts used to simulate "infinite scroll" on the feed. That's deliberately still a frontend-only simulation, not backed by real pagination (see §9).

### 6.5 `src/api/client.js`

A thin `fetch` wrapper (`api.get/post/patch/delete`) that every context function funnels through. It handles:
- `credentials: 'include'` on every request (send/receive the session cookie)
- Auto-attaching `X-CSRFToken` from the cookie on unsafe methods, calling `GET /csrf/` first if the cookie isn't set yet
- Parsing JSON and throwing an `Error` (with `.status` and `.data` attached) on non-2xx responses, so callers can `try/catch` and read `err.data` for field-level validation errors

### 6.6 Routing (`App.jsx`)

Plain `react-router-dom` route table, one page component per path. No route guards — visiting `/feed` while logged out works fine, you just see everyone else's content with no owner/founder controls (since `currentUser` is a `GUEST_USER` placeholder with `id: null`, which never equals a real `ownerId`).

### 6.7 Page/component map

| File | Route | Notes |
|---|---|---|
| `pages/Landing.jsx` | `/` | marketing page, no data deps |
| `pages/Login.jsx` | `/login` | real login + register forms, calls `login()`/`registerUser()` |
| `pages/Feed.jsx` | `/feed` | the main feed; infinite scroll appends from the local mock pool, not the API |
| `pages/Profile.jsx` | `/profile/:id` | the 9-ish tab startup page (Overview/Team/Timeline/Funding/Documents/Gallery/Collaboration/Updates/Comments) |
| `pages/Explore.jsx` | `/explore` | also serves Funding/Collaboration/Saved via `?filter=` |
| `pages/AccountProfile.jsx` | `/account` | your own profile: startups you own + startups you're collaborating on |
| `pages/FounderDashboard.jsx` | `/dashboard/:id` | manage a startup you own — guards on `ownerId !== currentUser.id` |
| `pages/InvestorPortfolio.jsx` | `/portfolio` | mix of real data (`investments` from context) and hardcoded mock tabs |
| `pages/Settings.jsx` | `/settings` | edit profile, log out |
| `pages/Messages.jsx`, `pages/Notifications.jsx` | `/messages`, `/notifications` | **fully mock**, not connected to the backend apps of the same name |
| `components/FeedCard.jsx` | — | renders one feed post, including owner-vs-investor-vs-guest controls |
| `components/CreateStartupModal.jsx`, `CreatePostModal.jsx` | — | forms that call `createStartup()` / `addPost()` |
| `components/InvestButton.jsx` | — | the reusable "Invest Now" widget used on both feed cards and profile pages |

---

## 7. Key decisions, and why

- **Startups are owned pages, not an account type.** (See §1.) This replaced an earlier "Founder vs Investor account" design mid-project — worth knowing if you see references to that model in old notes; it no longer exists.
- **Session auth, not JWT.** Simpler to implement correctly for a single first-party frontend talking to a first-party backend in dev. If this app ever needs a mobile client or third-party API consumers, JWT (or OAuth) becomes worth the complexity.
- **Tags as a Postgres `ArrayField`, not a `Tag` model.** Tags are always used as a flat list of strings with no other behavior (no tag pages, no tag metadata) — a full model + M2M table would be pure overhead here.
- **`deadline` is a free-text string, not a real date.** The UI just displays whatever string is there ("3 days left", "Funding closed"). Nothing computes it. If you want real countdown logic, this is a field that needs redesigning (see §9).
- **The Founder Dashboard's edit forms don't persist.** "Manage Funding" and "Manage Collaboration" show a fake "Saved ✓" confirmation with no API call behind it — this was a deliberate scope cut, not an oversight (see §9).

---

## 8. Common gotchas

- **Windows + `&` in the folder path breaks `npm run dev`.** If you clone into a path containing `&` (or other shell-special characters), npm's generated `.cmd` shims corrupt themselves. Run `node node_modules/vite/bin/vite.js` directly instead.
- **DRF and reverse `OneToOneField`s.** `CollaborationRole` is a reverse one-to-one from `Startup` (a startup might not have one). You might expect accessing `startup.collab` on an instance without one to throw `RelatedObjectDoesNotExist` and crash the serializer — it doesn't, because DRF's field resolution catches `ObjectDoesNotExist` internally and serializes it as `null`. Don't add a defensive `try/except` for this; it's already handled.
- **DRF 403 vs 401.** An unauthenticated request to an `IsAuthenticated` endpoint returns **403**, not 401 (DRF's `SessionAuthentication` does this on purpose, to avoid triggering a browser's basic-auth popup). `AppContext`'s initial `/auth/me/` check relies on this — it's caught with `.catch(() => null)`, not a 401-specific check.
- **Split read/write serializers + DRF's default response.** See §5.5 — always double check what a ModelViewSet's `create`/`update` actually returns when the write serializer differs from the read serializer.
- **AUTH_USER_MODEL must be set before the first `migrate`.** If you ever need to change the custom User model's app/name, you can't do it after tables exist — you'd need to reset the database (`docker compose down -v && docker compose up -d`, then `migrate` + `seed_demo` again).

---

## 9. What's NOT done (don't be surprised)

These are deliberate, known gaps — not bugs to "discover":

- **Messages and Notifications pages are 100% mock data**, even though the backend has fully-working `messaging` and `notifications` Django apps with real endpoints. Wiring the frontend up to them is unstarted.
- **Founder Dashboard's funding/collaboration edit forms don't save anywhere.** Only *creating* a startup (name/tagline/tags/overview/goal) persists; editing `raised`, `deadline`, `status`, or the collaboration role afterward is local-only UI theater.
- **Feed infinite scroll is simulated**, not paginated from the API — it appends from a small hardcoded pool (`data/posts.js`'s `MORE_POOL`) and stops after 3 rounds.
- **No route guards.** Any page is reachable while logged out; components individually degrade gracefully (no owner controls, empty "my startups", etc.) rather than redirecting to `/login`.
- **Analytics numbers (profile views, engagement rate, "2.4k followers") are hardcoded** in `FounderDashboard.jsx` — there's no real analytics tracking.
- **Investor Portfolio's "Investment Portfolio" and "Investment History" tabs are fixed mock arrays**, separate from the real `investments` data — only the "Investment Requests" tab is real.

If you pick up one of these, the pattern to follow is exactly what §6.2 describes: add a `transformX` function in `AppContext.jsx`, wire a real API call, and keep the shape the existing UI already expects wherever possible.
