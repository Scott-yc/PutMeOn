using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
namespace PutMeOn.Api.Infrastructure;

public sealed class DesignTimeDbFactory : IDesignTimeDbContextFactory<AppDb>
{
    public AppDb CreateDbContext(string[] args) => new(new DbContextOptionsBuilder<AppDb>().UseNpgsql("Host=localhost;Database=putmeon;Username=postgres;Password=design-time-only").Options);
}
