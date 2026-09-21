namespace PutMeOn.Api.Infrastructure;

public sealed class ExpiryWorker(IServiceScopeFactory scopes, ILogger<ExpiryWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<ExpiryCleanup>().RunAsync(stoppingToken);
                await scope.ServiceProvider.GetRequiredService<DemoPostReplenisher>().RunAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError("Scheduled cleanup failed ({ErrorType}); retrying next interval.", ex.GetType().Name); }
            try
            {
                await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
            }
            catch (OperationCanceledException) { break; }
        }
    }
}
