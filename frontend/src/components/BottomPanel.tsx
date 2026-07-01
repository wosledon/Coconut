import { useState, useRef, useCallback, useEffect } from 'react'
import { ChevronDown, Zap, FolderOpen, Send, Plus, RefreshCw, Upload, FolderPlus, File, Folder, Trash2, X } from 'lucide-react'
import type { BottomTab, AiProvider, AiChatSession, AiChatMessage, SftpFileInfo } from '../types'
import { chatApi, sftpApi } from '../services/api'
import { t } from '../i18n'

interface Props {
  isOpen: boolean
  onToggle: () => void
  activeTab: BottomTab
  onSwitchTab: (tab: BottomTab) => void
  height: number
  connectionId: string | null
  providers: AiProvider[]
  sessions: AiChatSession[]
  onSessionsChange: (sessions: AiChatSession[]) => void
  sftpPath: string
  sftpFiles: SftpFileInfo[]
  onSftpNavigate: (path: string) => void
  onSftpRefresh: () => void
  activeSessionId: string | null
  onActiveSessionChange: (id: string | null) => void
}

export function BottomPanel({
  isOpen, onToggle, activeTab, onSwitchTab, height, connectionId,
  providers, sessions, onSessionsChange,
  sftpPath, sftpFiles, onSftpNavigate, onSftpRefresh,
  activeSessionId, onActiveSessionChange,
}: Props) {
  // AI Chat state
  const [messages, setMessages] = useState<AiChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Listen for "explain with AI" events from terminal
  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent).detail as string
      setInput(`请解释以下终端输出:\n\`\`\`\n${text}\n\`\`\``)
      onSwitchTab('ai')
    }
    window.addEventListener('coconut:aiExplain', handler)
    return () => window.removeEventListener('coconut:aiExplain', handler)
  }, [onSwitchTab])

  // Load messages when session changes
  const loadMessages = useCallback(async (sessionId: string) => {
    try {
      const msgs = await chatApi.getMessages(sessionId)
      setMessages(msgs)
    } catch { }
  }, [])

  const handleSend = useCallback(async () => {
    if (!input.trim() || !activeSessionId || isStreaming) return
    const userMsg: AiChatMessage = {
      id: Date.now().toString(),
      sessionId: activeSessionId,
      role: 'User',
      content: input.trim(),
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsStreaming(true)
    setStreamingContent('')

    try {
      let full = ''
      for await (const chunk of chatApi.stream(activeSessionId, userMsg.content)) {
        full += chunk
        setStreamingContent(full)
      }
      const assistantMsg: AiChatMessage = {
        id: (Date.now() + 1).toString(),
        sessionId: activeSessionId,
        role: 'Assistant',
        content: full,
        createdAt: new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMsg])
      setStreamingContent('')
    } catch (err) {
      console.error('Stream error:', err)
    } finally {
      setIsStreaming(false)
    }
  }, [input, activeSessionId, isStreaming])

  const handleNewSession = useCallback(async () => {
    if (providers.length === 0) return
    const provider = providers.find(p => p.isDefault) || providers[0]
    const systemPrompt = prompt('系统提示词（可选）:', '你是一个资深 Linux 运维工程师。') || undefined
    try {
      const session = await chatApi.createSession({
        title: `新会话 ${sessions.length + 1}`,
        providerId: provider.id,
        connectionId: connectionId || undefined,
        systemPrompt,
      })
      const updated = [session, ...sessions]
      onSessionsChange(updated)
      onActiveSessionChange(session.id)
      setMessages([])
    } catch { }
  }, [providers, sessions, connectionId, onSessionsChange, onActiveSessionChange])

  const handleSelectSession = useCallback(async (id: string) => {
    onActiveSessionChange(id)
    await loadMessages(id)
  }, [onActiveSessionChange, loadMessages])

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}K`
    return `${(bytes / 1048576).toFixed(1)}M`
  }

  return (
    <div className="shrink-0 border-b border-gray-800">
      {/* Tab bar */}
      <div className="bg-gray-900 flex items-center h-8">
        <div onClick={onToggle} className="flex items-center gap-2 px-3 h-full cursor-pointer select-none hover:bg-gray-850 transition">
          <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isOpen ? '' : 'rotate-180'}`} />
        </div>
        <button
          onClick={() => onSwitchTab('ai')}
          className={`btab-btn px-3 h-full text-xs font-medium flex items-center gap-1.5 border-r border-gray-800 transition ${
            activeTab === 'ai' ? 'text-coconut-500 border-b-2 border-b-coconut-500' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" /> AI Chat
        </button>
        <button
          onClick={() => onSwitchTab('sftp')}
          className={`btab-btn px-3 h-full text-xs font-medium flex items-center gap-1.5 border-r border-gray-800 transition ${
            activeTab === 'sftp' ? 'text-coconut-500 border-b-2 border-b-coconut-500' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <FolderOpen className="w-3.5 h-3.5" /> SFTP
        </button>
      </div>

      {/* Body */}
      <div className="overflow-hidden transition-all duration-200" style={{ height: isOpen ? height : 0 }}>
        {activeTab === 'ai' ? (
          <div className="flex h-full">
            {/* Session list */}
            <div className="w-48 bg-gray-900/50 border-r border-gray-800 flex flex-col shrink-0">
              <div className="p-2 border-b border-gray-800">
                <button
                  onClick={handleNewSession}
                  className="w-full bg-coconut-600/80 hover:bg-coconut-700 text-white rounded-lg py-1 text-[10px] font-medium transition flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" /> 新会话
                </button>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin p-1.5 space-y-0.5">
                {sessions.map(s => (
                  <div
                    key={s.id}
                    onClick={() => handleSelectSession(s.id)}
                    className={`px-2 py-1.5 rounded cursor-pointer group/session flex items-start justify-between ${
                      activeSessionId === s.id ? 'bg-gray-800' : 'hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-gray-200 font-medium truncate">{s.title}</div>
                      <div className="text-[10px] text-gray-600">{new Date(s.updatedAt).toLocaleDateString()}</div>
                    </div>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        if (!confirm(`删除会话 "${s.title}"?`)) return
                        await chatApi.deleteSession(s.id)
                        const updated = sessions.filter(x => x.id !== s.id)
                        onSessionsChange(updated)
                        if (activeSessionId === s.id) {
                          onActiveSessionChange(updated[0]?.id || null)
                          setMessages([])
                        }
                      }}
                      className="p-0.5 rounded hover:bg-red-900/50 text-gray-600 hover:text-red-400 transition opacity-0 group-hover/session:opacity-100 shrink-0 mt-0.5"
                      title="删除会话"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Chat area */}
            <div className="flex-1 flex flex-col min-w-0">
              {activeSessionId ? (
                <>
                  <div className="bg-gray-900 px-3 py-1.5 border-b border-gray-800 flex items-center gap-2 text-[10px] text-gray-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                    <span>{providers.find(p => p.id === sessions.find(s => s.id === activeSessionId)?.aiProviderId)?.name || 'AI'}</span>
                    {connectionId && <><span className="text-gray-700">|</span><span>已关联服务器</span></>}
                  </div>
                  <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
                    {messages.map(m => (
                      <div key={m.id} className={`flex gap-2 ${m.role === 'User' ? 'justify-end' : ''}`}>
                        {m.role === 'Assistant' && (
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">AI</div>
                        )}
                        <div className={`max-w-[75%] rounded-xl px-3 py-2 ${
                          m.role === 'User'
                            ? 'bg-coconut-600/20 border border-coconut-600/30 rounded-tr-sm'
                            : 'bg-gray-800 rounded-tl-sm'
                        }`}>
                          <AiMessageContent content={m.content} connectionId={connectionId} />
                        </div>
                      </div>
                    ))}
                    {streamingContent && (
                      <div className="flex gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">AI</div>
                        <div className="max-w-[75%] bg-gray-800 rounded-xl rounded-tl-sm px-3 py-2">
                          <p className="text-xs text-gray-200 whitespace-pre-wrap">{streamingContent}</p>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="bg-gray-900 border-t border-gray-800 p-2">
                    <div className="flex gap-2">
                      <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                        disabled={isStreaming}
                        className="flex-1 bg-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 border border-gray-700 focus:outline-none focus:border-coconut-500 transition"
                        placeholder={t('inputMessage')}
                      />
                      <button
                        onClick={handleSend}
                        disabled={isStreaming}
                        className="bg-coconut-600 hover:bg-coconut-700 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-600 text-xs">
                  选择或创建一个 AI 会话
                </div>
              )}
            </div>
          </div>
        ) : (
          /* SFTP Tab */
          <div className="h-full flex">
            {!connectionId ? (
              <div className="flex-1 flex items-center justify-center text-gray-600 text-xs">连接服务器后查看远程文件</div>
            ) : (
              <>
                {/* Directory tree */}
                <div className="w-48 bg-gray-900/50 border-r border-gray-800 p-2 overflow-y-auto scrollbar-thin shrink-0">
                  <div className="text-[10px] text-gray-500 font-medium mb-1.5 uppercase tracking-wider">远程目录</div>
                  <SftpTreeNode connectionId={connectionId} path="/" label="/" activePath={sftpPath} onNavigate={onSftpNavigate} depth={0} />
                </div>
                {/* File list */}
                <div className="flex-1 flex flex-col">
                  <div className="bg-gray-900 px-3 py-1.5 text-xs text-gray-400 border-b border-gray-800 flex items-center gap-2">
                    <span className="text-gray-500">路径:</span>
                    <span className="text-gray-200">{sftpPath}</span>
                    <div className="ml-auto flex gap-1.5">
                      <label className="text-[10px] px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 transition flex items-center gap-1 cursor-pointer">
                        <Upload className="w-3 h-3" /> 上传
                        <input type="file" className="hidden" onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file || !connectionId) return
                          const remotePath = sftpPath === '/' ? `/${file.name}` : `${sftpPath}/${file.name}`
                          await sftpApi.upload(connectionId, remotePath, file)
                          onSftpRefresh()
                          e.target.value = ''
                        }} />
                      </label>
                      <button onClick={async () => {
                        const name = prompt('新建目录名称:')
                        if (!name || !connectionId) return
                        const dirPath = sftpPath === '/' ? `/${name}` : `${sftpPath}/${name}`
                        await sftpApi.mkdir(connectionId, dirPath)
                        onSftpRefresh()
                      }} className="text-[10px] px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 transition flex items-center gap-1">
                        <FolderPlus className="w-3 h-3" /> 新建
                      </button>
                      <button onClick={onSftpRefresh} className="text-[10px] px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 transition flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" /> 刷新
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto scrollbar-thin">
                    <table className="w-full text-xs">
                      <thead className="text-[10px] text-gray-500 border-b border-gray-800 sticky top-0 bg-gray-950">
                        <tr>
                          <th className="text-left px-3 py-1.5 font-medium w-6"></th>
                          <th className="text-left px-2 py-1.5 font-medium">名称</th>
                          <th className="text-right px-3 py-1.5 font-medium w-16">大小</th>
                          <th className="text-right px-3 py-1.5 font-medium w-24">修改时间</th>
                          <th className="text-right px-3 py-1.5 font-medium w-20">操作</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-300">
                        {sftpFiles.map(f => (
                          <tr
                            key={f.path}
                            onDoubleClick={() => f.isDirectory && onSftpNavigate(f.path)}
                            className="hover:bg-gray-800/50 cursor-pointer"
                          >
                            <td className="px-3 py-1.5">
                              {f.isDirectory ? <Folder className="w-3.5 h-3.5 text-yellow-500" /> : <File className="w-3.5 h-3.5 text-gray-500" />}
                            </td>
                            <td className="px-2 py-1.5">{f.name}</td>
                            <td className="px-3 py-1.5 text-right text-gray-600">{f.isDirectory ? '—' : formatSize(f.size)}</td>
                            <td className="px-3 py-1.5 text-right text-gray-600">{new Date(f.lastModified).toLocaleString()}</td>
                            <td className="px-2 py-1.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {!f.isDirectory && (
                                  <a
                                    href={sftpApi.download(connectionId, f.path)}
                                    className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition"
                                    title="下载"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                                  </a>
                                )}
                                <button
                                  onClick={async () => {
                                    if (!connectionId) return
                                    const newName = prompt('重命名为:', f.name)
                                    if (!newName || newName === f.name) return
                                    const parentPath = f.path.substring(0, f.path.lastIndexOf('/'))
                                    const newPath = parentPath ? `${parentPath}/${newName}` : `/${newName}`
                                    await sftpApi.rename(connectionId, f.path, newPath)
                                    onSftpRefresh()
                                  }}
                                  className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition"
                                  title="重命名"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!connectionId || !confirm(`确定删除 "${f.name}"?`)) return
                                    await sftpApi.delete(connectionId, f.path)
                                    onSftpRefresh()
                                  }}
                                  className="p-1 rounded hover:bg-red-900/50 text-gray-500 hover:text-red-400 transition"
                                  title="删除"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** Renders AI message content with code block detection and copy/send-to-terminal buttons */
function AiMessageContent({ content, connectionId }: { content: string; connectionId: string | null }) {
  const parts = content.split(/(```[\s\S]*?```)/g)
  return (
    <div className="text-xs text-gray-200">
      {parts.map((part, i) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).split('\n')
          const lang = lines[0]?.trim() || ''
          const code = (lang ? lines.slice(1) : lines).join('\n').trim()
          return (
            <div key={i} className="mt-2 mb-1">
              {lang && <div className="text-[10px] text-gray-500 mb-0.5">{lang}</div>}
              <div className="p-2 bg-gray-850 rounded-lg border border-gray-700 font-mono text-[11px] text-gray-300 relative group/code">
                <pre className="whitespace-pre-wrap">{code}</pre>
                <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover/code:opacity-100 transition-opacity">
                  <button
                    onClick={() => navigator.clipboard.writeText(code)}
                    className="text-[10px] px-2 py-0.5 rounded bg-coconut-600/20 text-coconut-400 hover:bg-coconut-600/30 transition"
                  >
                    复制
                  </button>
                  {connectionId && (
                    <button
                      onClick={() => {
                        const event = new CustomEvent('coconut:sendToTerminal', { detail: code + '\n' })
                        window.dispatchEvent(event)
                      }}
                      className="text-[10px] px-2 py-0.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition"
                    >
                      发送到终端
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        }
        // Regular text - split by newlines
        return part.split('\n').map((line, j) => (
          <p key={`${i}-${j}`} className="whitespace-pre-wrap">{line}</p>
        ))
      })}
    </div>
  )
}

/** Expandable directory tree node for SFTP */
function SftpTreeNode({ connectionId, path, label, activePath, onNavigate, depth }: {
  connectionId: string; path: string; label: string; activePath: string; onNavigate: (p: string) => void; depth: number
}) {
  const [expanded, setExpanded] = useState(depth === 0)
  const [children, setChildren] = useState<{ name: string; path: string }[]>([])
  const [loading, setLoading] = useState(false)
  const isActive = activePath === path

  const toggle = async () => {
    if (!expanded && children.length === 0) {
      setLoading(true)
      try {
        const files = await sftpApi.list(connectionId, path)
        setChildren(files.filter(f => f.isDirectory).map(f => ({ name: f.name, path: f.path })))
      } catch { }
      setLoading(false)
    }
    setExpanded(!expanded)
    onNavigate(path)
  }

  return (
    <div>
      <div
        onClick={toggle}
        className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-xs ${
          isActive ? 'bg-gray-800 text-coconut-500 font-medium' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <span className="w-3 h-3 shrink-0 text-center text-[10px]">
          {loading ? '...' : expanded ? '▼' : children.length > 0 || depth === 0 ? '▶' : ''}
        </span>
        <Folder className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-coconut-500' : 'text-yellow-500'}`} />
        <span className="truncate">{label}</span>
      </div>
      {expanded && children.map(c => (
        <SftpTreeNode key={c.path} connectionId={connectionId} path={c.path} label={c.name}
          activePath={activePath} onNavigate={onNavigate} depth={depth + 1} />
      ))}
    </div>
  )
}
