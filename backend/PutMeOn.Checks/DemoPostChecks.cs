using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using PutMeOn.Api.Application;
using PutMeOn.Api.Domain;
using PutMeOn.Api.Infrastructure;

static class DemoPostChecks
{
    public static async Task RunAsync()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new AppDb(new DbContextOptionsBuilder<AppDb>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["DemoPosts:Enabled"] = "true" }).Build();
        var clock = new DemoClock(DateTimeOffset.Parse("2026-09-22T23:00:00Z"));
        var rules = new Rules();
        var realOwner = new Account { Email = "real@example.test", Name = "Real user" };
        var realPost = new JobPost { OwnerId = realOwner.Id, CreatedAt = 1, ExpiresAt = clock.GetUtcNow().AddDays(30).ToUnixTimeMilliseconds() };
        db.Accounts.Add(realOwner); db.Posts.Add(realPost); await db.SaveChangesAsync();
        var replenisher = new DemoPostReplenisher(db, rules, clock, config);
        async Task<List<JobPost>> Samples() => await db.Posts.AsNoTracking().Where(p => p.OwnerId == DemoPostIdentity.OwnerId).ToListAsync();
        await replenisher.RunAsync(default);
        var first = await Samples();
        if (first.Count != 50 || first.Count(p => p.Kind == "looking") != 25 || first.Count(p => p.Kind == "available") != 25 || first.Select(p => p.Description).Distinct().Count() != 50 || first.Select(p => (p.Kind, p.Trade, p.Location)).Distinct().Count() != 50)
            throw new Exception("Demo count or uniqueness incorrect.");
        foreach (var p in first)
            rules.Post(new PostRequest(p.Kind, p.Trade, p.Location, p.CompanyName, p.Rate, p.From, p.To, p.Description, null), clock.GetUtcNow());
        await replenisher.RunAsync(default);
        if ((await Samples()).Any(p => p.Revision != 1)) throw new Exception("Live samples were unnecessarily regenerated.");
        db.ChangeTracker.Clear();
        await db.Posts.Where(p => p.Id == first[0].Id).ExecuteDeleteAsync();
        await replenisher.RunAsync(default);
        if ((await Samples()).Count != 50) throw new Exception("Missing sample not replenished.");
        var service = new PostService(db, rules, clock);
        foreach (var p in first)
        {
            try { await new ContactService(db, clock).ContactAsync(realOwner, p.Id, DemoPostIdentity.OwnerId, default); throw new Exception("Demo contact allowed."); } catch (ApiError e) when (e.Status == 403) { }
            try { await service.ApplyAsync(realOwner, p.Id, default); throw new Exception("Demo application allowed."); } catch (ApiError e) when (e.Status == 403) { }
        }
        var feed = System.Text.Json.JsonSerializer.SerializeToElement(await new FeedService(db, clock).StateAsync(realOwner, "feed", null, null, null, null, 0, default));
        if (feed.GetProperty("posts")[0].GetProperty("Id").GetString() != realPost.Id) throw new Exception("Samples displaced real posts.");
        if (!feed.GetProperty("posts")[1].GetProperty("isDemo").GetBoolean()) throw new Exception("Demo marker missing.");
        clock.Value = clock.Value.AddDays(7);
        await new ExpiryCleanup(db, clock).RunAsync(default);
        db.ChangeTracker.Clear();
        await replenisher.RunAsync(default);
        if ((await Samples()).Any(p => p.CreatedAt != clock.GetUtcNow().ToUnixTimeMilliseconds() || p.ExpiresAt != clock.GetUtcNow().AddDays(7).ToUnixTimeMilliseconds())) throw new Exception("Expired samples not replaced with seven-day samples.");
        config["DemoPosts:Enabled"] = "false";
        await replenisher.RunAsync(default);
        if ((await Samples()).Count != 0 || await db.Posts.CountAsync() != 1 || (await db.Posts.AsNoTracking().SingleAsync()).CreatedAt != 1) throw new Exception("Disable touched real data or retained samples.");
        Console.WriteLine("Demo checks passed: 25 per kind, unique content, valid fields, idempotency, replenishment, expiry, real-first ordering, server action denial and safe disable.");
    }
    private sealed class DemoClock(DateTimeOffset value) : TimeProvider
    {
        public DateTimeOffset Value { get; set; } = value;
        public override DateTimeOffset GetUtcNow() => Value;
    }
}
