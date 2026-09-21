# PutMeOn

A small job board for tradies and builders, focused on Brisbane. Builders can post when they need a subbie, and tradies can post when they are available for work.

[Open PutMeOn](https://putmeon-fc7b.onrender.com)

The app is hosted on Render with a Neon PostgreSQL database. It uses free hosting, so the first visit after a period of inactivity can take a while to load.

## What it does

There are two types of post: **Looking for a Subbie** and **Available for Work**. Users can filter by trade and suburb, view the details, and register interest in a job or contact an available tradie.

- Email-code login with a persistent session.
- Create, edit and delete posts from My Posts.
- View applicants and their contact details as the job owner.
- Unread interest counts in the navigation, capped at `99+`.
- Seven-day post expiry. Editing a post does not extend its life.
- Mobile layouts, with long feed descriptions limited to five lines.

Posts marked **Demo** are generated examples, not real jobs or people. The app maintains 25 of each type, replacing missing or expired examples while it is running. Real posts appear first. Demo posts cannot receive applications or expose contact details. Set `DemoPosts__Enabled=false` to turn them off; the next worker run removes the examples without touching real posts.

## Stack

- React, TypeScript and Vite for the frontend.
- ASP.NET Core 10 for the API.
- Entity Framework Core, with SQLite locally and PostgreSQL on the deployed app.
- Brevo for login emails; a Resend adapter is also included.
- Docker for deployment, GitHub Actions for checks, and Playwright for browser tests.

The frontend and API are served from the same application in production. This keeps deployment small and avoids a separate frontend hosting service or cross-origin cookie setup.

## Running locally

You need Node.js 22 and the .NET 10 SDK. The helper scripts below use PowerShell.

```powershell
git clone https://github.com/Scott-yc/PutMeOn.git
cd PutMeOn
cd frontend/putmeon-web
npm ci
cd ../..
./scripts/start-dev.ps1
```

Open `http://127.0.0.1:5173`. Vite runs on port 5173 and the API on port 5080. Stop the script with Ctrl+C when finished.

On a fresh checkout, development mode shows the login code in the page instead of sending an email. You do not need an email provider key to try it locally. Local configuration or environment variables can override that behaviour.

SQLite data is stored in `backend/PutMeOn.Api/putmeon.db`, so accounts and posts survive a restart. The app creates the local database on first startup.

For a built version served by the API in the background, use `./scripts/start-local.ps1` instead. It uses the same local database and port 5173. Do not run both scripts at once. Its process ID and logs are in `.local-app`; stop that process before rebuilding and starting it again.

## How the code is organised

```text
frontend/putmeon-web/src/
  app/              Routes and application layout
  features/         Pages and components grouped by feature
  domain/           Models, validation and frontend business rules
  state/            API state, pagination and user actions
  data/             HTTP client and local demo persistence
  shared/           Shared UI and formatting

backend/PutMeOn.Api/
  Endpoints/        HTTP routes and request handling
  Application/      Authentication, posts and access rules
  Domain/           Entities
  Infrastructure/   Database, migrations, email and background jobs

backend/PutMeOn.Checks/   Backend regression checks
shared/                  Server trade catalogue
scripts/                 Local startup and check scripts
```

Pages call explicit state actions rather than writing to storage. The API makes the final permission checks. Contact details are loaded through a separate authorised endpoint instead of being included in the feed.

Edits carry the revision that was loaded when the form opened. If someone changes the post elsewhere, the server rejects the stale save rather than silently overwriting it. Applicant updates use the same revision guard and retry independent concurrent applications.

There is also an older frontend-only demo mode for local development. It is separate from the labelled Demo posts in the API-backed app. See [the frontend architecture notes](frontend/putmeon-web/ARCHITECTURE.md) for the existing conventions.

## Checks

Install the browser used by the tests once:

```powershell
cd frontend/putmeon-web
npx playwright install chromium
cd ../..
./scripts/check.ps1
```

The check script runs formatting, linting, frontend tests, a production build, Playwright tests and backend checks. The tests cover permissions, expiry, persistent sessions, stale edits, pagination refreshes, unread counts and demo replenishment.

Browser tests use a mocked API. Backend checks use isolated SQLite databases, with additional PostgreSQL checks enabled by `PUTMEON_TEST_POSTGRES`. Those PostgreSQL checks only accept a local database named `putmeon_checks`; do not use a production connection. The GitHub Actions workflow provisions that database separately.

Passing these checks does not verify email delivery or every behaviour on a real phone. Those still need testing against the deployed app.

## Deployment and current limits

The root `Dockerfile` builds the frontend and packages it with the API. Production requires PostgreSQL, an email provider and a random login-code secret. Credentials belong in private environment variables, not in the repository. Local settings, database files and build output are excluded from Git.

[DEPLOYMENT.md](DEPLOYMENT.md) lists the environment variables and deployment steps.

A few limits are worth keeping in mind:

- Cleanup and demo replenishment run every five minutes while the service is awake. Free hosting pauses them during sleep.
- Notifications refresh periodically; there is no live push connection.
- IP rate limiting is per instance. Trusted proxy configuration needs to match the host before relying on client IP limits.
- The app has not been validated for hundreds of simultaneous users. Local test results are not a capacity guarantee for the free host.

The current scope is posting, expressing interest and exchanging contact details. There is no built-in chat, booking or payment flow.
