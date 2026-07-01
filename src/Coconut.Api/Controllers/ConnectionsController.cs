using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Coconut.Api.Data;
using Coconut.Api.Models;
using Coconut.Api.Services;

namespace Coconut.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ConnectionsController : ControllerBase
{
    private readonly CoconutDbContext _db;
    private readonly EncryptionService _encryption;
    private readonly SshService _sshService;

    public ConnectionsController(CoconutDbContext db, EncryptionService encryption, SshService sshService)
    {
        _db = db;
        _encryption = encryption;
        _sshService = sshService;
    }

    [HttpGet]
    public async Task<ActionResult<List<SshConnection>>> GetAll()
    {
        return await _db.SshConnections.OrderBy(c => c.SortOrder).ToListAsync();
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SshConnection>> Get(Guid id)
    {
        var conn = await _db.SshConnections.FindAsync(id);
        return conn is null ? NotFound() : conn;
    }

    [HttpPost]
    public async Task<ActionResult<SshConnection>> Create([FromBody] CreateConnectionRequest request)
    {
        var conn = new SshConnection
        {
            Name = request.Name,
            Host = request.Host,
            Port = request.Port,
            UserName = request.UserName,
            AuthType = request.AuthType,
            GroupName = request.GroupName,
            Tags = request.Tags,
            SortOrder = await _db.SshConnections.CountAsync()
        };

        if (!string.IsNullOrEmpty(request.Password))
            conn.EncryptedPassword = _encryption.Encrypt(request.Password);

        _db.SshConnections.Add(conn);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = conn.Id }, conn);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateConnectionRequest request)
    {
        var conn = await _db.SshConnections.FindAsync(id);
        if (conn is null) return NotFound();

        conn.Name = request.Name ?? conn.Name;
        conn.Host = request.Host ?? conn.Host;
        conn.Port = request.Port ?? conn.Port;
        conn.UserName = request.UserName ?? conn.UserName;
        conn.AuthType = request.AuthType ?? conn.AuthType;
        conn.GroupName = request.GroupName ?? conn.GroupName;
        conn.Tags = request.Tags ?? conn.Tags;
        conn.UpdatedAt = DateTime.UtcNow;

        if (request.Password is not null)
            conn.EncryptedPassword = _encryption.Encrypt(request.Password);

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var conn = await _db.SshConnections.FindAsync(id);
        if (conn is null) return NotFound();

        _sshService.Disconnect(id);
        _db.SshConnections.Remove(conn);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:guid}/test")]
    public async Task<ActionResult<object>> TestConnection(Guid id, [FromBody] TestConnectionRequest? request)
    {
        var conn = await _db.SshConnections.FindAsync(id);
        if (conn is null) return NotFound();

        var password = request?.Password
            ?? (!string.IsNullOrEmpty(conn.EncryptedPassword) ? _encryption.Decrypt(conn.EncryptedPassword) : null);

        var (ok, error) = await _sshService.TestConnectionAsync(conn, password);
        return new { success = ok, error };
    }

    [HttpPost("test")]
    public async Task<ActionResult<object>> TestConnectionInline([FromBody] TestConnectionInlineRequest request)
    {
        var conn = new SshConnection
        {
            Host = request.Host,
            Port = request.Port,
            UserName = request.UserName,
            AuthType = request.AuthType,
            KeyFilePath = request.KeyFilePath
        };

        var (ok, error) = await _sshService.TestConnectionAsync(conn, request.Password);
        return new { success = ok, error };
    }

    [HttpGet("ssh-config")]
    public ActionResult<object> LookupSshConfig([FromQuery] string host)
    {
        var entry = SshService.LookupSshConfig(host);
        if (entry is null) return NotFound();
        return new
        {
            hostName = entry.HostName,
            user = entry.User,
            port = entry.Port,
            identityFile = entry.IdentityFile
        };
    }
}

public record CreateConnectionRequest(string Name, string Host, int Port, string UserName,
    AuthType AuthType, string? Password, string? GroupName, string? Tags);

public record UpdateConnectionRequest(string? Name, string? Host, int? Port, string? UserName,
    AuthType? AuthType, string? Password, string? GroupName, string? Tags);

public record TestConnectionRequest(string? Password);

public record TestConnectionInlineRequest(string Host, int Port, string UserName,
    AuthType AuthType, string? Password, string? KeyFilePath);
