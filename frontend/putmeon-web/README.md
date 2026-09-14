# PutMeOn frontend

React + TypeScript + Vite. The default mode uses the ASP.NET Core API. See the root README for full-stack startup and deployment status.

## Development

- `npm ci`: install locked dependencies.
- `npm run dev`: start the local preview.
- `npm run format`: format source and configuration.
- `npm run check`: formatting, lint, tests, strict TypeScript and production build.

Only with VITE_DATA_MODE=demo: use any fictional email with demo code `482913`. Seeded accounts are `builder@example.com` and `electrician@example.com`. No email is sent. Login resets on refresh; records persist in localStorage under `putmeon.demo.v1`.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for module ownership, dependency rules, validation and extension requirements.

```text
src/
  app/                 App composition, routes and layout
  features/
    auth/              Login screen, six-digit input and auth styling
    posts/             Feed, editor, detail, post cards and post styling
    profile/           Profile and account screen
  domain/              Models, categories, validation, commands and expiry
  state/               React state and explicit application actions
  data/
    contracts/         Local demo repository contract
    local/             Persistence, migration, fixtures and simulated auth
  shared/
    components/        Shared form options and contact dialog
    forms/             FormData-to-domain-draft conversion
    styles/            Base styles and responsive overrides
  index.css            Stylesheet imports only
  main.tsx             Browser bootstrap
```

Original unused pages are preserved under `archive/prototype/` outside the compiled application. They are historical source, not a second runnable app.

## Product rules

Posts expire exactly 168 hours after publication; editing retains the original publication time and applications. Expired posts and embedded applications are removed locally on load, while open and when resuming. Closed browsers cannot clean up until reopened. Company names are optional, at most 120 characters, and each post retains its own company name. The main trade catalogue is shared by all dropdowns, with legacy selections normalized at the repository boundary.

## Validation

Automated tests cover storage recovery, lifetime boundaries, category uniqueness, command validation, ownership, duplicate applications, identity retention and architectural boundaries. Browser smoke checks are separate; unit tests do not prove pixel fidelity or production security.

## Production work remaining

Real server authentication, API and database; server-generated timestamps; server-side authorization and validation; unique application constraints; indexed expiry cleanup and cascading deletion; rate limiting; privacy/retention decisions; end-to-end and device tests; deployment and monitoring. Google sign-in, company profiles and reporting remain deferred. Browser-side checks are not a security boundary. The local snapshot repository is intentionally synchronous; a real API requires async use cases with loading, failure and concurrency handling.

## Logic audit (2026-09-14)

Verified 24 automated tests and browser flow: login as applicant, apply, duplicate button disabled, log out, log in as poster, see updated count, open contact details, reject changing a post with applicants to Available for Work. Checked My Posts at 390px width.

Fixes: strict calendar dates and Brisbane date boundary; preserve application semantics on type changes; report persistence failures; read latest local snapshot before sequential writes and synchronize storage events; reset route-specific form/dialog state; derive contact details from current authorized records; clear resend errors; emphasize owner application counts and remove self-application actions.

Limits: localStorage is not transactional across simultaneous writes from separate tabs. Damaged storage still falls back to demo fixtures. Authentication is simulated; sessions reset on refresh. Server authorization, cross-device consistency, concurrent-write guarantees, automated browser coverage and backend expiry deletion remain outstanding. These checks do not prove every possible path correct.
