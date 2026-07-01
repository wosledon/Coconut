import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { HubConnectionBuilder, HubConnection, HubConnectionState } from '@microsoft/signalr'
import { Plus, X, Terminal as TerminalIcon, Sparkles } from 'lucide-react'
import '@xterm/xterm/css/xterm.css'

interface Props {
  connectionId: string | null
}

interface TermSession {
  id: string
  name: string
  terminal: Terminal
  fitAddon: FitAddon
}

export function TerminalArea({ connectionId }: Props) {
  const [sessions, setSessions] = useState<TermSession[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [counter, setCounter] = useState(0)
  const [selectedText, setSelectedText] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hubRef = useRef<HubConnection | null>(null)
  const connectionIdRef = useRef(connectionId)
  const activeIdRef = useRef<string | null>(null)
  const terminalsRef = useRef<Map<string, Terminal>>(new Map())
  const initializedRef = useRef(false)

  const log = (...args: any[]) => {
    console.log(...args)
    const arr = ((window as any).__debugLogs = (window as any).__debugLogs || [])
    arr.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '))
    if (arr.length > 200) arr.shift()
  }

  // Keep refs in sync
  useEffect(() => { connectionIdRef.current = connectionId }, [connectionId])
  useEffect(() => { activeIdRef.current = activeId }, [activeId])

  // Initialize SignalR connection
  useEffect(() => {
    const hub = new HubConnectionBuilder()
      .withUrl('/hubs/terminal')
      .withAutomaticReconnect()
      .build()

    hub.on('TerminalOutput', (sessionId: string, data: string) => {
      log('[SignalR] TerminalOutput for', sessionId, 'len', data.length, 'data:', JSON.stringify(data))
      const term = terminalsRef.current.get(sessionId)
      if (term) {
        term.write(data)
      }
    })

    // Re-establish SSH connection and rejoin shell groups after reconnection
    hub.onreconnected(async () => {
      const cid = connectionIdRef.current
      if (!cid) return
      try {
        await hub.invoke('Connect', cid)
        for (const sid of terminalsRef.current.keys()) {
          hub.invoke('RejoinShell', sid).catch(() => {})
        }
      } catch (e) {
        console.error('Failed to re-establish terminal after reconnect:', e)
      }
    })

    hub.start().then(() => {
      log('[SignalR] terminal hub connected, state:', hub.state)
      ;(window as any).__hubState = hub.state
    }).catch(err => {
      log('[SignalR] terminal hub start failed:', err)
      ;(window as any).__hubState = 'failed: ' + String(err)
    })
    hubRef.current = hub
    ;(window as any).__hub = hub

    // Listen for "send to terminal" events from AI Chat
    const handleSendToTerminal = (e: Event) => {
      const data = (e as CustomEvent).detail as string
      const aid = activeIdRef.current
      const cid = connectionIdRef.current
      if (aid && cid && hubRef.current?.state === HubConnectionState.Connected) {
        hubRef.current.invoke('SendInput', cid, aid, data).catch(console.error)
      }
    }
    window.addEventListener('coconut:sendToTerminal', handleSendToTerminal)

    // Listen for terminal selection to show AI explain button
    const handleSelection = (e: Event) => {
      setSelectedText((e as CustomEvent).detail as string)
    }
    window.addEventListener('coconut:terminalSelection', handleSelection)

    return () => {
      hub.stop()
      window.removeEventListener('coconut:sendToTerminal', handleSendToTerminal)
      window.removeEventListener('coconut:terminalSelection', handleSelection)
    }
  }, [])

  const createSession = useCallback(async () => {
    if (!connectionId || !hubRef.current) return

    const id = `term-${counter + 1}`
    setCounter(c => c + 1)

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', monospace",
      theme: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc',
        selectionBackground: '#585b7066',
        black: '#45475a',
        red: '#f38ba8',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        blue: '#89b4fa',
        magenta: '#f5c2e7',
        cyan: '#94e2d5',
        white: '#bac2de',
      },
    })
    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(new WebLinksAddon())

    const session: TermSession = { id, name: `#${sessions.length + 1}`, terminal, fitAddon }
    terminalsRef.current.set(id, terminal)
    setSessions(prev => [...prev, session])
    setActiveId(id)

    // Connect shell after DOM renders and hub is ready
    setTimeout(async () => {
      const el = document.getElementById(`term-${id}`)
      if (!el) return
      terminal.open(el)
      fitAddon.fit()
      terminal.focus()

      // Register input handler immediately after open so keystrokes are captured
      terminal.onData(data => {
        const cid = connectionIdRef.current
        log('[xterm] onData for', id, 'cid', cid, 'data', JSON.stringify(data), 'hubState', hubRef.current?.state)
        if (cid && hubRef.current?.state === HubConnectionState.Connected) {
          hubRef.current.invoke('SendInput', cid, id, data).then(() => log('[SignalR] SendInput ok')).catch(err =>
            log('SendInput failed:', err)
          )
        }
      })

      terminal.onResize(({ cols, rows }) => {
        const cid = connectionIdRef.current
        if (cid && hubRef.current?.state === HubConnectionState.Connected) {
          hubRef.current.invoke('ResizeTerminal', cid, id, cols, rows)
        }
      })

      // Emit selected text for AI explanation
      terminal.onSelectionChange(() => {
        const selected = terminal.getSelection()
        if (selected && selected.trim().length > 0) {
          window.dispatchEvent(new CustomEvent('coconut:terminalSelection', { detail: selected.trim() }))
        }
      })

      // Wait for hub to be connected (max 10s)
      for (let i = 0; i < 20; i++) {
        if (hubRef.current?.state === HubConnectionState.Connected) break
        await new Promise(r => setTimeout(r, 500))
      }

      if (hubRef.current?.state !== HubConnectionState.Connected) {
        terminal.writeln('\r\n\x1b[31m连接 SignalR Hub 超时\x1b[0m')
        return
      }

      try {
        const cid = connectionIdRef.current!
        log('[SignalR] invoking Connect', cid)
        await hubRef.current.invoke('Connect', cid)
        log('[SignalR] Connect ok, invoking OpenShell', id, terminal.cols, terminal.rows)
        await hubRef.current.invoke('OpenShell', cid, id, terminal.cols, terminal.rows)
        log('[SignalR] OpenShell ok')
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        log('[SignalR] Connect/OpenShell failed:', msg)
        terminal.writeln(`\r\n\x1b[31mSSH 连接失败: ${msg}\x1b[0m`)
      }
    }, 0)
  }, [connectionId, counter, sessions.length])

  // Auto-create first session when connected
  useEffect(() => {
    if (connectionId && !initializedRef.current) {
      initializedRef.current = true
      createSession()
    }
    return () => { initializedRef.current = false }
  }, [connectionId])

  // Fit on resize
  useEffect(() => {
    const handle = () => {
      const active = sessions.find(s => s.id === activeId)
      if (active) active.fitAddon.fit()
    }
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [activeId, sessions])

  // Fit when the terminal container itself resizes (for example when dragging the bottom panel)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      const active = terminalsRef.current.get(activeIdRef.current || '')
      if (active) active.fitAddon.fit()
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const closeSession = useCallback((id: string) => {
    setSessions(prev => {
      const idx = prev.findIndex(s => s.id === id)
      if (idx === -1 || prev.length <= 1) return prev
      const s = prev[idx]
      s.terminal.dispose()
      terminalsRef.current.delete(id)
      const next = prev.filter(x => x.id !== id)
      if (activeId === id) setActiveId(next[Math.min(idx, next.length - 1)]?.id || null)
      return next
    })
    const cid = connectionIdRef.current
    if (cid && hubRef.current) {
      hubRef.current.invoke('CloseShell', cid, id).catch(() => {})
    }
  }, [activeId])

  if (!connectionId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-600 min-h-0">
        <TerminalIcon className="w-16 h-16 mb-4 text-gray-700" />
        <p className="text-lg font-medium mb-1">选择一个服务器开始</p>
        <p className="text-sm">点击左侧连接列表，或新建一个 SSH 连接</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Tab bar */}
      <div className="bg-gray-900 border-b border-gray-800 flex items-center overflow-x-auto scrollbar-thin">
        {sessions.map((s, i) => (
          <div
            key={s.id}
            onClick={() => { setActiveId(s.id); setTimeout(() => s.fitAddon.fit(), 50) }}
            className={`term-tab flex items-center gap-1.5 px-3 h-8 text-xs border-r border-gray-800 cursor-pointer select-none shrink-0 transition-colors ${
              s.id === activeId
                ? 'bg-gray-850 text-gray-200 border-b-2 border-b-coconut-500'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-850/50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"></span>
            <span className="truncate max-w-28">{s.name}</span>
            <span className="text-gray-600 text-[10px]">#{i + 1}</span>
            {sessions.length > 1 && (
              <span
                className="term-tab-close ml-1 p-0.5 rounded hover:bg-gray-700 hover:text-gray-300 text-gray-600"
                onClick={e => { e.stopPropagation(); closeSession(s.id) }}
              >
                <X className="w-3 h-3" />
              </span>
            )}
          </div>
        ))}
        <button
          onClick={createSession}
          className="shrink-0 px-2 h-8 flex items-center text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition"
          title="新建会话"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Terminal containers */}
      <div className="flex-1 relative min-h-0 overflow-hidden" ref={containerRef}>
        {sessions.map(s => (
          <div
            key={s.id}
            id={`term-${s.id}`}
            className={`absolute inset-0 terminal-bg ${s.id === activeId ? '' : 'hidden'}`}
          />
        ))}
        {/* Floating AI explain button when text is selected */}
        {selectedText && selectedText.length > 2 && (
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('coconut:aiExplain', { detail: selectedText }))
              setSelectedText(null)
            }}
            className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-coconut-600/90 hover:bg-coconut-700 text-white text-xs font-medium shadow-lg transition backdrop-blur-sm"
          >
            <Sparkles className="w-3.5 h-3.5" /> AI 解释
          </button>
        )}
      </div>
    </div>
  )
}
