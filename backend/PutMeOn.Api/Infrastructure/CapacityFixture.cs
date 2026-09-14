using Microsoft.EntityFrameworkCore;
using PutMeOn.Api.Domain;
namespace PutMeOn.Api.Infrastructure;

public static class CapacityFixture
{
    public static async Task SeedAsync(AppDb db)
    {
        if (await db.Accounts.AnyAsync())
            throw new InvalidOperationException("Capacity fixture requires an empty, separate test database.");
        var now = DateTimeOffset.UtcNow;
        var accounts = Enumerable.Range(1, 500).Select(i => new Account { Email = $"capacity-{i}@example.com", Name = $"Test Tradie {i}", Phone = "0400000000", Trade = i % 2 == 0 ? "Carpenter" : "Electrician", Location = "Brisbane", CreatedAt = now.ToUnixTimeMilliseconds() }).ToList();
        db.Accounts.AddRange(accounts);
        foreach (var a in accounts)
            for (var n = 0; n < 2; n++)
                db.Posts.Add(new JobPost { OwnerId = a.Id, Kind = n == 0 ? "looking" : "available", Trade = a.Trade, Location = "Brisbane", Rate = 55, From = now.ToString("yyyy-MM-dd"), To = now.AddDays(6).ToString("yyyy-MM-dd"), Description = "Synthetic capacity-test record", CreatedAt = now.ToUnixTimeMilliseconds(), ExpiresAt = now.AddDays(7).ToUnixTimeMilliseconds() });
        await db.SaveChangesAsync();
    }
}
