import { useEffect, useRef, useState, useCallback } from 'react'
import { HubConnectionBuilder, HubConnection, HubConnectionState } from '@microsoft/signalr'
import { ChevronUp, BarChart3, Cpu, HardDrive, Wifi, Activity } from 'lucide-react'
import type { ServerMetrics, ProcessInfo } from '../types'

interface Props {
  isOpen: boolean
  onToggle: () => void
  connectionId: string | null
}

export function MonitorPanel({ isOpen, onToggle, connectionId }: Props) {
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null)
  const [processes, setProcesses] = useState<ProcessInfo[]>([])
  const [cpuHistory, setCpuHistory] = useState<number[]>([])
  const hubRef = useRef<HubConnection | null>(null)

  useEffect(() => {
    if (!connectionId) {
      setMetrics(null)
      setProcesses([])
      setCpuHistory([])
      return
    }

    const hub = new HubConnectionBuilder()
      .withUrl('/hubs/monitor')
      .withAutomaticReconnect()
      .build()

    hub.on('MetricsUpdate', (_connId: string, data: ServerMetrics) => {
      setMetrics(data)
      setCpuHistory(prev => {
        const next = [...prev, data.cpuUsage]
        return next.length > 30 ? next.slice(-30) : next
      })
    })

    hub.on('ProcessUpdate', (_connId: string, data: ProcessInfo[]) => {
      setProcesses(data)
    })

    hub.on('MonitorError', (_connId: string, error: string) => {
      console.error('Monitor error:', error)
    })

    hub.onclose(() => {
      setMetrics(null)
      setProcesses([])
      setCpuHistory([])
    })

    // Restart monitoring after reconnection
    hub.onreconnected(async () => {
      try {
        await hub.invoke('StartMonitoring', connectionId, 2000)
      } catch (e) {
        console.error('Failed to restart monitoring after reconnect:', e)
      }
    })

    hub.start().then(async () => {
      try {
        await hub.invoke('StartMonitoring', connectionId, 2000)
      } catch (e) {
        console.error('Failed to start monitoring:', e)
      }
    }).catch(console.error)

    hubRef.current = hub
    return () => { hub.stop() }
  }, [connectionId])

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)}K`
    return `${(bytes / 1048576).toFixed(1)}M`
  }

  const memPercent = metrics ? Math.round((metrics.usedMemoryMB / metrics.totalMemoryMB) * 100) : 0
  const diskPercent = metrics ? parseInt(metrics.diskUsagePercent) || 0 : 0

  return (
    <div className="shrink-0 border-b border-gray-800">
      <div
        onClick={onToggle}
        className="bg-gray-900 px-4 h-8 flex items-center gap-2 cursor-pointer select-none hover:bg-gray-850 transition"
      >
        <ChevronUp className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isOpen ? '' : 'rotate-180'}`} />
        <BarChart3 className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-xs font-medium text-gray-400">资源监控</span>
        {!isOpen && metrics && (
          <span className="ml-2 flex items-center gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1">CPU <span className="text-orange-400 font-mono">{metrics.cpuUsage.toFixed(0)}%</span></span>
            <span className="flex items-center gap-1">MEM <span className="text-coconut-400 font-mono">{metrics.usedMemoryMB}/{metrics.totalMemoryMB}M</span></span>
            <span className="flex items-center gap-1">DSK <span className="text-blue-400 font-mono">{metrics.diskUsed}/{metrics.diskTotal}</span></span>
          </span>
        )}
      </div>
      <div className={`overflow-hidden transition-all duration-200 ${isOpen ? 'h-auto' : 'h-0'}`}>
        {!connectionId ? (
          <div className="flex items-center justify-center h-20 text-gray-600 text-xs">
            <span>连接服务器后查看实时资源监控</span>
          </div>
        ) : !metrics ? (
          <div className="flex items-center justify-center h-20 text-gray-600 text-xs">
            <span>正在采集监控数据...</span>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {/* Metric cards */}
            <div className="grid grid-cols-4 gap-3">
              <MetricCard label="CPU" value={`${metrics.cpuUsage.toFixed(0)}%`} percent={metrics.cpuUsage} color="bg-orange-500" />
              <MetricCard label="内存" value={`${metrics.usedMemoryMB}/${metrics.totalMemoryMB}M`} percent={memPercent} color="bg-coconut-500" />
              <MetricCard label="磁盘" value={`${metrics.diskUsed}/${metrics.diskTotal}`} percent={diskPercent} color="bg-blue-500" />
              <div className="bg-gray-900/80 rounded-lg p-3 border border-gray-800">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-gray-500 font-medium">网络</span>
                  <span className="text-sm font-bold text-gray-100">↓{formatBytes(metrics.networkRxBytes)}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  <span>↑{formatBytes(metrics.networkTxBytes)}</span>
                </div>
              </div>
            </div>
            {/* Charts + processes */}
            <div className="flex gap-3">
              <div className="flex-1 bg-gray-900/80 rounded-lg p-3 border border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-gray-400 font-medium">CPU 趋势</span>
                </div>
                <div className="h-16 flex items-end gap-[2px]">
                  {cpuHistory.map((val, i) => (
                    <div key={i} className="flex-1 bg-orange-500/60 rounded-t" style={{ height: `${Math.max(5, val)}%` }} />
                  ))}
                  {cpuHistory.length === 0 && Array.from({ length: 20 }).map((_, i) => (
                    <div key={i} className="flex-1 bg-gray-800 rounded-t" style={{ height: '10%' }} />
                  ))}
                </div>
              </div>
              <div className="flex-1 bg-gray-900/80 rounded-lg p-3 border border-gray-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-gray-400 font-medium">进程 Top5</span>
                </div>
                <div className="text-[10px] text-gray-400 font-mono space-y-0.5">
                  {processes.slice(0, 5).map((p, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="truncate max-w-[120px]">{p.command}</span>
                      <span>{p.cpuPercent.toFixed(1)}%</span>
                    </div>
                  ))}
                  {processes.length === 0 && <div className="text-gray-600">加载中...</div>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MetricCard({ label, value, percent, color }: { label: string; value: string; percent: number; color: string }) {
  return (
    <div className="bg-gray-900/80 rounded-lg p-3 border border-gray-800">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-gray-500 font-medium">{label}</span>
        <span className="text-sm font-bold text-gray-100">{value}</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full transition-all duration-500`} style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
    </div>
  )
}
