using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Coconut.Api.Data;
using Coconut.Api.Models;

namespace Coconut.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SettingsController : ControllerBase
{
    private readonly CoconutDbContext _db;

    public SettingsController(CoconutDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<AppSettings>> Get()
    {
        var settings = await _db.AppSettings.FindAsync(1);
        if (settings is null)
        {
            settings = new AppSettings();
            _db.AppSettings.Add(settings);
            await _db.SaveChangesAsync();
        }
        return settings;
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] UpdateSettingsRequest request)
    {
        var settings = await _db.AppSettings.FindAsync(1);
        if (settings is null)
        {
            settings = new AppSettings();
            _db.AppSettings.Add(settings);
        }

        if (request.Theme is not null) settings.Theme = request.Theme;
        if (request.Language is not null) settings.Language = request.Language;
        if (request.AutoConnectLast is not null) settings.AutoConnectLast = request.AutoConnectLast.Value;
        if (request.FontSize is not null) settings.FontSize = request.FontSize.Value;
        if (request.FontFamily is not null) settings.FontFamily = request.FontFamily;
        if (request.CursorStyle is not null) settings.CursorStyle = request.CursorStyle;
        if (request.ScrollbackLines is not null) settings.ScrollbackLines = request.ScrollbackLines.Value;
        if (request.DefaultPort is not null) settings.DefaultPort = request.DefaultPort.Value;
        if (request.ConnectionTimeout is not null) settings.ConnectionTimeout = request.ConnectionTimeout.Value;
        if (request.KeepAliveInterval is not null) settings.KeepAliveInterval = request.KeepAliveInterval.Value;
        if (request.AutoReconnect is not null) settings.AutoReconnect = request.AutoReconnect.Value;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("clear")]
    public async Task<IActionResult> ClearAllData()
    {
        _db.AiChatMessages.RemoveRange(_db.AiChatMessages);
        _db.AiChatSessions.RemoveRange(_db.AiChatSessions);
        _db.AiProviders.RemoveRange(_db.AiProviders);
        _db.SshConnections.RemoveRange(_db.SshConnections);
        _db.AppSettings.RemoveRange(_db.AppSettings);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public record UpdateSettingsRequest(
    string? Theme,
    string? Language,
    bool? AutoConnectLast,
    int? FontSize,
    string? FontFamily,
    string? CursorStyle,
    int? ScrollbackLines,
    int? DefaultPort,
    int? ConnectionTimeout,
    int? KeepAliveInterval,
    bool? AutoReconnect
);
