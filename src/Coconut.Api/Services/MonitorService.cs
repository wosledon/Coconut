using System.Text.Json;
using System.Text.Json.Serialization;
using Coconut.Api.Models;

namespace Coconut.Api.Services;

public class MonitorService
{
    private readonly SshService _sshService;
    private readonly ILogger<MonitorService> _logger;

    public MonitorService(SshService sshService, ILogger<MonitorService> logger)
    {
        _sshService = sshService;
        _logger = logger;
    }

    public async Task<ServerMetrics?> GetMetricsAsync(Guid connectionId)
    {
        try
        {
            var client = _sshService.GetClient(connectionId);
            if (client == null || !client.IsConnected) return null;

            var cpuTask = _sshService.ExecuteCommandAsync(connectionId,
                "top -bn1 | grep -E '^%Cpu|^CPU' | awk '{print $2}'");
            var memTask = _sshService.ExecuteCommandAsync(connectionId,
                "awk '/MemTotal/ {t=$2} /MemAvailable/ {a=$2} END {printf \"%d %d\", t/1024, (t-a)/1024}' /proc/meminfo");
            var diskTask = _sshService.ExecuteCommandAsync(connectionId,
                "df -h / | awk 'NR==2 {printf \"%s %s %s\", $2, $3, $5}'");
            var netTask = _sshService.ExecuteCommandAsync(connectionId,
                "awk 'NR>2 && $1 !~ /^lo/ {rx=$2; tx=$10} END {printf \"%d %d\", rx, tx}' /proc/net/dev");
            var uptimeTask = _sshService.ExecuteCommandAsync(connectionId, "uptime -p");
            var hostnameTask = _sshService.ExecuteCommandAsync(connectionId, "hostname");
            var kernelTask = _sshService.ExecuteCommandAsync(connectionId, "uname -r");

            await Task.WhenAll(cpuTask, memTask, diskTask, netTask, uptimeTask, hostnameTask, kernelTask);

            var memParts = memTask.Result.Trim().Split(' ');
            var diskParts = diskTask.Result.Trim().Split(' ');
            var netParts = netTask.Result.Trim().Split(' ');

            return new ServerMetrics
            {
                CpuUsage = double.TryParse(cpuTask.Result.Trim().Replace("%", ""), out var cpu) ? cpu : 0,
                TotalMemoryMB = int.TryParse(memParts.ElementAtOrDefault(0), out var total) ? total : 0,
                UsedMemoryMB = int.TryParse(memParts.ElementAtOrDefault(1), out var used) ? used : 0,
                DiskTotal = diskParts.ElementAtOrDefault(0)?.Trim() ?? "",
                DiskUsed = diskParts.ElementAtOrDefault(1)?.Trim() ?? "",
                DiskUsagePercent = diskParts.ElementAtOrDefault(2)?.Trim().Replace("%", "") ?? "0",
                NetworkRxBytes = long.TryParse(netParts.ElementAtOrDefault(0), out var rx) ? rx : 0,
                NetworkTxBytes = long.TryParse(netParts.ElementAtOrDefault(1), out var tx) ? tx : 0,
                Uptime = uptimeTask.Result.Trim(),
                Hostname = hostnameTask.Result.Trim(),
                Kernel = kernelTask.Result.Trim()
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to get metrics for connection {Id}", connectionId);
            return null;
        }
    }

    public async Task<List<ProcessInfo>> GetTopProcessesAsync(Guid connectionId, int count = 5)
    {
        try
        {
            var output = await _sshService.ExecuteCommandAsync(connectionId,
                $"ps aux --sort=-%cpu | head -{count + 1} | tail -{count}");

            return output.Split('\n', StringSplitOptions.RemoveEmptyEntries)
                .Select(line =>
                {
                    var parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                    return new ProcessInfo
                    {
                        User = parts.ElementAtOrDefault(0) ?? "",
                        Pid = int.TryParse(parts.ElementAtOrDefault(1), out var pid) ? pid : 0,
                        CpuPercent = double.TryParse(parts.ElementAtOrDefault(2), out var cpu) ? cpu : 0,
                        MemPercent = double.TryParse(parts.ElementAtOrDefault(3), out var mem) ? mem : 0,
                        Command = string.Join(' ', parts.Skip(10))
                    };
                }).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to get processes for {Id}", connectionId);
            return [];
        }
    }
}

public class ServerMetrics
{
    public double CpuUsage { get; set; }
    public int TotalMemoryMB { get; set; }
    public int UsedMemoryMB { get; set; }
    public string DiskTotal { get; set; } = "";
    public string DiskUsed { get; set; } = "";
    public string DiskUsagePercent { get; set; } = "0";
    public long NetworkRxBytes { get; set; }
    public long NetworkTxBytes { get; set; }
    public string Uptime { get; set; } = "";
    public string Hostname { get; set; } = "";
    public string Kernel { get; set; } = "";
}

public class ProcessInfo
{
    public string User { get; set; } = "";
    public int Pid { get; set; }
    public double CpuPercent { get; set; }
    public double MemPercent { get; set; }
    public string Command { get; set; } = "";
}
