# Remaining Tasks & Improvements

This is the punch list: what's genuinely unfinished, and what could be made better. Items are grouped by area and roughly ordered by priority within each group. If you're picking up work on this project, start with **§1 — Unfinished Core Features**, since those are gaps a user would actually notice, not polish.

For context on *why* things are currently built the way they are, read [IMPLEMENTATION.md](IMPLEMENTATION.md) first — several items below link back to sections there.

---

## 1. Unfinished core features

These are pages/buttons that already exist in the UI but don't do what they look like they do yet.

- [ ] **Wire Messages (`src/pages/Messages.jsx`) to the real `messaging` backend app.** The backend already has working `Conversation`/`Message` models and endpoints (`/api/conversations/`, `/api/messages/`) — see IMPLEMENTATION.md §5.2 and §6.7. The page currently renders a hardcoded `INITIAL` array and never calls the API. Follow the same pattern as `AppContext.jsx`: fetch conversations on load, transform into whatever shape the UI needs, add `sendMessage()`/`startConversation()` functions.
- [ ] **Wire Notifications (`src/pages/Notifications.jsx` and the Topbar's notification dropdown) to the real `notifications` backend app.** Same situation — `Notification` model and `/api/notifications/` endpoint exist and are unused.
- [ ] **Actually create `Notification` rows when things happen.** Right now nothing populates the `Notification` table at all — there's no signal/hook that fires when someone comments on your startup, applies to your role, invests, etc. This needs to be built before wiring the frontend to it is even useful. Likely approach: Django signals (`post_save` on `StartupComment`, `Application`, `Investment`) that create a `Notification` for the relevant startup's owner.
- [ ] **Make the Founder Dashboard's "Manage Funding" and "Manage Collaboration" forms actually save.** Currently (`src/pages/FounderDashboard.jsx`) they show a fake "Saved ✓" and never call the API — editing goal/raised/deadline/status or the collaboration role from the dashboard is UI theater. Needs: extend `StartupWriteSerializer` (`backend/startups/serializers.py`) to accept `raised`/`deadline`/`status`, add a `CollaborationRole` create/update endpoint (currently there's no dedicated endpoint for it — it's only ever set implicitly), and wire both into `AppContext.jsx`.
- [ ] **Real pagination for the feed**, replacing the simulated "load more" (`src/data/posts.js`'s `nextPostBatch()`/`MORE_POOL`). Add a paginated `GET /api/posts/?page=2` (DRF has built-in pagination classes — `PageNumberPagination` is the simplest fit) and have `Feed.jsx`'s infinite-scroll handler call it instead of pulling from the local mock pool.
- [ ] **Route guards.** Right now every route is reachable while logged out (components individually degrade — e.g. no founder controls — rather than redirecting). Decide whether that's actually the desired UX (a logged-out visitor browsing the feed is arguably fine) or whether write-heavy pages like `/dashboard/:id` and `/account` should redirect to `/login` when `currentUser.id === null`.

## 2. Data model gaps

Things a user can click that have no backing data at all.

- [ ] **Startup logo uploads.** Logos are currently a hardcoded CSS-gradient lookup (`LOGO_GRADIENTS` in `src/data/startups.js`) keyed by the 5 seed startup slugs. Any new startup just gets a generic fallback color — there's no real image. Needs an `ImageField` on `Startup` (or a separate `Logo` model) and an upload UI in `CreateStartupModal`/`FounderDashboard`.
- [ ] **Gallery tab is entirely fake.** `Profile.jsx`'s Gallery tab renders 6 static placeholder tiles — there's no `GalleryImage` model, no upload, no real images anywhere. Lowest-priority item on this list unless the product actually needs it.
- [ ] **Document uploads aren't wired up.** The `Document` model already has a `file` field (`FileField`) and `backend/config/urls.py` already serves `MEDIA_URL` in dev — but nothing in the frontend lets you upload a file to it. `FounderDashboard.jsx` has no "upload document" UI at all.
- [ ] **Likes aren't persisted.** `FeedCard.jsx`'s like button is local `useState` only (`const [liked, setLiked] = useState(false)`) — refresh the page and it's gone, and it doesn't affect anyone else's view. Needs a `Like` model (or a simple `liked_by` M2M on `Post`) if this should be real.
- [ ] **"Boost" and "Report" buttons are fully decorative** — no model, no endpoint, no behavior beyond a local UI state flip. Low priority; likely fine to leave as-is unless there's a product reason to build them out.
- [ ] **`deadline` is a free-text string, not a real date** (see IMPLEMENTATION.md §7). If funding countdowns need to be accurate (e.g. auto-flip a startup's `status` from `open` to `closed` when time runs out), this needs a real `DateTimeField` plus either a scheduled task (Celery beat, or a simple management command run via cron) or computing "days left" on read instead of storing a label.

## 3. Testing

There is currently **no automated test coverage anywhere** — every app has a `tests.py` but it's the untouched Django boilerplate (empty). This is the single biggest risk in the codebase: nothing catches a regression before a person does.

- [ ] Backend: model tests for the trickier bits — `Startup.save()`'s slug-collision logic, `User.save()`'s slug generation, `funding_pct` calculation.
- [ ] Backend: API tests for at least the permission boundaries (`IsOwnerOrReadOnly` — confirm a non-owner really gets 403; unauthenticated writes really get 403/401) and the `create`/`update` response-shape fix described in IMPLEMENTATION.md §5.5 (easy to accidentally regress if someone "simplifies" the viewset later).
- [ ] Frontend: at minimum, smoke tests for `AppContext`'s `transformX` functions (§6.2 of IMPLEMENTATION.md) — these are pure functions and cheap to test, and they're exactly the kind of code that silently breaks when someone changes a backend serializer field name without updating the frontend to match.
- [ ] Consider adding a CI workflow (GitHub Actions) once this is pushed to GitHub, so tests actually run on every push/PR instead of relying on someone remembering to run them locally.

## 4. Security & production-readiness

Everything here is currently configured for **local development only**. None of this should block continued feature work, but all of it blocks an actual deployment.

- [ ] `DJANGO_SECRET_KEY` — `.env.example` ships a placeholder (`change-me`); real secret keys need to be generated per-environment and never committed (already gitignored, just needs a real deployment process).
- [ ] `DEBUG=True` needs to become `False` in production, which then requires `ALLOWED_HOSTS` to be set correctly (currently just `localhost,127.0.0.1`) and a real static-file-serving story (Django doesn't serve static files itself with `DEBUG=False`).
- [ ] `CORS_ALLOWED_ORIGINS` / `CSRF_TRUSTED_ORIGINS` currently only allow `localhost:5173` — need the real frontend domain added before deployment.
- [ ] Cookies should be `Secure` + proper `SameSite` policy once served over HTTPS (currently relies on Django's insecure-but-fine-for-http-dev defaults).
- [ ] No rate limiting anywhere — `/api/auth/login/` in particular is brute-forceable as-is. DRF has throttle classes built in (`AnonRateThrottle`/`UserRateThrottle`) that would cover this cheaply.
- [ ] No password reset / email verification flow. Registration just requires an email string with no verification that you own it.
- [ ] File uploads (`Document.file`, once wired up per §2) need size/type validation before going anywhere near production — currently there's no restriction at all in the model.
- [ ] Postgres password (`postgres`/`postgres` in `docker-compose.yml`) is a fine default for local dev but should never be reused for a real deployment.

## 5. Deployment & DevOps

- [ ] **This directory still isn't a git repository.** Nothing here is version-controlled yet. First real step before anything else on this list: `git init`, commit, push to GitHub.
- [ ] No Dockerfile for the Django app itself or the frontend build — only Postgres runs in Docker right now. A production deploy would want the Django app containerized too (gunicorn/uvicorn behind it, not `manage.py runserver`).
- [ ] No CI/CD pipeline.
- [ ] No hosting decided/configured (frontend could be a static build on Vercel/Netlify/Cloudflare Pages; backend needs somewhere that can run Django + Postgres — Railway, Render, Fly.io, a VPS, etc.)
- [ ] Frontend's `VITE_API_URL` needs to point at a real backend URL in production builds — currently only configured for `http://localhost:8000/api`.

## 6. Frontend UX polish

Smaller things that would meaningfully improve the experience without being architecturally significant.

- [ ] **Error handling for fire-and-forget context calls.** Several context functions are called from event handlers without `await`/`try-catch` at the call site (e.g. `addComment`, `addApplication`, `addInvestment` from `Profile.jsx`/`InvestButton.jsx`). If the API call fails (network blip, validation error), the user currently sees... nothing — the UI just silently doesn't update, with only a console error. Worth adding a lightweight toast/banner system and having these calls surface failures.
- [ ] **Loading indicators for individual actions**, not just the app-wide initial load screen. Clicking Save/Follow/Invest currently has no in-flight state — on a slow connection, nothing visibly happens until the response lands.
- [ ] **Client-side search/filtering won't scale.** `Explore.jsx` filters the entire in-memory `startups` object on every keystroke. Fine at 5–50 startups; would need to move to a real backend search endpoint (`?q=` on `/api/startups/`) once the dataset grows.
- [ ] Accessibility pass — keyboard navigation, ARIA labels on icon-only buttons, focus management in modals (`CreateStartupModal`, `CreatePostModal` currently don't trap focus or restore it on close).
- [ ] Mobile responsiveness hasn't been explicitly verified — worth a real pass with browser dev tools' device emulation.
- [ ] `InvestorPortfolio.jsx`'s "Investment Portfolio" and "Investment History" tabs are hardcoded mock arrays, separate from the real `investments` data that only the "Investment Requests" tab uses. Worth deciding whether portfolio/history should become real (would need an Investment lifecycle — e.g. marking one "completed" and recording an outcome/ROI) or whether they're intentionally out of scope as illustrative-only.
- [ ] `FounderDashboard.jsx`'s Analytics tab (profile views, engagement rate, follower counts, the weekly bar chart) is entirely hardcoded — there's no real analytics tracking anywhere in the app. Building this for real means deciding what to track and adding either a simple event-log model or a third-party analytics integration.

## 7. Nice-to-haves / bigger ideas

Not required for the app to "work," but worth considering as the project matures.

- [ ] Move from session auth to token-based auth (JWT or DRF's TokenAuthentication) if a mobile app or third-party API consumer is ever planned — session cookies only really work cleanly for a first-party web frontend.
- [ ] Real-time updates (WebSockets via Django Channels) for the feed and messaging, instead of "refresh to see new posts."
- [ ] Email notifications (funding milestones, new applications, new messages) — would build on the same signal-handler infrastructure suggested in §1 for in-app notifications.
- [ ] A proper "boost" feature (paid or credit-based promotion of a post) if that's an actual product direction, not just a decorative button.
- [ ] Search indexing (Postgres full-text search, or an external service like Meilisearch/Algolia) once the startup directory is large enough that substring matching in Explore isn't good enough.
