using System.Data;
using Microsoft.EntityFrameworkCore;
using PutMeOn.Api.Application;
using PutMeOn.Api.Domain;

namespace PutMeOn.Api.Infrastructure;

public sealed class DemoPostReplenisher(AppDb db, Rules rules, TimeProvider clock, IConfiguration config)
{
    public const int PerKind = 25;
    private static readonly string[] Suburbs = ["Brisbane", "Chermside", "Woolloongabba", "Toowong", "New Farm", "West End", "Indooroopilly", "Carindale", "Nundah", "Stafford", "Coorparoo", "Sunnybank", "Taringa", "Redcliffe", "Ipswich", "Logan Central", "Springwood", "North Lakes", "Wynnum", "Capalaba", "Paddington", "Milton", "Kedron", "Everton Park", "Morningside"];
    private static readonly string[] Settings = ["a residential renovation", "a small commercial fit-out", "a new home build", "a property maintenance project", "a staged site upgrade"];
    private static readonly string[] Schedules = ["Weekday mornings", "Full weekdays", "Flexible weekday hours", "A short-term booking", "A planned multi-day schedule"];

    public async Task RunAsync(CancellationToken ct)
    {
        // Stable slot IDs plus a serializable transaction prevent duplicate batches
        // if two instances start together. A losing transaction retries next interval.
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        if (!config.GetValue<bool>("DemoPosts:Enabled"))
        {
            await db.Posts.Where(p => p.OwnerId == DemoPostIdentity.OwnerId).ExecuteDeleteAsync(ct);
            await transaction.CommitAsync(ct);
            return;
        }
        var now = clock.GetUtcNow();
        var stamp = now.ToUnixTimeMilliseconds();
        if (!await db.Accounts.AnyAsync(a => a.Id == DemoPostIdentity.OwnerId, ct))
            db.Accounts.Add(new Account { Id = DemoPostIdentity.OwnerId, Email = DemoPostIdentity.Email, Name = "PutMeOn Demo", CreatedAt = stamp });
        var existing = await db.Posts.Where(p => p.OwnerId == DemoPostIdentity.OwnerId).ToListAsync(ct);
        var used = existing.Where(p => p.ExpiresAt > stamp).Select(p => $"{p.Kind}|{p.Trade}|{p.Location}").ToHashSet();
        foreach (var kind in new[] { "looking", "available" })
        {
            var choices = rules.Trades.SelectMany(trade => Suburbs.Select(suburb => (trade, suburb)))
                .Where(x => !used.Contains($"{kind}|{x.trade}|{x.suburb}"))
                .OrderBy(_ => Random.Shared.Next()).ToList();
            for (var slot = 0; slot < PerKind; slot++)
            {
                var id = $"demo-{kind}-{slot}";
                var post = existing.SingleOrDefault(p => p.Id == id);
                if (post != null && post.ExpiresAt > stamp) continue;
                var (trade, suburb) = choices[^1];
                choices.RemoveAt(choices.Count - 1);
                if (post == null) { post = new JobPost { Id = id, OwnerId = DemoPostIdentity.OwnerId }; db.Posts.Add(post); }
                else post.Revision++;
                var start = now.ToOffset(TimeSpan.FromHours(10)).AddDays(Random.Shared.Next(1, 8));
                post.Kind = kind;
                post.Trade = trade;
                post.Location = suburb;
                post.CompanyName = "";
                post.Rate = Random.Shared.Next(6, 19) * 5;
                post.From = start.ToString("yyyy-MM-dd");
                post.To = start.AddDays(Random.Shared.Next(2, 15)).ToString("yyyy-MM-dd");
                var setting = Settings[Random.Shared.Next(Settings.Length)];
                var schedule = Schedules[Random.Shared.Next(Schedules.Length)];
                post.Description = kind == "looking"
                    ? $"Example only: seeking a {trade.ToLowerInvariant()} in {suburb} for {setting}. {schedule}, starting {post.From}. Scope and site access would be discussed before booking. This is not a real vacancy; rates and dates are illustrative."
                    : $"Example only: {trade.ToLowerInvariant()} available around {suburb} from {post.From} for {setting}. {schedule}. This shows how a tradie can describe availability and preferred work. This is not a real worker profile; rates and dates are illustrative.";
                post.CreatedAt = stamp;
                post.ExpiresAt = now.AddDays(7).ToUnixTimeMilliseconds();
            }
        }
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }
}
