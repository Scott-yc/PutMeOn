# Architecture

The frontend uses feature folders with separate domain, state and data layers. This keeps page code focused on rendering and interaction, rather than storage or business rules.

These are project conventions, not a requirement to use particular directory names. Change the structure when there is a concrete maintenance reason, and update the documentation and tests with it. Do not introduce empty services or switch between top-level pages and feature folders just for naming consistency.

## Responsibilities

- `app` composes routes, layouts and providers. It does not contain business rules.
- `features` contains route pages and feature-specific components. Changes go through explicit state actions, not direct storage writes or collection mutations.
- `state` coordinates commands, API requests and state updates, with explicit success and failure results.
- `domain` contains plain TypeScript models, validation and frontend business rules. It must not depend on React, browser APIs, persistence or UI modules.
- `data` contains the HTTP client and local demo persistence, including migrations and fixtures. `DemoRepository` is the replaceable snapshot interface for the frontend-only demo.
- `shared` contains reusable UI, form adapters, formatting and base styles. Feature-specific components stay with their feature.

The default `ApiProvider` makes asynchronous requests through `data/api`. The server filters and paginates posts and returns public profile fields. Contact details use a separate authorised endpoint. Never send the entire database to the browser or rely on frontend checks for access control.

The backend Application layer is authoritative for production rules and permissions. Frontend domain rules support validation and the local demo. Update both sides when changing shared behaviour. The older `DemoProvider` only runs in explicitly selected frontend demo mode and is not production authentication.

## Pages and styles

Pages may handle display conditions and form submission, but must not implement persistence. FormData conversion belongs in `shared/forms`; validation belongs in the domain layer. Extract components for a real shared responsibility, not for every individual label.

Styles are split between authentication, posts, shared dialogs and base styles. `index.css` collects the imports, with base styles loaded last to preserve responsive overrides. These are ordinary CSS files, not isolated CSS Modules, so avoid class-name collisions. Module styles can be introduced as individual features need them.

## State consistency

- An edit form retains the revision it loaded initially. Background refreshes must not replace that revision.
- Refreshing a paginated feed reloads the range already loaded by the user.
- Private contact details stay in the detail dialog state, not in the public profile snapshot.
- Failed read acknowledgements must be retryable without clearing unrelated or newly arrived applications.

## Common changes

- Trades: update `domain/trades.ts` and the server catalogue in `shared/trades.json`, including legacy mappings and uniqueness checks. Do not add page-specific catalogues.
- Expiry: update `domain/postExpiry.ts` and the server rules together, then check the time boundaries.
- Posting rules: update `domain/commands.ts` and the backend rules. HTML form constraints are only an input aid.
- Profile or post fields: update models, form conversion, UI, persistence validation and migrations where needed.
- API behaviour: handle loading, errors, retries and concurrency through explicit asynchronous actions. Do not treat a synchronous demo repository as a production API.
- Routes: put screens in the relevant feature and register them in `app/AppRoutes.tsx`.

## Checks

Run `npm run check` before submitting implementation changes. Prettier handles formatting; oxlint and TypeScript catch basic errors. Behaviour tests cover business boundaries, and architecture tests check dependency restrictions. Add regression tests for changed rules rather than tests that simply repeat the implementation.

Playwright covers stale edits, pagination refreshes, contact dialogs, read receipt retries, mobile badges and Demo post actions. These browser tests mock the API. Separate backend checks exercise SQLite and, when configured, PostgreSQL. Real email delivery and phone keyboard autofill still need testing on the deployed app.

Preserve visible behaviour during refactoring. If historical prototypes are retained under `archive/prototype`, they are reference material only and do not participate in the active build. Develop features in `src`, not in the archive.

The root `AGENTS.md` records the same maintenance rules for coding assistants. See the root README and deployment guide for startup and hosting details.
