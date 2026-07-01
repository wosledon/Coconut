using Renci.SshNet;
using Coconut.Api.Models;

namespace Coconut.Api.Services;

public class SftpService
{
    private readonly SshService _sshService;
    private readonly ILogger<SftpService> _logger;

    public SftpService(SshService sshService, ILogger<SftpService> logger)
    {
        _sshService = sshService;
        _logger = logger;
    }

    public List<SftpFileInfo> ListDirectory(Guid connectionId, string path)
    {
        var client = _sshService.GetClient(connectionId)
            ?? throw new InvalidOperationException("Not connected");

        using var sftp = new SftpClient(client.ConnectionInfo);
        sftp.Connect();

        var entries = new List<SftpFileInfo>();
        foreach (var entry in sftp.ListDirectory(path))
        {
            if (entry.Name is "." or "..") continue;
            entries.Add(new SftpFileInfo
            {
                Name = entry.Name,
                Path = entry.FullName,
                IsDirectory = entry.IsDirectory,
                Size = entry.Length,
                LastModified = entry.LastWriteTimeUtc,
                Permissions = entry.Attributes?.ToString()
            });
        }

        sftp.Disconnect();
        return entries;
    }

    public void UploadFile(Guid connectionId, string remotePath, Stream fileStream)
    {
        var client = _sshService.GetClient(connectionId)
            ?? throw new InvalidOperationException("Not connected");

        using var sftp = new SftpClient(client.ConnectionInfo);
        sftp.Connect();
        sftp.UploadFile(fileStream, remotePath, true);
        sftp.Disconnect();
    }

    public MemoryStream DownloadFile(Guid connectionId, string remotePath)
    {
        var client = _sshService.GetClient(connectionId)
            ?? throw new InvalidOperationException("Not connected");

        using var sftp = new SftpClient(client.ConnectionInfo);
        sftp.Connect();
        var ms = new MemoryStream();
        sftp.DownloadFile(remotePath, ms);
        ms.Position = 0;
        sftp.Disconnect();
        return ms;
    }

    public void DeleteFile(Guid connectionId, string path)
    {
        var client = _sshService.GetClient(connectionId)
            ?? throw new InvalidOperationException("Not connected");

        using var sftp = new SftpClient(client.ConnectionInfo);
        sftp.Connect();
        sftp.Delete(path);
        sftp.Disconnect();
    }

    public void RenameFile(Guid connectionId, string oldPath, string newPath)
    {
        var client = _sshService.GetClient(connectionId)
            ?? throw new InvalidOperationException("Not connected");

        using var sftp = new SftpClient(client.ConnectionInfo);
        sftp.Connect();
        sftp.RenameFile(oldPath, newPath);
        sftp.Disconnect();
    }

    public void CreateDirectory(Guid connectionId, string path)
    {
        var client = _sshService.GetClient(connectionId)
            ?? throw new InvalidOperationException("Not connected");

        using var sftp = new SftpClient(client.ConnectionInfo);
        sftp.Connect();
        sftp.CreateDirectory(path);
        sftp.Disconnect();
    }
}

public class SftpFileInfo
{
    public string Name { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public bool IsDirectory { get; set; }
    public long Size { get; set; }
    public DateTime LastModified { get; set; }
    public string? Permissions { get; set; }
}
