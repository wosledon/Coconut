using System.Text;
using Microsoft.AspNetCore.SignalR;
using Coconut.Api.Data;
using Coconut.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Coconut.Api.Hubs;

public class TerminalHub : Hub
{
    private readonly Services.SshService _sshService;
    private readonly CoconutDbContext _db;
    private readonly Services.EncryptionService _encryption;
    private readonly ILogger<TerminalHub> _logger;

    public TerminalHub(Services.SshService sshService, CoconutDbContext db,
        Services.EncryptionService encryption, ILogger<TerminalHub> logger)
    {
        _sshService = sshService;
        _db = db;
        _encryption = encryption;
        _logger = logger;
    }

    public async Task Connect(Guid connectionId)
    {
        var conn = await _db.SshConnections.FindAsync(connectionId)
            ?? throw new HubException("Connection not found");

        string? password = null;
        try
        {
            password = !string.IsNullOrEmpty(conn.EncryptedPassword)
                ? _encryption.Decrypt(conn.EncryptedPassword)
                : null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to decrypt password for {Host}, continuing without it", conn.Host);
        }

        try
        {
            await _sshService.ConnectAsync(conn, password);
            await Clients.Caller.SendAsync("Connected", connectionId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SSH connect failed for {Host}", conn.Host);
            throw new HubException($"连接失败: {ex.Message}");
        }
    }

    public async Task<string> OpenShell(Guid connectionId, string sessionId, int cols, int rows)
    {
        try
        {
            var wrapper = _sshService.CreateShell(connectionId, sessionId, cols, rows);
            var groupName = $"shell-{sessionId}";

            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
            var capturedClients = Clients;

            // Start reading from the shell using synchronous Read on a dedicated thread.
            // This avoids ShellStream concurrency issues with async I/O.
            _ = Task.Run(() =>
            {
                var buffer = new byte[4096];
                try
                {
                    while (!wrapper.IsDisposed && wrapper.Stream.CanRead)
                    {
                        if (wrapper.IsDisposed || !wrapper.Stream.CanRead) break;
                        int bytesRead = wrapper.Stream.Read(buffer, 0, buffer.Length);
                        if (bytesRead > 0)
                        {
                            var text = Encoding.UTF8.GetString(buffer, 0, bytesRead);
                            capturedClients.Group(groupName).SendAsync("TerminalOutput", sessionId, text).GetAwaiter().GetResult();
                        }
                        else
                        {
                            Thread.Sleep(10);
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "Shell read ended for {SessionId}", sessionId);
                }
            });

            return sessionId;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to open shell for {SessionId}", sessionId);
            throw new HubException($"Failed to open shell: {ex.Message}");
        }
    }

    /// <summary>
    /// Called by the client after reconnection to rejoin the shell's SignalR group,
    /// so the background reading task can continue sending output to the reconnected client.
    /// </summary>
    public async Task RejoinShell(string sessionId)
    {
        var groupName = $"shell-{sessionId}";
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
    }

    public Task SendInput(Guid connectionId, string sessionId, string input)
    {
        try
        {
            var wrapper = _sshService.GetShell(connectionId, sessionId);
            if (wrapper != null && !wrapper.IsDisposed)
            {
                lock (wrapper.Lock)
                {
                    if (wrapper.IsDisposed) return Task.CompletedTask;
                    var bytes = Encoding.UTF8.GetBytes(input);
                    wrapper.Stream.Write(bytes, 0, bytes.Length);
                    wrapper.Stream.Flush();
                }
            }
        }
        catch (ObjectDisposedException)
        {
            _logger.LogDebug("Shell already disposed for {SessionId}", sessionId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send input to {SessionId}", sessionId);
        }
        return Task.CompletedTask;
    }

    public Task ResizeTerminal(Guid connectionId, string sessionId, int cols, int rows)
    {
        _sshService.ResizeShell(connectionId, sessionId, cols, rows);
        return Task.CompletedTask;
    }

    public Task CloseShell(Guid connectionId, string sessionId)
    {
        _sshService.CloseShell(connectionId, sessionId);
        return Task.CompletedTask;
    }

    public Task Disconnect(Guid connectionId)
    {
        _sshService.Disconnect(connectionId);
        return Task.CompletedTask;
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        // Don't auto-disconnect SSH sessions on SignalR disconnect
        return base.OnDisconnectedAsync(exception);
    }
}
