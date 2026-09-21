using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using PutMeOn.Api.Domain;
namespace PutMeOn.Api.Application;

public sealed class Rules
{
    private readonly HashSet<string> trades = JsonSerializer.Deserialize<string[]>(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "trades.json")))!.ToHashSet();
    public IReadOnlyCollection<string> Trades => trades;
    public void Profile(ProfileRequest r)
    {
        Common(r.Trade, r.Location, r.CompanyName);
        if (string.IsNullOrWhiteSpace(r.Name) || r.Name.Trim().Length > 80)
            throw new ApiError(400, "Enter your name (up to 80 characters).");
        if (!Regex.IsMatch(r.Phone ?? "", "^[+0-9 ()-]{8,20}$") || Regex.Replace(r.Phone!, "[^0-9]", "").Length < 8)
            throw new ApiError(400, "Enter a valid phone number.");
    }
    public void Post(PostRequest r, DateTimeOffset now)
    {
        Common(r.Trade, r.Location, r.CompanyName);
        if (r.Kind is not ("looking" or "available"))
            throw new ApiError(400, "Choose a post type.");
        if (r.Rate < 1 || r.Rate > 10000 || decimal.Round(r.Rate, 2) != r.Rate)
            throw new ApiError(400, "Enter an hourly rate between $1 and $10,000, with at most two decimal places.");
        if (string.IsNullOrWhiteSpace(r.Description) || r.Description.Length > 500)
            throw new ApiError(400, "Enter a description (up to 500 characters).");
        if (!DateOnly.TryParseExact(r.From, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var from) || !DateOnly.TryParseExact(r.To, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var to) || from > to || to < DateOnly.FromDateTime(now.ToOffset(TimeSpan.FromHours(10)).DateTime))
            throw new ApiError(400, "Enter valid work dates; end date must be today or later and on or after the start date.");
    }
    private void Common(string trade, string location, string? company)
    {
        if (!trades.Contains(trade))
            throw new ApiError(400, "Choose a valid trade.");
        if (string.IsNullOrWhiteSpace(location) || location.Length > 80)
            throw new ApiError(400, "Enter a suburb (up to 80 characters).");
        if (company?.Length > 120)
            throw new ApiError(400, "Company name must be at most 120 characters.");
    }
    public static void Completed(Account a)
    {
        if (a.Name.Length == 0)
            throw new ApiError(409, "Complete your profile first.");
    }
}
