using Microsoft.EntityFrameworkCore;
using PutMeOn.Api.Domain;
using PutMeOn.Api.Infrastructure;
namespace PutMeOn.Api.Application;

public sealed class ContactService(AppDb db, TimeProvider clock)
{
    private long Now => clock.GetUtcNow().ToUnixTimeMilliseconds();
    public async Task<object> ContactAsync(Account a, string id, string personId, CancellationToken ct)
    {
        Rules.Completed(a);
        var now = Now;
        var p = await db.Posts.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.ExpiresAt > now, ct) ?? throw new ApiError(404, "Post not found or expired.");
        if (p.OwnerId == DemoPostIdentity.OwnerId) throw new ApiError(403, "Example posts do not have contact details.");
        var ownerContact = p.Kind == "available" && personId == p.OwnerId;
        var applicantContact = p.OwnerId == a.Id && await db.Applications.AnyAsync(x => x.PostId == id && x.ApplicantId == personId, ct);
        if (!ownerContact && !applicantContact)
            throw new ApiError(403, "You cannot view these contact details.");
        var person = await db.Accounts.AsNoTracking().SingleAsync(x => x.Id == personId, ct);
        return ResponseMapping.ProfileDto(person, true, ownerContact ? p.CompanyName : null);
    }
}
