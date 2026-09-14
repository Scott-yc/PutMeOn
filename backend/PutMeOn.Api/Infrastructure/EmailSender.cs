using System.Net.Http.Headers;
using System.Net.Http.Json;
using PutMeOn.Api.Application;
namespace PutMeOn.Api.Infrastructure;

public sealed class EmailSender(HttpClient client, IConfiguration config, IHostEnvironment env)
{
    public bool IsDevelopmentDelivery => env.IsDevelopment() && config["Email:Mode"] == "Development";
    public async Task SendAsync(string email, string code, CancellationToken ct)
    {
        if (IsDevelopmentDelivery)
            return;
        var key = config["Email:ApiKey"];
        var from = config["Email:From"];
        if (string.IsNullOrWhiteSpace(key) || string.IsNullOrWhiteSpace(from))
            throw new ApiError(503, "Email delivery is not configured. Please contact the site owner.");
        var mode = config["Email:Mode"];
        if (mode is not ("Brevo" or "Resend"))
            throw new ApiError(503, "Email provider is not configured correctly.");
        using var request = new HttpRequestMessage(HttpMethod.Post,
            mode == "Brevo" ? "https://api.brevo.com/v3/smtp/email" : "https://api.resend.com/emails");
        var subject = "Your PutMeOn login code";
        var text = $"Your login code is {code}. It expires in 5 minutes. If you did not request this, ignore this email.";
        if (mode == "Brevo")
        {
            request.Headers.Add("api-key", key);
            request.Content = JsonContent.Create(new
            {
                sender = new
                {
                    email = from,
                    name = "PutMeOn"
                },
                to = new[] { new { email } },
                subject,
                textContent = text
            });
        }
        else
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
            request.Content = JsonContent.Create(new
            {
                from,
                to = new[] { email },
                subject,
                text
            });
        }
        using var response = await client.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
            throw new ApiError(503, "Could not send a login code. Please try again later.");
    }
}
