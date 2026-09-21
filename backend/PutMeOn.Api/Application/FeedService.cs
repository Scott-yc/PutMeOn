using Microsoft.EntityFrameworkCore;
using PutMeOn.Api.Domain;
using PutMeOn.Api.Infrastructure;
namespace PutMeOn.Api.Application;

public sealed class FeedService(AppDb db, TimeProvider clock)
{
    private long Now => clock.GetUtcNow().ToUnixTimeMilliseconds();
    public async Task<object> StateAsync(Account account, string? mode, string? postId, string? trade, string? location, string? kind, int page, CancellationToken ct)
    {
        var now = Now;
        var query = db.Posts.AsNoTracking().Where(p => p.ExpiresAt > now);
        if (!string.IsNullOrEmpty(postId))
            query = query.Where(p => p.Id == postId);
        else
        {
            if (mode == "mine")
                query = query.Where(p => p.OwnerId == account.Id);
            if (!string.IsNullOrWhiteSpace(trade))
                query = query.Where(p => p.Trade == trade);
            if (!string.IsNullOrWhiteSpace(location))
            {
                var search = location.Trim().ToLowerInvariant();
                query = query.Where(p => p.Location.ToLower().Contains(search));
            }
            if (kind is "looking" or "available")
                query = query.Where(p => p.Kind == kind);
        }
        page = Math.Clamp(page, 0, 1000);
        var posts = await query.OrderBy(p => p.OwnerId == DemoPostIdentity.OwnerId).ThenByDescending(p => p.CreatedAt).ThenBy(p => p.Id).Skip(page * 30).Take(31).Include(p => p.Owner).Include(p => p.Applications).AsSplitQuery().ToListAsync(ct);
        var hasMore = posts.Count > 30;
        posts = posts.Take(30).ToList();
        var people = posts.Select(p => p.Owner).DistinctBy(a => a.Id).ToDictionary(a => a.Id);
        var applicantIds = posts.Where(p => p.OwnerId == account.Id).SelectMany(p => p.Applications).Select(a => a.ApplicantId).Distinct().ToArray();
        foreach (var person in await db.Accounts.AsNoTracking().Where(a => applicantIds.Contains(a.Id)).ToListAsync(ct))
            people[person.Id] = person;
        people[account.Id] = account;
        return new
        {
            email = account.Email,
            user = account.Name.Length > 0 ? ResponseMapping.ProfileDto(account, true) : null,
            profiles = people.Values.Select(a => ResponseMapping.ProfileDto(a, a.Id == account.Id)),
            posts = posts.Select(p => ResponseMapping.PostDto(p, account.Id)),
            unreadInterestCount = await db.Applications.CountAsync(x => !x.Viewed && x.Post.OwnerId == account.Id && x.Post.ExpiresAt > now, ct),
            hasMore,
            page
        };
    }
}
