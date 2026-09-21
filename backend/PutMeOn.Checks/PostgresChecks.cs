using Microsoft.EntityFrameworkCore;
using Npgsql;
using PutMeOn.Api.Application;
using PutMeOn.Api.Domain;
using PutMeOn.Api.Infrastructure;

internal static class PostgresChecks
{
    public static async Task RunAsync()
    {
        var connection = Environment.GetEnvironmentVariable("PUTMEON_TEST_POSTGRES");
        if (string.IsNullOrEmpty(connection)) { Console.WriteLine("PostgreSQL checks skipped: PUTMEON_TEST_POSTGRES is not configured."); return; }
        var parsed = new NpgsqlConnectionStringBuilder(connection);
        if (parsed.Database != "putmeon_checks" || parsed.Host is not ("localhost" or "127.0.0.1"))
            throw new InvalidOperationException("PostgreSQL checks only accept a local putmeon_checks database.");
        var options = new DbContextOptionsBuilder<AppDb>().UseNpgsql(connection).Options;
        await using var db = new AppDb(options);
        await db.Database.MigrateAsync();
        await db.Database.MigrateAsync(); // Migration rerun must be safe.
        var owner = Person();
        var applicants = Enumerable.Range(0, 4).Select(_ => Person()).ToArray();
        db.Accounts.Add(owner); db.Accounts.AddRange(applicants); await db.SaveChangesAsync();
        var service = new PostService(db, new Rules(), TimeProvider.System);
        var today = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(10)).ToString("yyyy-MM-dd");
        var draft = new PostRequest("looking", "Carpenter", "Brisbane", "", 55, today, today, "Concurrency check", null);
        try
        {
            var id = await service.SavePostAsync(owner, null, draft, default);
            await Task.WhenAll(applicants.Select(async applicant =>
            {
                await using var session = new AppDb(options);
                await new PostService(session, new Rules(), TimeProvider.System).ApplyAsync(applicant, id, default);
            }));
            if (await db.Applications.CountAsync(x => x.PostId == id) != 4) throw new Exception("Concurrent applications lost.");
            await Task.WhenAll(Enumerable.Range(0, 3).Select(async _ => {
                await using var session = new AppDb(options);
                await new PostService(session, new Rules(), TimeProvider.System).ApplyAsync(applicants[0], id, default);
            }));
            if (await db.Applications.CountAsync(x => x.PostId == id) != 4) throw new Exception("Duplicate applications were created.");
            db.ChangeTracker.Clear();
            var post = await db.Posts.SingleAsync(x => x.Id == id);
            var revision = post.Revision;
            await service.SavePostAsync(owner, id, draft with { Revision = revision, Description = "New edit" }, default);
            try { await service.SavePostAsync(owner, id, draft with { Revision = revision }, default); throw new Exception("Stale edit overwrote current content."); }
            catch (ApiError e) when (e.Status == 409) { }
            await service.MarkInterestsViewedAsync(owner, id, [applicants[0].Id], default);
            if (await db.Applications.CountAsync(x => x.PostId == id && !x.Viewed) != 3) throw new Exception("Read receipts cleared unseen applications.");
            Console.WriteLine("PostgreSQL checks passed: migrations, concurrent/duplicate applications, stale edits and read receipts.");
        }
        finally
        {
            var ids = applicants.Select(a => a.Id).Append(owner.Id).ToArray();
            await db.Accounts.Where(a => ids.Contains(a.Id)).ExecuteDeleteAsync();
        }
    }
    private static Account Person() => new() { Email = Guid.NewGuid() + "@example.test", Name = "Test", Phone = "0400000000", Trade = "Carpenter", Location = "Brisbane" };
}
