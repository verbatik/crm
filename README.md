# Speechyou CRM

<img src="apps/app/public/speechyou-logo.svg" alt="Speechyou logo" width="96" height="96" />

Customer relationships, company research, and team agents for Speechyou.

[Speechyou](https://speechyou.com) · [Setup](docs/setup.md) · [Environment](docs/environment.md)

## Development

This workspace uses Bun 1.3.12, Node 24, and PlanetScale Postgres.
The root `.env` holds the credentials. Local Postgres is not required.

```sh
./.scratch/dev
```

The launcher applies pending migrations through the direct PlanetScale connection.
It checks the schema and generates Prisma before starting the services.

| Service | Address |
| --- | --- |
| Web app | http://localhost:3000 |
| API | http://localhost:3001 |
| Research agent | http://127.0.0.1:2000 |

See `.scratch/SETUP.md` for runtime paths, individual service commands, and restart instructions.

## Credentials

The root `.env` contains the database URLs and generated application secrets.
`ALLOWED_SIGN_IN` is `speechyou.com`.

Choose one sign-in provider:

- Google: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- Microsoft: `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET`.

Google redirect URI: `http://localhost:3001/api/auth/callback/google`.
Microsoft redirect URI: `http://localhost:3001/api/auth/callback/microsoft`.
Enable Gmail and Calendar APIs for Google. Configure delegated `User.Read` and `Mail.Read` for Microsoft.

Local model calls require `AI_GATEWAY_API_KEY`.
Enter the Context API key during onboarding or in Settings → General.
The application stores that key in the database, not in `.env`.

`.env.example` documents optional integrations. Anonymous telemetry is disabled for this installation.

## Tests

Integration tests require a separate disposable database named with an `_test` suffix.
Set `TEST_DATABASE_URL` explicitly before running them. It is currently empty.

## Branding

The shared logo and app icons use the official [Speechyou logo](https://speechyou.com/logo.svg).
The interface uses Speechyou indigo, with shared styles in `packages/ui`.

## Upstream attribution

This application derives from [trycompai/crm](https://github.com/trycompai/crm).
The original MIT copyright and license remain in [LICENSE](LICENSE).
