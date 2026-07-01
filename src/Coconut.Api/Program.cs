using Microsoft.EntityFrameworkCore;
using Coconut.Api.Data;
using Coconut.Api.Services;
using Coconut.Api.Hubs;

var builder = WebApplication.CreateBuilder(args);

// Database
builder.Services.AddDbContext<CoconutDbContext>(options =>
    options.UseSqlite("Data Source=" + Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".coconut", "data.db")));

// Services
builder.Services.AddSingleton<EncryptionService>();
builder.Services.AddSingleton<SshService>();
builder.Services.AddScoped<SftpService>();
builder.Services.AddScoped<MonitorService>();
builder.Services.AddScoped<AiService>();
builder.Services.AddHttpClient();

// API
builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
builder.Services.AddSignalR();

// CORS for frontend dev server
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()
              .SetIsOriginAllowed(_ => true);
    });
});

var app = builder.Build();

// Ensure database directory exists and apply migrations
var dbDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".coconut");
Directory.CreateDirectory(dbDir);

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<CoconutDbContext>();
    db.Database.Migrate();
}

// Middleware
app.UseCors();
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapControllers();
app.MapHub<TerminalHub>("/hubs/terminal");
app.MapHub<MonitorHub>("/hubs/monitor");

// SPA fallback
app.MapFallbackToFile("index.html");

app.Run();
