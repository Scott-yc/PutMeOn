# PutMeOn frontend

React, TypeScript and Vite. The default mode connects to the ASP.NET Core API. Start with the [project README](../../README.md) for full-stack setup and the live app, or the [deployment guide](../../DEPLOYMENT.md) for hosting configuration.

## Development

Run these commands from this directory:

```powershell
npm ci
```

Then start both the API and Vite from the repository root:

```powershell
cd ../..
./scripts/start-dev.ps1
```

The frontend runs at `http://127.0.0.1:5173`. Vite proxies `/api` requests to the backend at `http://127.0.0.1:5080`. Running `npm run dev` alone starts only Vite; the API must already be running for the default mode to work.

On a fresh local checkout, development login codes are shown on the login page instead of emailed. The deployed app uses real email delivery and server-managed cookie sessions.

## Working in the frontend

| Location             | Responsibility                                                       |
| -------------------- | -------------------------------------------------------------------- |
| `src/app`            | Routing, layouts and translating the current route into a data scope |
| `src/features`       | Authentication, posts and profile screens with their components      |
| `src/domain`         | Models, validation, trade categories and frontend business rules     |
| `src/state`          | Application state, async actions, refreshes and pagination           |
| `src/data/api`       | HTTP client, typed API calls and response contracts                  |
| `src/data/local`     | Frontend-only demo fixtures and persistence                          |
| `src/data/contracts` | Local demo repository contract                                       |
| `src/shared`         | Shared components, form adapters, formatting and styles              |

Pages use `useAppState`. `ApiProvider` renders loading and error states, while `useApiState` coordinates the snapshot and requests. `applicationApi` owns HTTP paths, methods and payloads. This keeps route handling and transport details out of the state logic.

See [ARCHITECTURE.md](ARCHITECTURE.md) for dependency rules and extension guidance. The backend remains authoritative for permissions, expiry and validation; browser checks are not a security boundary.

## Checks

From this directory:

```powershell
npm run check
npx playwright install chromium
npm run test:browser
```

`npm run check` runs formatting, lint, unit and architecture tests, TypeScript and a production build. `npm run test:browser` starts its own local Vite server and checks browser workflows against mocked API responses. Install Chromium once before running those tests.

The repository-level `scripts/check.ps1` also runs the backend checks. Real email delivery and mobile keyboard autofill need separate verification on the deployed app.

Use `npm run format` to apply formatting. `npm run build` writes production assets to `dist`; the root Dockerfile packages them with the API.

## Frontend-only demo mode

For isolated UI work without a backend, run `./scripts/start-dev.ps1 -Demo` from the repository root. This selects `VITE_DATA_MODE=demo`. Use a fictional email and code `482913`. It sends no email, stores records in localStorage under `putmeon.demo.v1`, and resets login state on refresh. It has no server-side security and must not be used as the public deployment.

This mode is separate from the posts labelled **Demo** in the normal API-backed app. Those examples are maintained by the backend, are read-only for visitors, and do not replace real authentication.

Historical prototypes in `archive/prototype` are reference material, not an alternative runnable app. The active routes are registered in `src/app/AppRoutes.tsx`.
