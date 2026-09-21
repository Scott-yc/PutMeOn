# PutMeOn development rules

## Architecture

The active frontend is `frontend/putmeon-web`. Use its existing feature-oriented layered architecture. Read `frontend/putmeon-web/ARCHITECTURE.md` before structural changes. Do not alternate between top-level pages/services and feature directories merely for naming preferences.

- `src/app`: composition, routes and application layout.
- `src/features/<feature>/pages`: route screens; feature-specific components and CSS live beside them.
- `src/domain`: framework-independent models, validation and business rules.
- `src/state`: state coordination and explicit application actions.
- `src/data`: repository contracts, persistence adapters, migrations and demo fixtures.
- `src/shared`: genuinely shared components, form adapters and base styling.

Pages must not write storage or mutate database collections. Domain modules must not import UI, React, browser APIs or persistence. Do not duplicate business rules, trade catalogues or expiry logic across pages. Keep production authentication and authorization on the server. The optional frontend-only demo is not production security.

Directory names are project conventions, not an external certification. Structural changes require a concrete maintenance reason and corresponding documentation and test updates. Avoid unused directories, placeholder services and abstraction layers with no responsibility.

## Quality

Run `npm run check` from the frontend directory after meaningful implementation changes. Add behavioural regression tests for business-rule changes and architecture tests for new dependency boundaries. Verify affected browser workflows when routing, interaction or styling changes. Report untested areas accurately.

Preserve user-visible behaviour during refactoring. Keep original work in `archive` if retaining it is useful; do not develop features there. Never claim passing lint/build alone proves production readiness.
