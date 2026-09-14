using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using PutMeOn.Api.Application;
using PutMeOn.Api.Infrastructure;

static class EmailChecks
{
    public static async Task RunAsync()
    {
        foreach (var provider in new[] { "Brevo", "Resend" })
        {
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Email:Mode"] = provider, ["Email:ApiKey"] = "test-key", ["Email:From"] = "sender@example.com"
            }).Build();
            var handler = new CaptureHandler();
            using var client = new HttpClient(handler);
            var sender = new EmailSender(client, config, new TestEnvironment());
            await sender.SendAsync("recipient@example.com", "012345", default);
            if (handler.Calls != 1) throw new Exception("Email request missing.");
            using var json = JsonDocument.Parse(handler.Body!);
            var body = json.RootElement;
            if (provider == "Brevo")
            {
                if (handler.Url != "https://api.brevo.com/v3/smtp/email" || handler.Key != "test-key" || body.GetProperty("to")[0].GetProperty("email").GetString() != "recipient@example.com" || !body.GetProperty("textContent").GetString()!.Contains("012345")) throw new Exception("Invalid Brevo request.");
            }
            else if (handler.Url != "https://api.resend.com/emails" || handler.Authorization != "Bearer test-key" || body.GetProperty("to")[0].GetString() != "recipient@example.com") throw new Exception("Invalid Resend request.");
            handler.Status = HttpStatusCode.TooManyRequests;
            try { await sender.SendAsync("recipient@example.com", "012345", default); throw new Exception("Provider failure incorrectly reported as sent."); }
            catch (ApiError e) when (e.Status == 503) { }
            config["Email:Mode"] = "Development";
            if (sender.IsDevelopmentDelivery) throw new Exception("Production enabled development delivery.");
            try { await sender.SendAsync("recipient@example.com", "012345", default); throw new Exception("Production accepted development provider."); }
            catch (ApiError e) when (e.Status == 503) { }
            var calls = handler.Calls;
            var local = new EmailSender(client, config, new TestEnvironment { EnvironmentName = "Development" });
            await local.SendAsync("recipient@example.com", "012345", default);
            if (handler.Calls != calls) throw new Exception("Development sent real mail.");
        }
        Console.WriteLine("Email adapter checks passed: Brevo and Resend payloads, leading-zero code, quota failure, production guard and development isolation. No real email sent.");
    }

    sealed class CaptureHandler : HttpMessageHandler
    {
        public int Calls { get; private set; }
        public string? Url, Key, Authorization, Body;
        public HttpStatusCode Status = HttpStatusCode.Created;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Calls++;
            Url = request.RequestUri!.ToString();
            Key = request.Headers.TryGetValues("api-key", out var values) ? values.Single() : null;
            Authorization = request.Headers.Authorization?.ToString();
            Body = await request.Content!.ReadAsStringAsync(ct);
            return new HttpResponseMessage(Status);
        }
    }
    sealed class TestEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Production";
        public string ApplicationName { get; set; } = "Checks";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
