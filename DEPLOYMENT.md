# Free academic demo deployment

This setup gives the React site and Django API separate stable `*.vercel.app`
URLs. The frontend proxies `/api/` to Django. Supabase hosts PostgreSQL and a
private Storage bucket. Ollama stays on the demo computer; Tailscale Funnel
exposes only the authenticated `backend/ollama_bridge.py` endpoint while that
computer is on.

Do not put database passwords, S3 keys, or the bridge token in Git or in a
`VITE_` variable. Keep the existing `backend/media/` files until the migration
has been checked. A free Supabase project may pause after a week of inactivity;
resume it in Supabase before a demo if necessary.

## 1. Create Supabase resources

1. Create a free Supabase project. Save its database password privately.
2. Under Storage, create a **private** bucket named `forge-flight-media`.
3. Enable Storage's S3 connection and create S3 access keys. Record the exact
   endpoint, region, access key, and secret key from its S3 settings page.
4. In **Connect**, copy the **Session pooler** connection details for migration
   from this Windows machine. Copy the **Transaction pooler** details separately
   for the Vercel Django function. Use the actual host and username shown there.

## 2. Migrate the local database and files

Run these in PowerShell from `backend/` while local PostgreSQL is running.
Install the new Python requirements first:

```powershell
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe -X utf8 manage.py dumpdata --natural-foreign --natural-primary --exclude contenttypes --exclude auth.permission --exclude sessions -o deployment-data.json
```

`deployment-data.json` contains the current demo database and is ignored by
Git. Keep this file private. Make a copy of `backend/media/` before migration.

In a separate PowerShell window, temporarily set `DB_NAME=postgres`,
`DB_USER`, `DB_PASSWORD`, `DB_HOST`, and `DB_PORT` from Supabase's **Session
pooler** details, plus `DB_SSLMODE=require`. Set the five `SUPABASE_S3_*`
variables from the S3 settings. Then, from `backend/`, run:

```powershell
.\venv\Scripts\python.exe manage.py migrate
.\venv\Scripts\python.exe manage.py loaddata deployment-data.json
Remove-Item deployment-data.json
.\venv\Scripts\python.exe manage.py copy_media_to_storage
.\venv\Scripts\python.exe manage.py copy_media_to_storage --apply
```

The first media command reports what will be uploaded; `--apply` copies all
local files and checks every database file reference. The command is safe to
rerun because it skips objects already in the bucket. Check that it reports
zero missing files, then open an image or document in Supabase Storage and
verify that it is present. The original local database and media stay in place.

You can set temporary environment variables in PowerShell with
`$env:DB_HOST='value'`, etc. Do not overwrite `backend/.env` with Supabase
credentials unless you intentionally want local development to use the cloud
database. If a command still connects to local Postgres, inspect the active
PowerShell environment and `backend/.env`.

## 3. Run Ollama and Tailscale on the demo computer

1. Install Ollama for Windows and Tailscale, then sign in to a free Tailscale
   account and enable Funnel for this device.
2. Run `ollama pull deepseek-r1:1.5b`. Ensure Ollama is running locally on port
   `11434`.
3. Generate a random bridge token and keep it privately. Set the *same* token
   as `OLLAMA_BRIDGE_TOKEN` in the Django Vercel project.

```powershell
$env:OLLAMA_BRIDGE_TOKEN = [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
cd 'D:\My Downloads\Forge-Flight\backend'
.\venv\Scripts\python.exe ollama_bridge.py
```

Leave this window running during demos. In an **Administrator PowerShell**
window, run:

```powershell
tailscale funnel --bg 11435
tailscale funnel status
```

The status command prints the stable public HTTPS `*.ts.net` origin. Set it as
`OLLAMA_HOST` in the Django Vercel project (omit `/api/chat`). The bridge only
accepts authenticated `POST /api/chat` requests for the configured model. Never
Funnel port `11434` directly. To stop sharing, run `tailscale funnel reset` from
an Administrator PowerShell window and stop the bridge process.

## 4. Deploy Django to Vercel

Create a Vercel project from this Git repository with **Root Directory** set
to `backend`. Keep framework detection on Django. Use the Hobby plan. Set the
following environment variables for Production before deploying:

| Variable | Value |
| --- | --- |
| `DJANGO_DEBUG` | `False` |
| `DJANGO_SECRET_KEY` | A new random value, e.g. `python -c "import secrets; print(secrets.token_urlsafe(50))"` |
| `DJANGO_ALLOWED_HOSTS` | The Django project's `*.vercel.app` hostname |
| `DJANGO_CORS_ALLOWED_ORIGINS` | The frontend's full `https://...vercel.app` origin |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | The frontend's full `https://...vercel.app` origin |
| `BEHIND_TLS_PROXY` | `True` |
| `DB_NAME` | `postgres` |
| `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | From Supabase's **Transaction pooler** details (normally port `6543`) |
| `DB_SSLMODE` | `require` |
| `SUPABASE_S3_ENDPOINT`, `SUPABASE_S3_REGION`, `SUPABASE_S3_BUCKET`, `SUPABASE_S3_ACCESS_KEY`, `SUPABASE_S3_SECRET_KEY` | From step 1 |
| `OLLAMA_HOST` | The HTTPS Tailscale Funnel origin from step 3 |
| `OLLAMA_MODEL` | `deepseek-r1:1.5b` |
| `OLLAMA_BRIDGE_TOKEN` | The exact bridge token from step 3 |

Set `GOOGLE_OAUTH_CLIENT_ID` only if using Google sign-in. Its OAuth client
must also trust the deployed frontend origin. Once deployed, confirm
`https://<django-project>.vercel.app/api/health/` returns `{"status":"ok"}`.

## 5. Deploy React to Vercel

Create a second Vercel project from the same repository, with Root Directory
set to the repository root and Vite detected. The root `vercel.json` proxies
`/api/` to `https://forge-flight-cuet-six.vercel.app`; update that destination
if the Django project's URL changes. Leave `VITE_API_URL` unset so the browser
uses the same-origin `/api` proxy. If using Google sign-in,
set `VITE_GOOGLE_CLIENT_ID` to the OAuth web client ID and update its allowed
origin in Google Cloud. Deploy and test the frontend's `*.vercel.app` URL.

Test registration/login, a post with an attachment under 4 MB, an existing
media file, and a statistics CSV upload. Test **Analyze** with the bridge and
Ollama running; the report's `engine` should begin with `ollama/`. Repeat with
the bridge stopped; the built-in fallback should appear. Vercel Functions
accept at most 4.5 MB request bodies, so this demo limits new browser uploads
to 4 MB. Existing larger files copied to Supabase can still be viewed.

The site and database can remain online while the computer is off. AI analysis
requires the computer, Ollama, bridge, and Tailscale Funnel to be running.
The built-in analysis handles periods when Ollama is unavailable.

## References

- [Vercel Django deployment](https://vercel.com/docs/frameworks/full-stack/django)
- [Vercel function request limit](https://vercel.com/docs/functions/limitations)
- [Supabase connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase S3 settings](https://supabase.com/docs/guides/storage/s3/authentication)
- [Tailscale Funnel CLI](https://tailscale.com/docs/reference/tailscale-cli/funnel)
