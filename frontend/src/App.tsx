import { useState, useEffect, useCallback, useRef } from 'react'
import type { Page, SettingsTab, BottomTab, SshConnection, AiProvider, AiChatSession, AppSettings, SftpFileInfo, ServerMetrics } from './types'
import { connectionsApi, providersApi, chatApi, sftpApi, settingsApi } from './services/api'
import { t } from './i18n'
import { HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { TerminalArea } from './components/TerminalArea'
import { BottomPanel } from './components/BottomPanel'
import { SettingsPage } from './components/SettingsPage'
import { ConnectionModal } from './components/ConnectionModal'

export default function App() {
  // Navigation
  const [page, setPage] = useState<Page>('workspace')
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general')

  // Data
  const [connections, setConnections] = useState<SshConnection[]>([])
  const [providers, setProviders] = useState<AiProvider[]>([])
  const [sessions, setSessions] = useState<AiChatSession[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)

  // Active state
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  // UI state
  const [bottomOpen, setBottomOpen] = useState(true)
  const [bottomTab, setBottomTab] = useState<BottomTab>('ai')
  const [bottomHeight, setBottomHeight] = useState(() => {
    const saved = localStorage.getItem('coconut-bottom-height')
    return saved ? parseInt(saved) || 280 : 280
  })
  const bottomHeightRef = useRef(bottomHeight)
  useEffect(() => { bottomHeightRef.current = bottomHeight }, [bottomHeight])
  const [showConnectionModal, setShowConnectionModal] = useState(false)
  const [editingConnection, setEditingConnection] = useState<SshConnection | null>(null)
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null)
  const metricsHubRef = useRef<HubConnection | null>(null)

  // SFTP state
  const [sftpPath, setSftpPath] = useState('/')
  const [sftpFiles, setSftpFiles] = useState<SftpFileInfo[]>([])

  const activeConnection = connections.find(c => c.id === activeConnectionId) || null

  // Load initial data
  useEffect(() => {
    connectionsApi.getAll().then(setConnections).catch(console.error)
    providersApi.getAll().then(setProviders).catch(console.error)
    chatApi.getSessions().then(setSessions).catch(console.error)
    settingsApi.get().then(setSettings).catch(console.error)
  }, [])

  // Connection handlers
  const handleSelectConnection = useCallback(async (id: string) => {
    setActiveConnectionId(id)
    setSftpPath('/')
    setSftpFiles([])
    try {
      const files = await sftpApi.list(id, '/')
      setSftpFiles(files)
    } catch { }
  }, [])

  const handleSaveConnection = useCallback(async (data: any) => {
    if (editingConnection) {
      await connectionsApi.update(editingConnection.id, data)
    } else {
      await connectionsApi.create(data)
    }
    const updated = await connectionsApi.getAll()
    setConnections(updated)
    setShowConnectionModal(false)
    setEditingConnection(null)
  }, [editingConnection])

  const handleDeleteConnection = useCallback(async (id: string) => {
    await connectionsApi.delete(id)
    setConnections(prev => prev.filter(c => c.id !== id))
    if (activeConnectionId === id) setActiveConnectionId(null)
  }, [activeConnectionId])

  // SFTP handlers
  const handleSftpNavigate = useCallback(async (path: string) => {
    if (!activeConnectionId) return
    setSftpPath(path)
    try {
      const files = await sftpApi.list(activeConnectionId, path)
      setSftpFiles(files)
    } catch { }
  }, [activeConnectionId])

  const handleSftpRefresh = useCallback(async () => {
    if (!activeConnectionId) return
    try {
      const files = await sftpApi.list(activeConnectionId, sftpPath)
      setSftpFiles(files)
    } catch { }
  }, [activeConnectionId, sftpPath])

  // Settings handler
  const handleUpdateSettings = useCallback(async (data: Partial<AppSettings>) => {
    await settingsApi.update(data)
    setSettings(prev => prev ? { ...prev, ...data } : null)
  }, [])

  // Monitor metrics hub
  useEffect(() => {
    if (!activeConnectionId) {
      setMetrics(null)
      return
    }

    const hub = new HubConnectionBuilder()
      .withUrl('/hubs/monitor')
      .withAutomaticReconnect()
      .build()

    hub.on('MetricsUpdate', (_connId: string, data: ServerMetrics) => {
      setMetrics(data)
    })

    hub.on('MonitorError', (_connId: string, error: string) => {
      console.error('Monitor error:', error)
    })

    hub.onclose(() => {
      setMetrics(null)
    })

    hub.onreconnected(async () => {
      try {
        await hub.invoke('StartMonitoring', activeConnectionId, 2000)
      } catch (e) {
        console.error('Failed to restart monitoring after reconnect:', e)
      }
    })

    hub.start().then(async () => {
      try {
        await hub.invoke('StartMonitoring', activeConnectionId, 2000)
      } catch (e) {
        console.error('Failed to start monitoring:', e)
      }
    }).catch(console.error)

    metricsHubRef.current = hub
    return () => { hub.stop() }
  }, [activeConnectionId])

  return (
    <div className="bg-gray-950 text-gray-100 h-screen overflow-hidden flex font-sans">
      <Sidebar
        connections={connections}
        activeConnectionId={activeConnectionId}
        onSelect={handleSelectConnection}
        onNew={() => { setEditingConnection(null); setShowConnectionModal(true) }}
        onEdit={(c) => { setEditingConnection(c); setShowConnectionModal(true) }}
        onDelete={handleDeleteConnection}
        onSettings={() => setPage('settings')}
      />

      <main className="flex-1 flex flex-col min-w-0">
        <Header
          activeConnection={activeConnection}
          metrics={metrics}
          onSettings={() => { setSettingsTab('general'); setPage('settings') }}
        />

        <div className="flex-1 flex flex-col min-h-0">
          {page === 'workspace' ? (
            <>
              <TerminalArea connectionId={activeConnectionId} />

              <div
                className="h-1.5 bg-gray-900 border-t border-b border-gray-800 cursor-row-resize hover:bg-coconut-600/30 hover:border-coconut-500/50 transition-colors shrink-0 relative group"
                onMouseDown={(e) => {
                  e.preventDefault()
                  const startY = e.clientY
                  const startHeight = bottomHeight
                  const onMove = (ev: MouseEvent) => {
                    const delta = startY - ev.clientY
                    setBottomHeight(Math.max(120, Math.min(startHeight + delta, window.innerHeight * 0.7)))
                  }
                  const onUp = () => {
                    document.removeEventListener('mousemove', onMove)
                    document.removeEventListener('mouseup', onUp)
                    document.body.style.cursor = ''
                    document.body.style.userSelect = ''
                    // Use ref to get the latest height value
                    localStorage.setItem('coconut-bottom-height', String(bottomHeightRef.current))
                  }
                  document.body.style.cursor = 'row-resize'
                  document.body.style.userSelect = 'none'
                  document.addEventListener('mousemove', onMove)
                  document.addEventListener('mouseup', onUp)
                }}
              >
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="w-4 h-0.5 rounded bg-gray-500"></span>
                </div>
              </div>

              <BottomPanel
                isOpen={bottomOpen}
                onToggle={() => setBottomOpen(!bottomOpen)}
                activeTab={bottomTab}
                onSwitchTab={setBottomTab}
                height={bottomHeight}
                connectionId={activeConnectionId}
                providers={providers}
                sessions={sessions}
                onSessionsChange={setSessions}
                sftpPath={sftpPath}
                sftpFiles={sftpFiles}
                onSftpNavigate={handleSftpNavigate}
                onSftpRefresh={handleSftpRefresh}
                activeSessionId={activeSessionId}
                onActiveSessionChange={setActiveSessionId}
              />
            </>
          ) : (
            <SettingsPage
              activeTab={settingsTab}
              onSwitchTab={setSettingsTab}
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              providers={providers}
              onProvidersChange={setProviders}
              onBack={() => setPage('workspace')}
            />
          )}
        </div>
      </main>

      {showConnectionModal && (
        <ConnectionModal
          connection={editingConnection}
          onSave={handleSaveConnection}
          onClose={() => { setShowConnectionModal(false); setEditingConnection(null) }}
        />
      )}
    </div>
  )
}
