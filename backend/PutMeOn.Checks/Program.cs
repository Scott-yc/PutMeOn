using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using PutMeOn.Api.Domain;
using PutMeOn.Api.Infrastructure;
using PutMeOn.Api.Application;

await EmailChecks.RunAsync();
await AuthChecks.RunAsync();
await PostgresChecks.RunAsync();
await ConcurrencyChecks.RunAsync();
await DemoPostChecks.RunAsync();

await using var connection = new SqliteConnection("Data Source=:memory:");
await connection.OpenAsync();
await using var db = new AppDb(new DbContextOptionsBuilder<AppDb>().UseSqlite(connection).Options);
await db.Database.EnsureCreatedAsync();
var clock = new TestClock(DateTimeOffset.Parse("2026-09-14T03:00:00Z"));
var now = clock.GetUtcNow().ToUnixTimeMilliseconds();
var owner = new Account { Email = "owner@example.com", Name = "Owner", Phone = "0400000000", Trade = "Carpenter", Location = "Brisbane" };
var applicant = new Account { Email = "applicant@example.com", Name = "Applicant", Phone = "0400000000", Trade = "Carpenter", Location = "Brisbane" };
db.Accounts.AddRange(owner, applicant); await db.SaveChangesAsync();
var profileService = new ProfileService(db, new Rules());
await profileService.SaveProfileAsync(owner, new ProfileRequest("Updated Owner", owner.Phone, owner.Trade, owner.Location, ""), default);
if ((await db.Accounts.AsNoTracking().SingleAsync(a => a.Id == owner.Id)).Name != "Updated Owner" || applicant.Name != "Applicant")
    throw new Exception("Profile update did not persist or changed another account.");
try { await profileService.SaveProfileAsync(owner, new ProfileRequest("", owner.Phone, owner.Trade, owner.Location, ""), default); throw new Exception("Invalid profile accepted."); }
catch (ApiError e) when (e.Status == 400) { }
var service = new PostService(db, new Rules(), clock);
var request = new PostRequest("looking", "Carpenter", "Brisbane", "Company", 55, "2026-09-14", "2026-09-20", "Framing", null);
var id = await service.SavePostAsync(owner, null, request, default);
await service.ApplyAsync(applicant, id, default);
var post = await db.Posts.SingleAsync(p => p.Id == id);
// Feed responses must never include another person's private contact fields.
foreach (var viewer in new[] { owner, applicant })
{
    var snapshot = System.Text.Json.JsonSerializer.SerializeToElement(await new FeedService(db, clock).StateAsync(viewer, "feed", null, null, null, null, 0, default));
    foreach (var profile in snapshot.GetProperty("profiles").EnumerateArray())
        if (profile.GetProperty("Id").GetString() != viewer.Id &&
            (profile.GetProperty("email").GetString() != "" || profile.GetProperty("phone").GetString() != ""))
            throw new Exception("Feed exposed another user's private contact fields.");
}
var outsider = new Account { Email = "outsider@example.com", Name = "Outsider", Phone = "0400000000", Trade = "Carpenter", Location = "Brisbane" };
try { await new ContactService(db, clock).ContactAsync(outsider, id, applicant.Id, default); throw new Exception("Unrelated user accessed applicant contact."); } catch (ApiError e) when (e.Status == 403) { }
try { await new ContactService(db, clock).ContactAsync(applicant, id, owner.Id, default); throw new Exception("Applicant accessed restricted poster contact."); } catch (ApiError e) when (e.Status == 403) { }
var permittedContact = System.Text.Json.JsonSerializer.SerializeToElement(await new ContactService(db, clock).ContactAsync(owner, id, applicant.Id, default));
if (permittedContact.GetProperty("email").GetString() != applicant.Email) throw new Exception("Authorized applicant contact missing.");
var outsiderPost = System.Text.Json.JsonSerializer.SerializeToElement(await new FeedService(db, clock).StateAsync(outsider, "feed", id, null, null, null, 0, default)).GetProperty("posts")[0];
if (outsiderPost.GetProperty("interested").GetArrayLength() != 0) throw new Exception("Applicant identities exposed to unrelated user.");
Console.WriteLine("Privacy checks passed: feed contact redaction, restricted contact authorization and applicant identity isolation.");
async Task<int> Unread(Account a) {
    var state = System.Text.Json.JsonSerializer.SerializeToElement(await new FeedService(db, clock).StateAsync(a, "feed", null, "Plumber", null, null, 0, default));
    return state.GetProperty("unreadInterestCount").GetInt32();
}
if (await Unread(owner) != 1 || await Unread(applicant) != 0) throw new Exception("Unread count must be owner-only and independent of feed filters.");
try { await service.MarkInterestsViewedAsync(applicant, id, [applicant.Id], default); throw new Exception("Non-owner marked read."); } catch (ApiError e) when (e.Status == 403) { }
await service.MarkInterestsViewedAsync(owner, id, [], default);
if (await Unread(owner) != 1) throw new Exception("Unseen application cleared.");
await service.MarkInterestsViewedAsync(owner, id, [applicant.Id], default);
await service.MarkInterestsViewedAsync(owner, id, [applicant.Id], default);
db.ChangeTracker.Clear();
if (await Unread(owner) != 0 || await db.Applications.CountAsync() != 1) throw new Exception("Read receipt not persisted or application lost.");
var secondId = await service.SavePostAsync(owner, null, request, default);
await service.ApplyAsync(applicant, secondId, default);
await service.ApplyAsync(applicant, secondId, default);
await service.MarkInterestsViewedAsync(owner, id, [applicant.Id], default);
if (await Unread(owner) != 1) throw new Exception("Reading one post cleared another or duplicate application counted twice.");
await service.DeleteAsync(owner, secondId, default);
if (await Unread(owner) != 0) throw new Exception("Deleted post still contributes unread applications.");
post = await db.Posts.SingleAsync(p => p.Id == id);
Console.WriteLine("Unread checks passed: owner isolation, filtered feed, exact viewed IDs, repeat acknowledgement and database persistence.");
var revision = post.Revision;
await service.SavePostAsync(owner, id, request with { Revision = revision, Description = "Updated" }, default);
if (post.CreatedAt != now || post.ExpiresAt != now + 7L * 86400000) throw new Exception("Editing changed expiry.");
clock.Value = clock.Value.AddDays(7).AddMilliseconds(-1);
await new ExpiryCleanup(db, clock).RunAsync(default);
if (await db.Posts.CountAsync() != 1) throw new Exception("Deleted before expiry.");
clock.Value = clock.Value.AddMilliseconds(1);
try { await new ContactService(db, clock).ContactAsync(owner, id, applicant.Id, default); throw new Exception("Expired contact exposed."); } catch (ApiError e) when (e.Status == 404) { }
await new ExpiryCleanup(db, clock).RunAsync(default);
if (await db.Posts.CountAsync() != 0 || await db.Applications.CountAsync() != 0 || await db.Accounts.CountAsync() != 2) throw new Exception("Expiry cascade or account retention failed.");
Console.WriteLine("Database integration checks passed: server timestamp, edit preserves expiry, no early deletion, immediate expired-contact rejection, physical deletion and application cascade.");
sealed class TestClock(DateTimeOffset value) : TimeProvider { public DateTimeOffset Value { get; set; } = value; public override DateTimeOffset GetUtcNow() => Value; }
