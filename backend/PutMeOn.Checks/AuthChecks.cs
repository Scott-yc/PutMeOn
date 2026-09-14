using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using PutMeOn.Api.Application;
using PutMeOn.Api.Infrastructure;
using System.Text.Json;

static class AuthChecks
{
    public static async Task RunAsync()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new AppDb(new DbContextOptionsBuilder<AppDb>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Email:Mode"] = "Development", ["Auth:CodeSecret"] = "local-test-secret-only" }).Build();
        var clock = new TestClock(DateTimeOffset.Parse("2026-09-14T03:00:00Z"));
        var env = new AuthEnvironment();
        using var client = new HttpClient();
        var auth = new AuthService(db, new EmailSender(client, config, env), config, env, clock);
        const string email = "auth-check@example.com";
        async Task<string> Send() => JsonSerializer.SerializeToElement(await auth.SendCodeAsync(email, default)).GetProperty("developmentCode").GetString()!;
        async Task Rejected(Func<Task> action, int status)
        {
            try { await action(); throw new Exception("Expected rejection."); }
            catch (ApiError e) when (e.Status == status) { }
        }
        var code = await Send();
        clock.Value = clock.Value.AddSeconds(59);
        await Rejected(async () => { await Send(); }, 429);
        clock.Value = clock.Value.AddSeconds(1);
        code = await Send();
        clock.Value = clock.Value.AddMinutes(5);
        await Rejected(() => auth.VerifyAsync(email, code, new DefaultHttpContext(), default), 400);
        code = await Send();
        var login = new DefaultHttpContext();
        await auth.VerifyAsync(email, code, login, default);
        var cookie = login.Response.Headers.SetCookie.ToString();
        if (!cookie.Contains("httponly", StringComparison.OrdinalIgnoreCase) || !cookie.Contains("expires=", StringComparison.OrdinalIgnoreCase)) throw new Exception("Persistent HttpOnly cookie missing.");
        await Rejected(() => auth.VerifyAsync(email, code, new DefaultHttpContext(), default), 400);
        var request = new DefaultHttpContext();
        request.Request.Headers.Cookie = cookie.Split(';')[0];
        clock.Value = clock.Value.AddMinutes(20);
        db.ChangeTracker.Clear();
        if (await auth.CurrentAsync(request, default) is null) throw new Exception("Session lost after backgrounding.");
        clock.Value = clock.Value.AddDays(29);
        if (await auth.CurrentAsync(request, default) is null) throw new Exception("Session expired early.");
        await auth.LogoutAsync(request, default);
        if (await auth.CurrentAsync(request, default) is not null) throw new Exception("Logout did not revoke session.");
        for (var i = 0; i < 15; i++) { await Send(); clock.Value = clock.Value.AddMinutes(1); }
        await Rejected(async () => { await Send(); }, 429);
        code = "";
        clock.Value = clock.Value.AddHours(1);
        code = await Send();
        login = new DefaultHttpContext();
        await auth.VerifyAsync(email, code, login, default);
        request.Request.Headers.Cookie = login.Response.Headers.SetCookie.ToString().Split(';')[0];
        clock.Value = clock.Value.AddDays(30);
        if (await auth.CurrentAsync(request, default) is not null) throw new Exception("Session outlived 30 days.");
        Console.WriteLine("Auth checks passed: five-minute expiry, single use, 60-second resend, 15/hour limit, persistent login after 20 minutes/29 days, logout and 30-day expiry. No mail sent.");
    }
    sealed class AuthEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Development";
        public string ApplicationName { get; set; } = "Checks";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
