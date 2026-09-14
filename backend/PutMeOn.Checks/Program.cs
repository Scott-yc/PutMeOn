using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using PutMeOn.Api.Domain;
using PutMeOn.Api.Infrastructure;
using PutMeOn.Api.Application;

await EmailChecks.RunAsync();
await AuthChecks.RunAsync();

await using var connection = new SqliteConnection("Data Source=:memory:");
await connection.OpenAsync();
await using var db = new AppDb(new DbContextOptionsBuilder<AppDb>().UseSqlite(connection).Options);
await db.Database.EnsureCreatedAsync();
var clock = new TestClock(DateTimeOffset.Parse("2026-09-14T03:00:00Z"));
var now = clock.GetUtcNow().ToUnixTimeMilliseconds();
var owner = new Account { Email = "owner@example.com", Name = "Owner", Phone = "0400000000", Trade = "Carpenter", Location = "Brisbane" };
var applicant = new Account { Email = "applicant@example.com", Name = "Applicant", Phone = "0400000000", Trade = "Carpenter", Location = "Brisbane" };
db.Accounts.AddRange(owner, applicant); await db.SaveChangesAsync();
var service = new PostService(db, new Rules(), clock);
var request = new PostRequest("looking", "Carpenter", "Brisbane", "Company", 55, "2026-09-14", "2026-09-20", "Framing", null);
var id = await service.SavePostAsync(owner, null, request, default);
await service.ApplyAsync(applicant, id, default);
var post = await db.Posts.SingleAsync(p => p.Id == id);
var revision = post.Revision;
await service.SavePostAsync(owner, id, request with { Revision = revision, Description = "Updated" }, default);
if (post.CreatedAt != now || post.ExpiresAt != now + 7L * 86400000) throw new Exception("Editing changed expiry.");
clock.Value = clock.Value.AddDays(7).AddMilliseconds(-1);
await new ExpiryCleanup(db, clock).RunAsync(default);
if (await db.Posts.CountAsync() != 1) throw new Exception("Deleted before expiry.");
clock.Value = clock.Value.AddMilliseconds(1);
try { await service.ContactAsync(owner, id, applicant.Id, default); throw new Exception("Expired contact exposed."); } catch (ApiError e) when (e.Status == 404) { }
await new ExpiryCleanup(db, clock).RunAsync(default);
if (await db.Posts.CountAsync() != 0 || await db.Applications.CountAsync() != 0 || await db.Accounts.CountAsync() != 2) throw new Exception("Expiry cascade or account retention failed.");
Console.WriteLine("Database integration checks passed: server timestamp, edit preserves expiry, no early deletion, immediate expired-contact rejection, physical deletion and application cascade.");
sealed class TestClock(DateTimeOffset value) : TimeProvider { public DateTimeOffset Value { get; set; } = value; public override DateTimeOffset GetUtcNow() => Value; }
