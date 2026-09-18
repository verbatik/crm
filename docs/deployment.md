# Speechyou CRM deployment

The production services run in the `verbatiks-projects` Vercel team.

| Service | Project | URL | Repository root |
| --- | --- | --- | --- |
| Web | `speechyou-crm` | https://crm.speechyou.com | `apps/app` |
| API | `speechyou-crm-api` | https://crm-api.speechyou.com | repository root |
| Agent | `speechyou-crm-agent` | https://crm-agent.speechyou.com | `apps/agent` |

Each project tracks `release` in https://github.com/verbatik/crm.
Push tested commits to `release` to deploy. Preview deployments are disabled.
Vercel installs dependencies with `bun install --frozen-lockfile` and uses Node.js 24.
All functions run in `iad1`, near the PlanetScale database.

| Service | Build command |
| --- | --- |
| Web | `cd ../.. && bunx turbo run build --filter=app` |
| API | `bun run db:generate && node apps/api/scripts/build-func.mjs` |
| Agent | `cd ../.. && bunx turbo run build --filter=agent` |

The API production build applies database migrations and checks schema drift.
It deploys the five schedules from `apps/api/vercel.json`.
The agent build generates its workflow functions and dispatch schedule.
The web build must receive `API_URL` and `APP_URL` through `apps/app/turbo.json`.

## Configuration

Keep secrets in the ignored root `.env` for local development.
Set production values in each project's Vercel environment settings.
Redeploy affected projects after changing their environment variables.
Never commit `.env`, `.scratch`, or exported credentials.

| Variables | Where to obtain them | Production projects |
| --- | --- | --- |
| `DATABASE_URL` | PlanetScale Postgres connection details; pooled port 6432 | All three |
| `DIRECT_DATABASE_URL` | PlanetScale direct connection; port 5432 | API |
| `BETTER_AUTH_SECRET` | Generate a random secret; keep the existing configured value | Web, API |
| `AGENT_BRIDGE_SECRET` | Generate a random secret; use the same value everywhere | All three |
| `CRON_SECRET` | Generate a random secret | API, agent |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud → Google Auth Platform → Clients | Web, API |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Upstash → database → REST API | API |
| `PERPLEXITY_API_KEY` | Perplexity API Console → API Keys | Agent |
| `BLOB_READ_WRITE_TOKEN` | Vercel → Storage → Blob store | API, agent |
| `AI_GATEWAY_API_KEY` | Vercel → AI Gateway → API Keys; optional for local model execution | Local only; Vercel uses OIDC |
| `GITHUB_TOKEN` | GitHub token settings; optional for higher research rate limits | Agent |

The Context.dev key lives in the database, not an environment variable.
Update it through CRM Settings → General. Obtain it from Context.dev → API Keys.

Use these non-secret production values:

```dotenv
APP_URL=https://crm.speechyou.com
API_URL=https://crm-api.speechyou.com
AGENT_URL=https://crm-agent.speechyou.com
AUTH_COOKIE_DOMAIN=.speechyou.com
ALLOWED_SIGN_IN=speechyou.com
CRM_TELEMETRY_DISABLED=1
```

Cloudflare has DNS-only CNAME records for `crm`, `crm-api`, and `crm-agent`.
Vercel manages their TLS certificates.

## Google sign-in

Project: `speechyou-conversions-2026`. OAuth client: `Speechyou CRM`.
Gmail and Calendar APIs are enabled.
The production callback is `https://crm-api.speechyou.com/api/auth/callback/google`.
The local callback is `http://localhost:3001/api/auth/callback/google`.

The consent screen uses External / Testing because this project has no Workspace organization.
Create `corneliu@speechyou.com` as a Google Workspace account, then add it under Audience → Test users.
An email forwarding alias alone does not provide Google sign-in or a Gmail mailbox.
Complete sign-in and grant the requested Gmail and Calendar read permissions.

Google testing refresh tokens expire after seven days for these scopes.
For long-term internal use, use a Workspace-owned Cloud project with an Internal consent screen.
An external production consent screen requires the applicable Google verification process.

## Verification

The API health endpoint is `https://crm-api.speechyou.com/health`.
The agent health endpoint is `https://crm-agent.speechyou.com/eve/v1/health`.
Unauthenticated requests to the agent inventory must return 401.
Google sign-in must reach Google's account chooser with the production API callback.

Integration tests require a separate disposable `TEST_DATABASE_URL`.
Never run destructive database tests against the production database.
