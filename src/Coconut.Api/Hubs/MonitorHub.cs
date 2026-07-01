using Microsoft.AspNetCore.SignalR;

namespace Coconut.Api.Hubs;

public class MonitorHub : Hub
{
    private readonly Services.MonitorService _monitorService;
    private readonly Services.SshService _sshService;
    private readonly ILogger<MonitorHub> _logger;

    public MonitorHub(Services.MonitorService monitorService, Services.SshService sshService,
        ILogger<MonitorHub> logger)
    {
        _monitorService = monitorService;
        _sshService = sshService;
        _logger = logger;
    }

    public async Task StartMonitoring(Guid connectionId, int intervalMs = 2000)
    {
        // Capture Clients reference before Task.Run to ensure it stays valid
        // after the hub method returns and the hub instance is returned to the pool
        var callerClients = Clients;
        var callerId = Context.ConnectionId;

        _ = Task.Run(async () =>
        {
            // Wait for SSH connection to be ready (up to 15s)
            for (var i = 0; i < 30; i++)
            {
                if (_sshService.IsConnected(connectionId)) break;
                await Task.Delay(500);
            }

            if (!_sshService.IsConnected(connectionId))
            {
                await callerClients.Client(callerId).SendAsync("MonitorError", connectionId, "SSH 连接未就绪");
                return;
            }

            while (_sshService.IsConnected(connectionId))
            {
                try
                {
                    var metrics = await _monitorService.GetMetricsAsync(connectionId);
                    if (metrics != null)
                    {
                        await callerClients.Client(callerId).SendAsync("MetricsUpdate", connectionId, metrics);
                    }

                    var processes = await _monitorService.GetTopProcessesAsync(connectionId);
                    if (processes.Count > 0)
                    {
                        await callerClients.Client(callerId).SendAsync("ProcessUpdate", connectionId, processes);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "Monitor tick failed for {Id}", connectionId);
                }

                await Task.Delay(intervalMs);
            }
        });
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        return base.OnDisconnectedAsync(exception);
    }
}
