using System.Net;
using Microsoft.AspNetCore.HttpOverrides;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using PutMeOn.Api.Application;
using PutMeOn.Api.Infrastructure;
using PutMeOn.Api.Endpoints;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: false).AddEnvironmentVariables();
var development = builder.Environment.IsDevelopment();
if (!development && (builder.Configuration["Auth:CodeSecret"]?.Length ?? 0) < 32) throw new InvalidOperationException("Set Auth__CodeSecret to a random secret of at least 32 characters.");
if (development && string.IsNullOrEmpty(builder.Configuration["Auth:CodeSecret"])) builder.Configuration["Auth:CodeSecret"] = "LOCAL-DEVELOPMENT-ONLY-NOT-FOR-PRODUCTION";
if (!development && builder.Configuration["Email:Mode"] == "Development") throw new InvalidOperationException("Development email delivery must not be enabled in production.");
var provider = builder.Configuration["Database:Provider"] ?? "Sqlite";
if (!development && provider != "Postgres") throw new InvalidOperationException("Production requires a persistent PostgreSQL database.");
builder.Services.AddDbContext<AppDb>(o =>
{
    if (provider == "Postgres")
        o.UseNpgsql(builder.Configuration.GetConnectionString("Database") ?? throw new InvalidOperationException("Set ConnectionStrings__Database."));
    else
        o.UseSqlite(builder.Configuration.GetConnectionString("Database") ?? "Data Source=putmeon.db");
});
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<Rules>();
builder.Services.AddHttpClient<EmailSender>(c => c.Timeout = TimeSpan.FromSeconds(15));
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<PostService>();
builder.Services.AddScoped<ExpiryCleanup>();
builder.Services.AddHostedService<ExpiryWorker>();
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    foreach (var address in builder.Configuration.GetSection("Proxy:KnownProxies").Get<string[]>() ?? [])
        o.KnownProxies.Add(IPAddress.Parse(address));
});
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.AddPolicy("auth", h => RateLimitPartition.GetFixedWindowLimiter(h.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(10), QueueLimit = 0 }));
    o.AddPolicy("verify", h => RateLimitPartition.GetFixedWindowLimiter(h.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(10), QueueLimit = 0 }));
    o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(h => RateLimitPartition.GetFixedWindowLimiter(h.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = 600, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 16384);
var app = builder.Build();
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDb>();
    if (provider == "Sqlite" && development)
        await db.Database.EnsureCreatedAsync();
    else if (args.Contains("--migrate"))
        await db.Database.MigrateAsync();
    if (args.Contains("--seed-capacity"))
    {
        if (!development || provider != "Sqlite")
            throw new InvalidOperationException("Capacity fixtures are local development only.");
        await CapacityFixture.SeedAsync(db);
    }
}
if (args.Contains("--migrate") || args.Contains("--seed-capacity")) return;
app.Use(async (h, next) =>
{
    h.Response.Headers["X-Content-Type-Options"] = "nosniff";
    h.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    if (h.Request.Path.StartsWithSegments("/api"))
        h.Response.Headers.CacheControl = "no-store";
    try
    {
        if (h.Request.Path.StartsWithSegments("/api") && h.Request.Method is not ("GET" or "HEAD" or "OPTIONS") && h.Request.Headers["X-PutMeOn-Request"] != "1")
            throw new ApiError(403, "Invalid request origin.");
        await next();
    }
    catch (ApiError ex) { h.Response.StatusCode = ex.Status; await h.Response.WriteAsJsonAsync(new { error = ex.Message }); }
    catch (DbUpdateConcurrencyException) { h.Response.StatusCode = 409; await h.Response.WriteAsJsonAsync(new { error = "This record changed. Reload and try again." }); }
    catch (DbUpdateException ex) { app.Logger.LogWarning(ex, "Database write conflict"); h.Response.StatusCode = 409; await h.Response.WriteAsJsonAsync(new { error = "Could not save this change. Reload and try again." }); }
    catch (Exception ex) when (ex is not OperationCanceledException) { app.Logger.LogError(ex, "Request failed"); h.Response.StatusCode = 500; await h.Response.WriteAsJsonAsync(new { error = "The service is temporarily unavailable. Please try again." }); }
});
app.UseForwardedHeaders();
app.UseRateLimiter();
app.MapApi();
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapFallback("/api/{**path}", () => Results.NotFound(new { error = "API endpoint not found." }));
app.MapFallbackToFile("index.html");
app.Run();
