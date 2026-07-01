using System.Collections.Concurrent;
using System.Text;
using Renci.SshNet;
using Renci.SshNet.Common;
using Coconut.Api.Models;

namespace Coconut.Api.Services;

public class ShellStreamWrapper : IDisposable
{
    public ShellStream Stream { get; }
    public object Lock { get; } = new();
    private bool _disposed;

    public ShellStreamWrapper(ShellStream stream)
    {
        Stream = stream;
    }

    public bool IsDisposed => _disposed;

    public void Dispose()
    {
        lock (Lock)
        {
            if (_disposed) return;
            _disposed = true;
            try { Stream.Dispose(); } catch { }
        }
    }
}

public class SshConnectionInfo
{
    public Guid ConnectionId { get; set; }
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; }
    public string UserName { get; set; } = string.Empty;
    public SshClient Client { get; set; } = null!;
    public ConcurrentDictionary<string, ShellStreamWrapper> Sessions { get; set; } = new();
}

public class SshService : IDisposable
{
    private readonly ConcurrentDictionary<Guid, SshConnectionInfo> _connections = new();
    private readonly EncryptionService _encryption;
    private readonly ILogger<SshService> _logger;

    public SshService(EncryptionService encryption, ILogger<SshService> logger)
    {
        _encryption = encryption;
        _logger = logger;
    }

    public async Task<(bool Success, string? Error)> TestConnectionAsync(SshConnection conn, string? password)
    {
        try
        {
            var client = CreateClient(conn, password);
            await Task.Run(() => client.Connect());
            client.Disconnect();
            client.Dispose();
            return (true, null);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Connection test failed for {Host}", conn.Host);
            return (false, ex.Message);
        }
    }

    public async Task ConnectAsync(SshConnection conn, string? decryptedPassword)
    {
        // If we already have a connection, verify it's still alive
        if (_connections.TryGetValue(conn.Id, out var existing))
        {
            if (existing.Client.IsConnected)
                return;

            // Connection is dead, clean it up
            _logger.LogInformation("SSH connection to {Host} is dead, reconnecting", conn.Host);
            Disconnect(conn.Id);
        }

        var client = CreateClient(conn, decryptedPassword);
        await Task.Run(() => client.Connect());

        _connections[conn.Id] = new SshConnectionInfo
        {
            ConnectionId = conn.Id,
            Host = conn.Host,
            Port = conn.Port,
            UserName = conn.UserName,
            Client = client
        };
    }

    public ShellStreamWrapper CreateShell(Guid connectionId, string sessionId, int cols = 80, int rows = 24)
    {
        if (!_connections.TryGetValue(connectionId, out var info))
            throw new InvalidOperationException("Not connected");

        // If a shell already exists for this sessionId, close it first
        if (info.Sessions.TryRemove(sessionId, out var existingWrapper))
        {
            existingWrapper.Dispose();
        }

        var shell = info.Client.CreateShellStream("xterm-256color", (uint)cols, (uint)rows, 640, 480, 65536);
        var wrapper = new ShellStreamWrapper(shell);
        info.Sessions[sessionId] = wrapper;
        _logger.LogInformation("Created shell for session {SessionId} on {ConnectionId}", sessionId, connectionId);
        return wrapper;
    }

    public ShellStreamWrapper? GetShell(Guid connectionId, string sessionId)
    {
        if (_connections.TryGetValue(connectionId, out var info) &&
            info.Sessions.TryGetValue(sessionId, out var wrapper) &&
            !wrapper.IsDisposed)
        {
            return wrapper;
        }
        return null;
    }

    public void CloseShell(Guid connectionId, string sessionId)
    {
        if (_connections.TryGetValue(connectionId, out var info) &&
            info.Sessions.TryRemove(sessionId, out var wrapper))
        {
            _logger.LogInformation("Closing shell for session {SessionId}", sessionId);
            wrapper.Dispose();
        }
    }

    public void ResizeShell(Guid connectionId, string sessionId, int cols, int rows)
    {
        if (_connections.TryGetValue(connectionId, out var info) &&
            info.Sessions.TryGetValue(sessionId, out var wrapper) &&
            !wrapper.IsDisposed)
        {
            // ShellStream in SSH.NET does not directly expose window change.
            // A proper implementation would send an SSH_MSG_CHANNEL_REQUEST for
            // "window-change" on the underlying channel, but SSH.NET does not
            // expose this API directly.
        }
    }

    public bool IsConnected(Guid connectionId)
    {
        return _connections.TryGetValue(connectionId, out var info) && info.Client.IsConnected;
    }

    public void Disconnect(Guid connectionId)
    {
        if (_connections.TryRemove(connectionId, out var info))
        {
            foreach (var wrapper in info.Sessions.Values)
                wrapper.Dispose();
            try { info.Client.Disconnect(); } catch { }
            try { info.Client.Dispose(); } catch { }
        }
    }

    public async Task<string> ExecuteCommandAsync(Guid connectionId, string command)
    {
        if (!_connections.TryGetValue(connectionId, out var info))
            throw new InvalidOperationException("Not connected");

        return await Task.Run(() =>
        {
            using var cmd = info.Client.RunCommand(command);
            return cmd.Result;
        });
    }

    public SshClient? GetClient(Guid connectionId)
    {
        _connections.TryGetValue(connectionId, out var info);
        return info?.Client;
    }

    public void DisconnectAll()
    {
        foreach (var key in _connections.Keys)
            Disconnect(key);
    }

    private static readonly string SshDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".ssh");

    private static readonly string[] DefaultKeyFiles = [
        "id_ed25519", "id_rsa", "id_ecdsa", "id_dsa"
    ];

    private SshClient CreateClient(SshConnection conn, string? password)
    {
        var authMethods = new List<AuthenticationMethod>();

        // Key-based auth
        if (conn.AuthType == AuthType.Key)
        {
            var keyPath = !string.IsNullOrEmpty(conn.KeyFilePath)
                ? conn.KeyFilePath
                : DefaultKeyFiles.Select(f => Path.Combine(SshDir, f))
                    .FirstOrDefault(File.Exists);

            if (!string.IsNullOrEmpty(keyPath) && File.Exists(keyPath))
            {
                authMethods.Add(new PrivateKeyAuthenticationMethod(conn.UserName, new PrivateKeyFile(keyPath, password)));
            }
        }

        // Password auth (when password is provided)
        if (!string.IsNullOrEmpty(password))
        {
            authMethods.Add(new PasswordAuthenticationMethod(conn.UserName, password));
        }

        // None auth as last resort
        if (authMethods.Count == 0)
        {
            authMethods.Add(new NoneAuthenticationMethod(conn.UserName));
        }

        var ci = new Renci.SshNet.ConnectionInfo(conn.Host, conn.Port, conn.UserName, authMethods.ToArray())
        {
            Timeout = TimeSpan.FromSeconds(30)
        };

        return new SshClient(ci);
    }

    public void Dispose()
    {
        DisconnectAll();
    }

    public static SshConfigEntry? LookupSshConfig(string host)
    {
        var configPath = Path.Combine(SshDir, "config");
        if (!File.Exists(configPath)) return null;

        SshConfigEntry? matched = null;
        SshConfigEntry? current = null;

        foreach (var rawLine in File.ReadAllLines(configPath))
        {
            var line = rawLine.Trim();
            if (string.IsNullOrEmpty(line) || line.StartsWith('#')) continue;

            var parts = line.Split([' ', '\t'], 2, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length < 2) continue;

            var key = parts[0].ToLowerInvariant();
            var value = parts[1].Trim('"').Trim('\'');

            if (key == "host")
            {
                // Save previous block if it matched
                if (current != null && matched == null && current.IsMatch)
                    matched = current;

                current = new SshConfigEntry { IsMatch = false };
                // Check if any pattern in the Host line matches
                foreach (var pattern in value.Split([' ', '\t'], StringSplitOptions.RemoveEmptyEntries))
                {
                    if (pattern.Equals(host, StringComparison.OrdinalIgnoreCase) ||
                        pattern == "*")
                    {
                        current.IsMatch = true;
                        break;
                    }
                }
                continue;
            }

            if (current == null || !current.IsMatch) continue;

            switch (key)
            {
                case "hostname": current.HostName = value; break;
                case "user": current.User = value; break;
                case "port": if (int.TryParse(value, out var p)) current.Port = p; break;
                case "identityfile": current.IdentityFile = value.Replace("~", SshDir); break;
            }
        }

        // Handle last block
        if (current != null && matched == null && current.IsMatch)
            matched = current;

        return matched;
    }
}

public class SshConfigEntry
{
    public bool IsMatch { get; set; }
    public string? HostName { get; set; }
    public string? User { get; set; }
    public int? Port { get; set; }
    public string? IdentityFile { get; set; }
}
