using Microsoft.EntityFrameworkCore;
using PutMeOn.Api.Domain;
using PutMeOn.Api.Infrastructure;
namespace PutMeOn.Api.Application;

internal static class ResponseMapping
{
    public static object ProfileDto(Account a, bool contact = false, string? company = null) => new { a.Id, email = contact ? a.Email : "", a.Name, phone = contact ? a.Phone : "", a.Trade, a.Location, companyName = company ?? a.CompanyName };
    public static object PostDto(JobPost p, string viewerId) => new { p.Id, p.OwnerId, isDemo = p.OwnerId == DemoPostIdentity.OwnerId, p.Kind, p.Trade, p.Location, p.CompanyName, p.Rate, p.From, p.To, p.Description, createdAt = DateTimeOffset.FromUnixTimeMilliseconds(p.CreatedAt).ToString("O"), p.Revision, viewedInterestCount = p.OwnerId == viewerId ? p.Applications.Count(x => x.Viewed) : 0, interested = p.Applications.Where(x => p.OwnerId == viewerId || x.ApplicantId == viewerId).Select(x => x.ApplicantId).ToArray() };
}
