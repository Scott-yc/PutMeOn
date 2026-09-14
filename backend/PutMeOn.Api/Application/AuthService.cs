using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using PutMeOn.Api.Domain;
using PutMeOn.Api.Infrastructure;
namespace PutMeOn.Api.Application;

public sealed class AuthService(AppDb db, EmailSender sender, IConfiguration config, IHostEnvironment env, TimeProvider clock)
{
    public string CookieName => env.IsDevelopment() ? "pmo_session" : "__Host-pmo_session";
    public static string TokenHash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
    private long Now => clock.GetUtcNow().ToUnixTimeMilliseconds();
    private string CodeHash(string email, string code) => Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(config["Auth:CodeSecret"]!), Encoding.UTF8.GetBytes(email + ":" + code)));
    public async Task<object> SendCodeAsync(string email, CancellationToken ct)
    {
        email = email.Trim().ToLowerInvariant();
        var now = Now;
        var row = await db.LoginCodes.FindAsync([email], ct);
        if (row != null && now - row.LastSentAt < 60000)
            throw new ApiError(429, $"Please wait {(int)Math.Ceiling((60000 - (now - row.LastSentAt)) / 1000d)} seconds before requesting another code.");
        if (row != null && now - row.WindowStart < 3600000 && row.SentInWindow >= 15)
            throw new ApiError(429, $"Too many codes requested. Try again in {(int)Math.Ceiling((3600000 - (now - row.WindowStart)) / 60000d)} minutes.");
        var code = RandomNumberGenerator.GetInt32(1000000).ToString("D6");
        if (row == null)
        {
            row = new LoginCode { Email = email, WindowStart = now };
            db.LoginCodes.Add(row);
        }
        if (now - row.WindowStart >= 3600000)
        {
            row.WindowStart = now;
            row.SentInWindow = 0;
        }
        row.SentInWindow++;
        row.Attempts = 0;
        row.Hash = CodeHash(email, code);
        row.ExpiresAt = now + 300000;
        row.LastSentAt = now;
        row.Revision++;
        await db.SaveChangesAsync(ct);
        try
        {
            await sender.SendAsync(email, code, ct);
        }
        catch { row.ExpiresAt = 0; await db.SaveChangesAsync(ct); throw; }
        return new
        {
            message = "Your login code is ready.",
            developmentCode = sender.IsDevelopmentDelivery ? code : null
        };
    }
    public async Task VerifyAsync(string email, string code, HttpContext http, CancellationToken ct)
    {
        email = email.Trim().ToLowerInvariant();
        var row = await db.LoginCodes.FindAsync([email], ct);
        var now = Now;
        if (row == null || row.ExpiresAt <= now || row.Attempts >= 5)
            throw new ApiError(400, "The code is invalid or expired. Request a new code.");
        row.Attempts++;
        row.Revision++;
        if (!CryptographicOperations.FixedTimeEquals(Convert.FromHexString(row.Hash), Convert.FromHexString(CodeHash(email, code))))
        {
            await db.SaveChangesAsync(ct);
            throw new ApiError(400, "Incorrect code. Please check the six digits.");
        }
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        row.ExpiresAt = 0; // single use, preserve resend rate-limit record
        var account = await db.Accounts.SingleOrDefaultAsync(x => x.Email == email, ct);
        if (account == null)
        {
            account = new Account { Email = email, CreatedAt = now };
            db.Accounts.Add(account);
        }
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var expiry = now + 30L * 86400000;
        if (http.Request.Cookies.TryGetValue(CookieName, out var previous))
            await db.Sessions.Where(x => x.Hash == TokenHash(previous)).ExecuteDeleteAsync(ct);
        db.Sessions.Add(new LoginSession { Hash = TokenHash(token), AccountId = account.Id, ExpiresAt = expiry });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        http.Response.Cookies.Append(CookieName, token, new CookieOptions { HttpOnly = true, Secure = !env.IsDevelopment(), SameSite = SameSiteMode.Strict, Path = "/", Expires = DateTimeOffset.FromUnixTimeMilliseconds(expiry), IsEssential = true });
    }
    public async Task<Account?> CurrentAsync(HttpContext http, CancellationToken ct)
    {
        if (!http.Request.Cookies.TryGetValue(CookieName, out var token) || token.Length != 64)
            return null;
        var hash = TokenHash(token);
        var now = Now;
        return await db.Sessions.Where(x => x.Hash == hash && x.ExpiresAt > now).Select(x => x.Account).SingleOrDefaultAsync(ct);
    }
    public async Task LogoutAsync(HttpContext http, CancellationToken ct)
    {
        if (http.Request.Cookies.TryGetValue(CookieName, out var token))
            await db.Sessions.Where(x => x.Hash == TokenHash(token)).ExecuteDeleteAsync(ct);
        http.Response.Cookies.Delete(CookieName, new CookieOptions { Path = "/", Secure = !env.IsDevelopment(), SameSite = SameSiteMode.Strict });
    }
}
