using Microsoft.EntityFrameworkCore;
using PutMeOn.Api.Domain;
namespace PutMeOn.Api.Infrastructure;

public sealed class AppDb(DbContextOptions<AppDb> options) : DbContext(options)
{
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<JobPost> Posts => Set<JobPost>();
    public DbSet<ApplicationEntry> Applications => Set<ApplicationEntry>();
    public DbSet<LoginCode> LoginCodes => Set<LoginCode>();
    public DbSet<LoginSession> Sessions => Set<LoginSession>();
    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Account>().HasIndex(x => x.Email).IsUnique();
        b.Entity<Account>().Property(x => x.Email).HasMaxLength(254);
        b.Entity<JobPost>().HasIndex(x => x.ExpiresAt);
        b.Entity<JobPost>().HasIndex(x => new { x.CreatedAt, x.Id });
        b.Entity<JobPost>().HasIndex(x => new { x.OwnerId, x.ExpiresAt });
        b.Entity<JobPost>().HasIndex(x => new { x.Trade, x.Kind, x.ExpiresAt });
        b.Entity<JobPost>().Property(x => x.Rate).HasPrecision(10, 2);
        b.Entity<JobPost>().Property(x => x.Revision).IsConcurrencyToken();
        b.Entity<JobPost>().HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<ApplicationEntry>().HasKey(x => new { x.PostId, x.ApplicantId });
        b.Entity<ApplicationEntry>().HasOne(x => x.Post).WithMany(x => x.Applications).HasForeignKey(x => x.PostId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<ApplicationEntry>().HasOne(x => x.Applicant).WithMany().HasForeignKey(x => x.ApplicantId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<LoginCode>().HasKey(x => x.Email);
        b.Entity<LoginCode>().Property(x => x.Revision).IsConcurrencyToken();
        b.Entity<LoginCode>().HasIndex(x => x.ExpiresAt);
        b.Entity<LoginSession>().HasKey(x => x.Hash);
        b.Entity<LoginSession>().HasIndex(x => x.ExpiresAt);
        b.Entity<LoginSession>().HasOne(x => x.Account).WithMany().HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);
    }
}
