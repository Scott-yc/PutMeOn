using Microsoft.EntityFrameworkCore;
using PutMeOn.Api.Infrastructure;
using System.ComponentModel.DataAnnotations;
using PutMeOn.Api.Application;
using PutMeOn.Api.Domain;
namespace PutMeOn.Api.Endpoints;

public static class ApiEndpoints
{
    private static T Validate<T>(T request) where T : class
    {
        var results = new List<ValidationResult>();
        if (!Validator.TryValidateObject(request, new ValidationContext(request), results, true))
            throw new ApiError(400, results.First().ErrorMessage ?? "Invalid request.");
        return request;
    }
    private static async Task<Account> User(AuthService auth, HttpContext h, CancellationToken ct) => await auth.CurrentAsync(h, ct) ?? throw new ApiError(401, "Please sign in.");
    public static void MapApi(this WebApplication app)
    {
        app.MapGet("/api/ready", async (AppDb db, CancellationToken ct) =>
        {
            try { await db.Accounts.AsNoTracking().Select(a => a.Id).Take(1).ToListAsync(ct); return Results.Ok(new { status = "ready" }); }
            catch (Exception ex) when (ex is not OperationCanceledException) { return Results.StatusCode(503); }
        });
        app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
        app.MapPost("/api/auth/code", async (SendCodeRequest r, AuthService auth, CancellationToken ct) => Results.Ok(await auth.SendCodeAsync(Validate(r).Email, ct))).RequireRateLimiting("auth");
        app.MapPost("/api/auth/verify", async (VerifyCodeRequest r, AuthService auth, HttpContext h, CancellationToken ct) => { Validate(r); await auth.VerifyAsync(r.Email, r.Code, h, ct); return Results.NoContent(); }).RequireRateLimiting("verify");
        app.MapPost("/api/auth/logout", async (AuthService auth, HttpContext h, CancellationToken ct) => { await auth.LogoutAsync(h, ct); return Results.NoContent(); });
        app.MapGet("/api/state", async (AuthService auth, PostService posts, HttpContext h, string? mode, string? postId, string? trade, string? location, string? kind, int? page, CancellationToken ct) =>
        {
            var user = await auth.CurrentAsync(h, ct);
            return user == null ? Results.Ok(new
            {
                email = "",
                user = (object?)null,
                profiles = Array.Empty<object>(),
                posts = Array.Empty<object>(),
                hasMore = false,
                unreadInterestCount = 0,
                page = 0
            }) : Results.Ok(await posts.StateAsync(user, mode, postId, trade, location, kind, page ?? 0, ct));
        });
        app.MapPut("/api/profile", async (ProfileRequest r, AuthService auth, PostService posts, HttpContext h, CancellationToken ct) => { await posts.SaveProfileAsync(await User(auth, h, ct), Validate(r), ct); return Results.NoContent(); });
        app.MapPost("/api/posts", async (PostRequest r, AuthService auth, PostService posts, HttpContext h, CancellationToken ct) => Results.Ok(new { id = await posts.SavePostAsync(await User(auth, h, ct), null, Validate(r), ct) }));
        app.MapPut("/api/posts/{id}", async (string id, PostRequest r, AuthService auth, PostService posts, HttpContext h, CancellationToken ct) => Results.Ok(new { id = await posts.SavePostAsync(await User(auth, h, ct), id, Validate(r), ct) }));
        app.MapDelete("/api/posts/{id}", async (string id, AuthService auth, PostService posts, HttpContext h, CancellationToken ct) => { await posts.DeleteAsync(await User(auth, h, ct), id, ct); return Results.NoContent(); });
        app.MapPost("/api/posts/{id}/interest", async (string id, AuthService auth, PostService posts, HttpContext h, CancellationToken ct) => { await posts.ApplyAsync(await User(auth, h, ct), id, ct); return Results.NoContent(); });
        app.MapPost("/api/posts/{id}/interests/viewed", async (string id, ViewedInterestsRequest r, AuthService auth, PostService posts, HttpContext h, CancellationToken ct) => { Validate(r); await posts.MarkInterestsViewedAsync(await User(auth, h, ct), id, r.ApplicantIds, ct); return Results.NoContent(); });
        app.MapGet("/api/posts/{id}/contacts/{personId}", async (string id, string personId, AuthService auth, PostService posts, HttpContext h, CancellationToken ct) => Results.Ok(await posts.ContactAsync(await User(auth, h, ct), id, personId, ct)));
    }
}
