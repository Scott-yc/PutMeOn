using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using PutMeOn.Api.Application;
using PutMeOn.Api.Domain;
using PutMeOn.Api.Infrastructure;

internal static class ConcurrencyChecks
{
    public static async Task RunAsync()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var race = new RevisionRace();
        await using var db = new AppDb(new DbContextOptionsBuilder<AppDb>().UseSqlite(connection).AddInterceptors(race).Options);
        await db.Database.EnsureCreatedAsync();
        var owner = new Account { Email = "owner@example.test", Name = "Owner" };
        var applicant = new Account { Email = "applicant@example.test", Name = "Applicant" };
        var post = new JobPost { OwnerId = owner.Id, ExpiresAt = DateTimeOffset.UtcNow.AddDays(1).ToUnixTimeMilliseconds() };
        db.AddRange(owner, applicant, post); await db.SaveChangesAsync();
        await new PostService(db, new Rules(), TimeProvider.System).ApplyAsync(applicant, post.Id, default);
        if (!race.Fired || await db.Applications.CountAsync() != 1 || await db.Posts.Select(p => p.Revision).SingleAsync() != 3)
            throw new Exception("Concurrent revision retry did not preserve the application.");
        Console.WriteLine("Concurrency retry check passed: intervening post revision change is retried without duplicate/lost application.");
    }
    private sealed class RevisionRace : SaveChangesInterceptor
    {
        public bool Fired { get; private set; }
        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData data, InterceptionResult<int> result, CancellationToken ct = default)
        {
            var db = (AppDb)data.Context!;
            var entry = db.ChangeTracker.Entries<ApplicationEntry>().FirstOrDefault(e => e.State == EntityState.Added);
            if (!Fired && entry != null)
            {
                Fired = true;
                await db.Posts.Where(p => p.Id == entry.Entity.PostId).ExecuteUpdateAsync(s => s.SetProperty(p => p.Revision, p => p.Revision + 1), ct);
            }
            return result;
        }
    }
}
