import { Settings, Moon, Sun, Activity } from 'lucide-react'
import type { SshConnection, ServerMetrics } from '../types'

interface Props {
  activeConnection: SshConnection | null
  metrics: ServerMetrics | null
  onSettings: () => void
}

export function Header({ activeConnection, metrics, onSettings }: Props) {
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)}K`
    return `${(bytes / 1048576).toFixed(1)}M`
  }

  return (
    <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center px-5 gap-4 shrink-0">
      <div className="flex items-center gap-2 text-sm">
        {activeConnection ? (
          <>
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="text-gray-200 font-medium">{activeConnection.name}</span>
            <span className="text-xs text-gray-500">{activeConnection.userName}@{activeConnection.host}:{activeConnection.port}</span>
          </>
        ) : (
          <span className="text-gray-500">未选择服务器</span>
        )}
      </div>
      {metrics && (
        <div className="hidden md:flex items-center gap-3 text-[10px] text-gray-500">
          <span className="flex items-center gap-1">
            <Activity className="w-3 h-3 text-orange-400" />
            CPU <span className="text-orange-400 font-mono">{metrics.cpuUsage.toFixed(0)}%</span>
          </span>
          <span className="flex items-center gap-1">
            <Activity className="w-3 h-3 text-coconut-400" />
            MEM <span className="text-coconut-400 font-mono">{metrics.usedMemoryMB}/{metrics.totalMemoryMB}M</span>
          </span>
          <span className="flex items-center gap-1">
            <Activity className="w-3 h-3 text-blue-400" />
            DSK <span className="text-blue-400 font-mono">{metrics.diskUsed}/{metrics.diskTotal}</span>
          </span>
          <span className="flex items-center gap-1">
            <Activity className="w-3 h-3 text-gray-400" />
            NET <span className="text-gray-300 font-mono">↓{formatBytes(metrics.networkRxBytes)} ↑{formatBytes(metrics.networkTxBytes)}</span>
          </span>
        </div>
      )}
      <div className="ml-auto flex items-center gap-3">
        <button
          onClick={() => {
            const current = document.documentElement.getAttribute('data-theme')
            const next = current === 'light' ? 'dark' : 'light'
            document.documentElement.setAttribute('data-theme', next)
            localStorage.setItem('coconut-theme', next)
          }}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition px-2 py-1 rounded hover:bg-gray-800"
          title="切换主题"
        >
          <Moon className="w-4 h-4" />
        </button>
        <button
          onClick={onSettings}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition px-2 py-1 rounded hover:bg-gray-800"
        >
          <Settings className="w-4 h-4" />
          设置
        </button>
      </div>
    </header>
  )
}
