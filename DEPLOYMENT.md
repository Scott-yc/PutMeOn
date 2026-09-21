# Deployment

PutMeOn is deployed on Render, with Neon PostgreSQL and Brevo for email. Local checks and deployed acceptance checks are separate: a successful build does not prove that email, proxy configuration or database access works on the host.

## Hosting

- Render runs the frontend and API together as a Docker web service. The free service can sleep when idle and take time to wake up. It is suitable for a small beta that can tolerate cold starts, not a promise of continuous availability. See [Render's free service documentation](https://render.com/docs/free).
- Neon provides persistent PostgreSQL storage. Check the account's storage, compute and transfer allowances. Do not store production SQLite data on Render's temporary filesystem or rely on a database with an expiry date. See [Neon's plans](https://neon.com/pricing).
- Brevo sends transactional login emails over HTTP. Verify the sender and account approval before relying on delivery. Sending limits are shared with other emails on the account. A personal email address may be replaced with a provider-managed sending domain; a verified custom domain is preferable for later use. The code also supports Resend. Check [Brevo's free plan limits](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan) and [domain setup](https://help.brevo.com/hc/en-us/articles/35852083084178-Domain-setup-for-better-email-deliverability).

The initial target is a few hundred registered users with low concurrency, not hundreds of simultaneous users. Use observed latency, errors and account usage to decide when to upgrade. Do not enable automatic paid upgrades without reviewing the cost.

## Configuration

Set credentials as private environment variables on the host. Do not put them in source code, screenshots or chat messages.

| Variable | Value |
| --- | --- |
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `Database__Provider` | `Postgres` |
| `ConnectionStrings__Database` | Npgsql format: `Host=...;Database=...;Username=...;Password=...;SSL Mode=VerifyFull` |
| `Auth__CodeSecret` | A securely generated random secret, at least 32 characters |
| `Email__Mode` | `Brevo` or `Resend` |
| `Email__ApiKey` | The provider's HTTP API key; not an SMTP key |
| `Email__From` | A verified sender email address |
| `Proxy__KnownProxies__0` | A trusted reverse proxy IP from the actual hosting configuration; increment the index for additional addresses |
| `DemoPosts__Enabled` | `true` by default; set to `false` to disable generated examples |

Serve the frontend and API from the same origin over HTTPS. Production cookies use Secure, HttpOnly and SameSite=Strict. Cross-origin CORS is not enabled.

Verify forwarding headers and client IPs on the actual host. Incorrect trusted proxy configuration can cause users to share one IP rate-limit bucket. Do not work around this by trusting arbitrary forwarded headers. IP limits are currently held in memory per instance; email-code limits and sessions are stored in the database. Multi-instance scaling would need shared rate limiting.

## First deployment

1. Create the database and email-provider account, verify the sender, and configure the private environment variables above.
2. Review the database migrations. The current single-instance deployment applies pending EF Core migrations at startup before accepting requests. To run them separately, use `dotnet run --project backend/PutMeOn.Api -- --migrate` from the repository root with the target database configuration; the process exits after migration.
3. Configure Render to build the root `Dockerfile`. The resulting container serves both the frontend assets and API. `render.yaml` provides the Blueprint configuration.
4. Check health, real email login, posts and applications across two accounts, contact permissions, session persistence, pagination, expiry, cold starts and client IP rate limits.
5. Establish database backups, a tested restore procedure, error monitoring and email quota monitoring before expanding the beta.

## Release checks

- Run `scripts/check.ps1` locally. It includes the browser tests; first install Chromium with `npx playwright install chromium` in the frontend directory.
- The GitHub Actions workflow runs frontend checks, Playwright and backend checks against an isolated PostgreSQL database. Confirm the workflow actually passes for the release commit.
- PostgreSQL tests only accept a local database named `putmeon_checks`. Never use the Neon production connection for tests. Coverage includes repeat migrations, concurrent and duplicate applications, stale edits and read receipts.
- The Render Blueprint declares `autoDeployTrigger: checksPass`. Editing that file does not reconfigure an existing manually created service. Set its Auto-Deploy option to **After CI Checks Pass** in Render, and configure the main branch to require the quality check before merging.
- `/api/health` checks process liveness. `/api/ready` checks that the database table can be queried. Avoid frequent external polling of readiness if the free database should be allowed to sleep.
- Production proxy configuration still needs verification on the host. Test requests from different networks and verify the effective client IP and rate-limit behaviour.

Before a destructive schema change, back up the database, review the migration and test it on a separate database. Prefer adding compatible fields first, migrating data next and removing old fields in a later release. Recovery should use a tested backup rather than blindly reversing a destructive migration.

## Unread applications

`Applications.Viewed` stores read state. Its migration adds a non-null boolean with a default of false, so existing applications initially appear unread. Only a post's owner may acknowledge the applicant IDs they have viewed; concurrent new applications are not cleared by that request.

The navigation count is independent of feed filters and pagination and only includes active posts. State refreshes on route changes, returning to the foreground and every 60 seconds while visible. This is polling, not live push.

## Generated example posts

With `DemoPosts__Enabled=true`, the worker maintains 25 examples of each post type. It runs on startup and every five minutes while the service is awake. Free hosting cannot run background jobs while asleep; work resumes when the service wakes. No external scheduler is required.

Examples belong to a reserved system account that cannot sign in. Cards show a **Demo** label; rates, dates and descriptions are illustrative. Both the UI and API prevent applications and contact access. Real posts appear first.

Each category uses unique trade/suburb combinations from the existing catalogue, with randomised schedules and descriptions. Unexpired examples remain unchanged; missing or expired slots are replenished for seven days. Fixed slot IDs and a serializable transaction prevent duplicate batches during overlapping starts. A failed batch is retried at the next worker interval.

Set `DemoPosts__Enabled=false` and restart to remove the system demo posts on the next worker run. Real users, posts and expiry rules are untouched. This feature does not require a schema migration.
