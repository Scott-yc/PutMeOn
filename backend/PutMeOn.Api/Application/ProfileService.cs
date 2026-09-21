using Microsoft.EntityFrameworkCore;
using PutMeOn.Api.Domain;
using PutMeOn.Api.Infrastructure;
namespace PutMeOn.Api.Application;

public sealed class ProfileService(AppDb db, Rules rules)
{
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
}
