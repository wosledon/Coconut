using Microsoft.EntityFrameworkCore;
using Coconut.Api.Models;

namespace Coconut.Api.Data;

public class CoconutDbContext : DbContext
{
    public CoconutDbContext(DbContextOptions<CoconutDbContext> options) : base(options) { }

    public DbSet<SshConnection> SshConnections => Set<SshConnection>();
    public DbSet<AiProvider> AiProviders => Set<AiProvider>();
    public DbSet<AiChatSession> AiChatSessions => Set<AiChatSession>();
    public DbSet<AiChatMessage> AiChatMessages => Set<AiChatMessage>();
    public DbSet<AppSettings> AppSettings => Set<AppSettings>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<SshConnection>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.Host).HasMaxLength(500);
            e.Property(x => x.UserName).HasMaxLength(200);
            e.Property(x => x.GroupName).HasMaxLength(100);
            e.HasIndex(x => x.GroupName);
            e.HasIndex(x => x.SortOrder);
        });

        modelBuilder.Entity<AiProvider>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.DefaultModel).HasMaxLength(200);
        });

        modelBuilder.Entity<AiChatSession>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(500);
            e.HasOne(x => x.AiProvider).WithMany().HasForeignKey(x => x.AiProviderId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.SshConnection).WithMany().HasForeignKey(x => x.SshConnectionId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<AiChatMessage>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Session).WithMany(s => s.Messages).HasForeignKey(x => x.SessionId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.SessionId, x.CreatedAt });
        });

        modelBuilder.Entity<AppSettings>(e =>
        {
            e.HasKey(x => x.Id);
        });
    }
}
