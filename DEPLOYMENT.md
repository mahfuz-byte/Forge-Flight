# Production deployment: Vercel + Render + Supabase

1. Create a Supabase PostgreSQL project. Use its **session pooler** connection URI (port 5432) as Render's secret `DATABASE_URL`. Create a fresh database or inspect any existing schema before running migrations. Never commit the URI.
2. Deploy [render.yaml](render.yaml) as a Render Blueprint. It provisions a Starter web service and a 1 GB disk for durable uploads. The build collects Django static files, and the pre-deploy command applies the checked-in migrations. Render generates `DJANGO_SECRET_KEY`.
3. Import this repository in Vercel with the repository root as the project root. Use the Vite framework, `npm run build`, and output directory `dist`. Set Production `VITE_API_URL` to `https://<render-host>/api` before building.
4. Once Vercel provides the production URL, set `DJANGO_CORS_ALLOWED_ORIGINS` and `DJANGO_CSRF_TRUSTED_ORIGINS` on Render to that exact HTTPS origin, then redeploy Render. Add any custom domain origins to both settings.
5. Check Render's `/api/health/` and `/api/site/`, load the Vercel site, register a user, and verify an upload and its returned URL. Check the new account in Supabase. Do not run `seed_demo` in production; it creates accounts with known passwords.

Render's disk stores all new uploads. Existing local database records and media files require a separate, reviewed import before they appear in production. The repository also contains optional Supabase Storage support; choose that instead of the Render disk if you prefer private, signed media URLs. Its `SUPABASE_S3_*` variables are documented in [backend/.env.example](backend/.env.example).

Google sign-in is optional. To enable it, set the same OAuth client ID in Render's `GOOGLE_OAUTH_CLIENT_ID` and Vercel's `VITE_GOOGLE_CLIENT_ID`, and authorize the Vercel origin in Google Cloud. The statistics screen falls back to its built-in analysis when Ollama is unavailable; configure a reachable `OLLAMA_HOST` only if remote AI analysis is required.
