using Microsoft.EntityFrameworkCore;
namespace PutMeOn.Api.Infrastructure;

public sealed class ExpiryCleanup(AppDb db, TimeProvider clock)
{
    public async Task RunAsync(CancellationToken ct)
    {
        var now = clock.GetUtcNow().ToUnixTimeMilliseconds();
        await db.Posts.Where(p => p.ExpiresAt <= now).ExecuteDeleteAsync(ct);
        await db.Sessions.Where(s => s.ExpiresAt <= now).ExecuteDeleteAsync(ct);
        await db.LoginCodes.Where(c => c.LastSentAt < now - 86400000).ExecuteDeleteAsync(ct);
    }
}
