using Microsoft.EntityFrameworkCore;
using PutMeOn.Api.Domain;
using PutMeOn.Api.Infrastructure;
namespace PutMeOn.Api.Application;

public sealed class PostService(AppDb db, Rules rules, TimeProvider clock)
{
    private long Now => clock.GetUtcNow().ToUnixTimeMilliseconds();
    public static object ProfileDto(Account a, bool contact = false, string? company = null) => new { a.Id, email = contact ? a.Email : "", a.Name, phone = contact ? a.Phone : "", a.Trade, a.Location, companyName = company ?? a.CompanyName };
    public static object PostDto(JobPost p, string viewerId) => new { p.Id, p.OwnerId, p.Kind, p.Trade, p.Location, p.CompanyName, p.Rate, p.From, p.To, p.Description, createdAt = DateTimeOffset.FromUnixTimeMilliseconds(p.CreatedAt).ToString("O"), p.Revision, interested = p.Applications.Where(x => p.OwnerId == viewerId || x.ApplicantId == viewerId).Select(x => x.ApplicantId).ToArray() };
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
        var posts = await query.OrderByDescending(p => p.CreatedAt).ThenBy(p => p.Id).Skip(page * 30).Take(31).Include(p => p.Owner).Include(p => p.Applications).AsSplitQuery().ToListAsync(ct);
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
            user = account.Name.Length > 0 ? ProfileDto(account, true) : null,
            profiles = people.Values.Select(a => ProfileDto(a, a.Id == account.Id)),
            posts = posts.Select(p => PostDto(p, account.Id)),
            hasMore,
            page
        };
    }
    public async Task SaveProfileAsync(Account account, ProfileRequest r, CancellationToken ct)
    {
        rules.Profile(r);
        account.Name = r.Name.Trim();
        account.Phone = r.Phone.Trim();
        account.Trade = r.Trade;
        account.Location = r.Location.Trim();
        account.CompanyName = r.CompanyName?.Trim() ?? "";
        await db.SaveChangesAsync(ct);
    }
    public async Task<string> SavePostAsync(Account a, string? id, PostRequest r, CancellationToken ct)
    {
        Rules.Completed(a);
        rules.Post(r, clock.GetUtcNow());
        var now = Now;
        JobPost post;
        if (id == null)
        {
            if (await db.Posts.CountAsync(p => p.OwnerId == a.Id && p.ExpiresAt > now, ct) >= 20)
                throw new ApiError(409, "You can have up to 20 active posts.");
            post = new JobPost { OwnerId = a.Id, CreatedAt = now, ExpiresAt = now + 7L * 86400000 };
            db.Posts.Add(post);
        }
        else
        {
            post = await OwnedAsync(a, id, ct);
            if (r.Revision != post.Revision)
                throw new ApiError(409, "This post has changed. Reload it before saving.");
            if (post.Kind != r.Kind && await db.Applications.AnyAsync(x => x.PostId == id, ct))
                throw new ApiError(409, "This post already has applicants. Keep its post type or create a separate post.");
            post.Revision++;
        }
        post.Kind = r.Kind;
        post.Trade = r.Trade;
        post.Location = r.Location.Trim();
        post.CompanyName = r.CompanyName?.Trim() ?? "";
        post.Rate = r.Rate;
        post.From = r.From;
        post.To = r.To;
        post.Description = r.Description.Trim();
        await db.SaveChangesAsync(ct);
        return post.Id;
    }
    private async Task<JobPost> OwnedAsync(Account a, string id, CancellationToken ct)
    {
        var now = Now;
        var p = await db.Posts.SingleOrDefaultAsync(x => x.Id == id && x.ExpiresAt > now, ct) ?? throw new ApiError(404, "Post not found or expired.");
        if (p.OwnerId != a.Id)
            throw new ApiError(403, "Only the poster can change this post.");
        return p;
    }
    public async Task DeleteAsync(Account a, string id, CancellationToken ct)
    {
        var p = await OwnedAsync(a, id, ct);
        db.Posts.Remove(p);
        await db.SaveChangesAsync(ct);
    }
    public async Task ApplyAsync(Account a, string id, CancellationToken ct)
    {
        Rules.Completed(a);
        var now = Now;
        var p = await db.Posts.SingleOrDefaultAsync(x => x.Id == id && x.ExpiresAt > now, ct) ?? throw new ApiError(404, "Post not found or expired.");
        if (p.Kind != "looking" || p.OwnerId == a.Id)
            throw new ApiError(400, "You cannot apply to this post.");
        if (await db.Applications.AnyAsync(x => x.PostId == id && x.ApplicantId == a.Id, ct))
            return;
        db.Applications.Add(new ApplicationEntry { PostId = id, ApplicantId = a.Id, CreatedAt = now });
        p.Revision++;
        await db.SaveChangesAsync(ct);
    }
    public async Task<object> ContactAsync(Account a, string id, string personId, CancellationToken ct)
    {
        Rules.Completed(a);
        var now = Now;
        var p = await db.Posts.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.ExpiresAt > now, ct) ?? throw new ApiError(404, "Post not found or expired.");
        var ownerContact = p.Kind == "available" && personId == p.OwnerId;
        var applicantContact = p.OwnerId == a.Id && await db.Applications.AnyAsync(x => x.PostId == id && x.ApplicantId == personId, ct);
        if (!ownerContact && !applicantContact)
            throw new ApiError(403, "You cannot view these contact details.");
        var person = await db.Accounts.AsNoTracking().SingleAsync(x => x.Id == personId, ct);
        return ProfileDto(person, true, ownerContact ? p.CompanyName : null);
    }
}
