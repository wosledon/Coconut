import { useState } from 'react'
import { Settings as SettingsIcon, Terminal, Lock, Zap, Database, Info, ChevronLeft, Trash2 } from 'lucide-react'
import type { SettingsTab, AppSettings, AiProvider, ProviderType, CreateProviderRequest } from '../types'
import { providersApi, settingsApi } from '../services/api'

interface Props {
  activeTab: SettingsTab
  onSwitchTab: (tab: SettingsTab) => void
  settings: AppSettings | null
  onUpdateSettings: (data: Partial<AppSettings>) => void
  providers: AiProvider[]
  onProvidersChange: (providers: AiProvider[]) => void
  onBack: () => void
}

const tabs: { key: SettingsTab; label: string; icon: typeof SettingsIcon }[] = [
  { key: 'general', label: '通用', icon: SettingsIcon },
  { key: 'terminal', label: '终端', icon: Terminal },
  { key: 'ssh', label: 'SSH', icon: Lock },
  { key: 'ai', label: 'AI 提供商', icon: Zap },
  { key: 'data', label: '数据', icon: Database },
  { key: 'about', label: '关于', icon: Info },
]

export function SettingsPage({ activeTab, onSwitchTab, settings, onUpdateSettings, providers, onProvidersChange, onBack }: Props) {
  if (!settings) return <div className="flex-1 flex items-center justify-center text-gray-500">加载中...</div>

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="bg-gray-900 border-b border-gray-800 px-5 h-12 flex items-center gap-3 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition px-2 py-1 rounded hover:bg-gray-800">
          <ChevronLeft className="w-4 h-4" /> 返回
        </button>
        <span className="text-sm font-medium text-gray-200">设置</span>
      </div>

      <div className="flex-1 flex min-h-0">
        <nav className="w-44 bg-gray-900/50 border-r border-gray-800 flex flex-col shrink-0 overflow-y-auto scrollbar-thin py-2">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => onSwitchTab(t.key)}
              className={`flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition hover:bg-gray-800/50 ${
                activeTab === t.key
                  ? 'bg-gray-800 text-coconut-500 border-l-2 border-coconut-500'
                  : 'text-gray-400'
              }`}
            >
              <t.icon className="w-4 h-4 shrink-0" /> {t.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {activeTab === 'general' && (
            <div className="p-6 max-w-2xl">
              <h3 className="text-base font-medium text-gray-200 mb-4">通用</h3>
              <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 divide-y divide-gray-700/30">
                <div className="flex items-center justify-between px-4 py-3">
                  <div><p className="text-sm text-gray-200">主题</p><p className="text-xs text-gray-500">界面外观</p></div>
                  <select
                    value={settings.theme}
                    onChange={e => onUpdateSettings({ theme: e.target.value as any })}
                    className="bg-gray-800 rounded-lg px-3 py-1.5 text-sm text-gray-200 border border-gray-700 focus:outline-none focus:border-coconut-500"
                  >
                    <option value="dark">深色模式</option>
                    <option value="light">浅色模式</option>
                    <option value="system">跟随系统</option>
                  </select>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div><p className="text-sm text-gray-200">语言</p><p className="text-xs text-gray-500">界面语言</p></div>
                  <select
                    value={settings.language}
                    onChange={e => onUpdateSettings({ language: e.target.value })}
                    className="bg-gray-800 rounded-lg px-3 py-1.5 text-sm text-gray-200 border border-gray-700 focus:outline-none focus:border-coconut-500"
                  >
                    <option value="zh-CN">中文</option>
                    <option value="en-US">English</option>
                  </select>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div><p className="text-sm text-gray-200">启动时自动连接上次服务器</p></div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.autoConnectLast}
                      onChange={e => onUpdateSettings({ autoConnectLast: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-700 rounded-full peer peer-checked:bg-coconut-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'terminal' && (
            <div className="p-6 max-w-2xl">
              <h3 className="text-base font-medium text-gray-200 mb-4">终端</h3>
              <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 divide-y divide-gray-700/30">
                <div className="flex items-center justify-between px-4 py-3">
                  <div><p className="text-sm text-gray-200">字体大小</p></div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => onUpdateSettings({ fontSize: Math.max(10, settings.fontSize - 1) })} className="w-7 h-7 rounded bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300">-</button>
                    <span className="text-sm text-gray-200 w-8 text-center font-mono">{settings.fontSize}</span>
                    <button onClick={() => onUpdateSettings({ fontSize: Math.min(24, settings.fontSize + 1) })} className="w-7 h-7 rounded bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300">+</button>
                  </div>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div><p className="text-sm text-gray-200">字体</p></div>
                  <select
                    value={settings.fontFamily}
                    onChange={e => onUpdateSettings({ fontFamily: e.target.value })}
                    className="bg-gray-800 rounded-lg px-3 py-1.5 text-sm text-gray-200 border border-gray-700 focus:outline-none focus:border-coconut-500"
                  >
                    <option>JetBrains Mono</option>
                    <option>Fira Code</option>
                    <option>Cascadia Code</option>
                    <option>Source Code Pro</option>
                  </select>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div><p className="text-sm text-gray-200">光标样式</p></div>
                  <select
                    value={settings.cursorStyle}
                    onChange={e => onUpdateSettings({ cursorStyle: e.target.value })}
                    className="bg-gray-800 rounded-lg px-3 py-1.5 text-sm text-gray-200 border border-gray-700 focus:outline-none focus:border-coconut-500"
                  >
                    <option value="block">方块 (Block)</option>
                    <option value="line">竖线 (Line)</option>
                    <option value="underline">下划线 (Underline)</option>
                  </select>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div><p className="text-sm text-gray-200">滚动缓冲区</p><p className="text-xs text-gray-500">保留的历史行数</p></div>
                  <input
                    type="number"
                    value={settings.scrollbackLines}
                    onChange={e => onUpdateSettings({ scrollbackLines: parseInt(e.target.value) || 5000 })}
                    className="w-20 bg-gray-800 rounded-lg px-3 py-1.5 text-sm text-gray-200 border border-gray-700 focus:outline-none focus:border-coconut-500 text-right font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ssh' && (
            <div className="p-6 max-w-2xl">
              <h3 className="text-base font-medium text-gray-200 mb-4">SSH</h3>
              <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 divide-y divide-gray-700/30">
                {[
                  { label: '默认端口', key: 'defaultPort' as const },
                  { label: '连接超时（秒）', key: 'connectionTimeout' as const },
                  { label: 'Keep Alive 间隔（秒）', key: 'keepAliveInterval' as const },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between px-4 py-3">
                    <div><p className="text-sm text-gray-200">{item.label}</p></div>
                    <input
                      type="number"
                      value={settings[item.key]}
                      onChange={e => onUpdateSettings({ [item.key]: parseInt(e.target.value) || 0 })}
                      className="w-20 bg-gray-800 rounded-lg px-3 py-1.5 text-sm text-gray-200 border border-gray-700 focus:outline-none focus:border-coconut-500 text-right font-mono"
                    />
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-3">
                  <div><p className="text-sm text-gray-200">自动重连</p><p className="text-xs text-gray-500">断开后自动尝试重新连接</p></div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.autoReconnect}
                      onChange={e => onUpdateSettings({ autoReconnect: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-700 rounded-full peer peer-checked:bg-coconut-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="p-6 max-w-2xl">
              <h3 className="text-base font-medium text-gray-200 mb-4">AI 提供商</h3>
              <AiProviderSection providers={providers} onProvidersChange={onProvidersChange} />
            </div>
          )}

          {activeTab === 'data' && (
            <div className="p-6 max-w-2xl">
              <h3 className="text-base font-medium text-gray-200 mb-4">数据</h3>
              <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 divide-y divide-gray-700/30">
                <div className="flex items-center justify-between px-4 py-3">
                  <div><p className="text-sm text-gray-200">数据库路径</p><p className="text-xs text-gray-500 font-mono">~/.coconut/data.db</p></div>
                </div>
              </div>
              <div className="mt-6 bg-red-900/10 rounded-xl border border-red-900/30 px-4 py-3 flex items-center justify-between">
                <div><p className="text-sm text-red-400 font-medium">清除所有数据</p><p className="text-xs text-gray-500">删除所有连接、AI 提供商、会话和设置</p></div>
                <button onClick={async () => {
                  if (!confirm('确定要清除所有数据？此操作不可恢复！')) return
                  await settingsApi.clearAll()
                  window.location.reload()
                }} className="text-xs px-4 py-2 rounded-lg bg-red-900/50 hover:bg-red-800/70 text-red-400 transition font-medium">清除</button>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="p-6 max-w-2xl">
              <h3 className="text-base font-medium text-gray-200 mb-4">关于</h3>
              <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-coconut-500 to-emerald-700 flex items-center justify-center text-base font-bold text-white">C</div>
                  <div>
                    <p className="text-sm text-gray-200 font-medium">Coconut v0.1.0</p>
                    <p className="text-xs text-gray-500">基于 ASP.NET Core 10 + React + Tailwind CSS</p>
                  </div>
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-coconut-600/20 text-coconut-400">开发中</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AiProviderSection({ providers, onProvidersChange }: { providers: AiProvider[]; onProvidersChange: (p: AiProvider[]) => void }) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AiProvider | null>(null)
  const [name, setName] = useState('')
  const [providerType, setProviderType] = useState<ProviderType>('OpenAI')
  const [endpoint, setEndpoint] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(4096)

  const resetForm = () => {
    setName(''); setProviderType('OpenAI'); setEndpoint(''); setApiKey(''); setModel(''); setTemperature(0.7); setMaxTokens(4096)
    setShowForm(false); setEditing(null)
  }

  const openEdit = (p: AiProvider) => {
    setEditing(p); setName(p.name); setProviderType(p.providerType); setEndpoint(p.endpoint || '')
    setApiKey(''); setModel(p.defaultModel); setTemperature(p.temperature); setMaxTokens(p.maxTokens)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const data: CreateProviderRequest & { isEnabled?: boolean } = {
      name, providerType, endpoint: endpoint || undefined, apiKey: apiKey || undefined,
      defaultModel: model, temperature, maxTokens,
    }
    if (editing) {
      await providersApi.update(editing.id, { ...data, isEnabled: editing.isEnabled })
    } else {
      await providersApi.create(data)
    }
    onProvidersChange(await providersApi.getAll())
    resetForm()
  }

  return (
    <div className="space-y-2">
      {providers.map(p => (
        <div key={p.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl border border-gray-700/50 group/provider">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => openEdit(p)}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
              p.providerType === 'OpenAI' ? 'bg-green-600/20 text-green-400' :
              p.providerType === 'Anthropic' ? 'bg-purple-600/20 text-purple-400' :
              p.providerType === 'Ollama' ? 'bg-blue-600/20 text-blue-400' :
              'bg-gray-600/20 text-gray-400'
            }`}>
              {p.name[0]}
            </div>
            <div>
              <p className="text-sm text-gray-200 font-medium">{p.name}</p>
              <p className="text-[10px] text-gray-500">{p.defaultModel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={async () => {
              const res = await providersApi.healthCheck(p.id)
              onProvidersChange(await providersApi.getAll())
            }} className={`text-[10px] px-1.5 py-0.5 rounded transition ${
              p.isHealthy ? 'bg-green-600/20 text-green-400' : 'bg-gray-700 text-gray-500'
            } hover:opacity-80`} title="点击检测">
              {p.isHealthy ? '在线' : '检测'}
            </button>
            {p.isDefault && <span className="text-[10px] px-1.5 py-0.5 rounded bg-coconut-600/20 text-coconut-400">默认</span>}
            <button onClick={async () => {
              await providersApi.update(p.id, { isDefault: !p.isDefault })
              onProvidersChange(await providersApi.getAll())
            }} className="text-[10px] text-gray-600 hover:text-coconut-400 transition" title="设为默认">
              <svg className="w-3.5 h-3.5" fill={p.isDefault ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
            </button>
            <label className="relative inline-flex items-center cursor-pointer ml-2">
              <input type="checkbox" checked={p.isEnabled}
                onChange={async () => { await providersApi.update(p.id, { isEnabled: !p.isEnabled }); onProvidersChange(await providersApi.getAll()) }}
                className="sr-only peer" />
              <div className="w-8 h-4 bg-gray-700 rounded-full peer peer-checked:bg-coconut-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4"></div>
            </label>
            <button onClick={async () => {
              if (!confirm(`删除提供商 "${p.name}"?`)) return
              await providersApi.delete(p.id)
              onProvidersChange(await providersApi.getAll())
            }} className="p-1 rounded hover:bg-red-900/50 text-gray-600 hover:text-red-400 transition opacity-0 group-hover/provider:opacity-100">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
      <button onClick={() => { resetForm(); setShowForm(true) }}
        className="w-full flex items-center justify-center gap-2 p-3 bg-gray-800/30 rounded-xl border border-dashed border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-500 transition text-sm">
        <Zap className="w-4 h-4" /> 添加提供商
      </button>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={resetForm}>
          <div className="bg-gray-900 rounded-2xl w-[460px] border border-gray-700 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="text-base font-semibold text-gray-100">{editing ? '编辑提供商' : '添加提供商'}</h2>
              <button onClick={resetForm} className="text-gray-500 hover:text-gray-300 transition">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div><label className="block text-xs text-gray-400 mb-1.5">名称</label>
                <input value={name} onChange={e => setName(e.target.value)} required
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 border border-gray-700 focus:outline-none focus:border-coconut-500" placeholder="OpenAI" /></div>
              <div><label className="block text-xs text-gray-400 mb-1.5">类型</label>
                <select value={providerType} onChange={e => setProviderType(e.target.value as ProviderType)}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 border border-gray-700 focus:outline-none focus:border-coconut-500">
                  <option value="OpenAI">OpenAI</option><option value="Anthropic">Anthropic</option>
                  <option value="Ollama">Ollama</option><option value="Custom">自定义</option>
                </select></div>
              <div><label className="block text-xs text-gray-400 mb-1.5">API Key</label>
                <input value={apiKey} onChange={e => setApiKey(e.target.value)} type="password"
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 border border-gray-700 focus:outline-none focus:border-coconut-500"
                  placeholder={editing ? '(留空保持不变)' : 'sk-...'} /></div>
              <div><label className="block text-xs text-gray-400 mb-1.5">端点 URL</label>
                <input value={endpoint} onChange={e => setEndpoint(e.target.value)}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 border border-gray-700 focus:outline-none focus:border-coconut-500"
                  placeholder="https://api.openai.com/v1" /></div>
              <div><label className="block text-xs text-gray-400 mb-1.5">默认模型</label>
                <input value={model} onChange={e => setModel(e.target.value)} required
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 border border-gray-700 focus:outline-none focus:border-coconut-500"
                  placeholder="gpt-4o" /></div>
              <div className="flex gap-4">
                <div className="flex-1"><label className="block text-xs text-gray-400 mb-1.5">Temperature</label>
                  <input value={temperature} onChange={e => setTemperature(parseFloat(e.target.value) || 0.7)} type="number" step="0.1" min="0" max="2"
                    className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 border border-gray-700 focus:outline-none focus:border-coconut-500" /></div>
                <div className="flex-1"><label className="block text-xs text-gray-400 mb-1.5">Max Tokens</label>
                  <input value={maxTokens} onChange={e => setMaxTokens(parseInt(e.target.value) || 4096)} type="number"
                    className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 border border-gray-700 focus:outline-none focus:border-coconut-500" /></div>
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-800">
                <button type="button" onClick={resetForm} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition">取消</button>
                <button type="submit" className="px-6 py-2 bg-coconut-600 hover:bg-coconut-700 text-white text-sm font-medium rounded-lg transition">保存</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
