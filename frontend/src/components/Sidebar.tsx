import { useState } from 'react'
import { Search, Plus, Settings } from 'lucide-react'
import type { SshConnection } from '../types'
import { t } from '../i18n'

interface Props {
  connections: SshConnection[]
  activeConnectionId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onEdit: (conn: SshConnection) => void
  onDelete: (id: string) => void
  onSettings: () => void
}

export function Sidebar({ connections, activeConnectionId, onSelect, onNew, onEdit, onDelete, onSettings }: Props) {
  const [search, setSearch] = useState('')

  const groups = connections.reduce<Record<string, SshConnection[]>>((acc, c) => {
    const group = c.groupName || '未分组'
    if (!acc[group]) acc[group] = []
    acc[group].push(c)
    return acc
  }, {})

  const filteredGroups = Object.entries(groups).map(([group, conns]) => ({
    group,
    conns: conns.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
  })).filter(g => g.conns.length > 0)

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
      {/* Logo */}
      <div className="h-14 flex items-center gap-2 px-4 border-b border-gray-800">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-coconut-500 to-emerald-700 flex items-center justify-center text-xs font-bold text-white">C</div>
        <span className="font-semibold text-base">Coconut</span>
        <span className="text-[10px] text-gray-500 ml-auto">v0.1</span>
      </div>

      {/* Search */}
      <div className="px-3 py-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 rounded-lg pl-8 pr-3 py-2 text-sm text-gray-200 placeholder-gray-500 border border-gray-700 focus:outline-none focus:border-coconut-500 transition-colors"
            placeholder={t('searchPlaceholder')}
          />
        </div>
      </div>

      {/* Connection list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-2">
        {filteredGroups.map(({ group, conns }) => (
          <div key={group}>
            <div className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 font-medium uppercase tracking-wider">
              {group}
            </div>
            {conns.map(conn => (
              <div
                key={conn.id}
                onClick={() => onSelect(conn.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  if (confirm(`删除连接 "${conn.name}"?`)) onDelete(conn.id)
                }}
                className={`cursor-pointer px-3 py-2 rounded-lg flex items-center gap-3 hover:bg-gray-800 transition group/item ${
                  activeConnectionId === conn.id ? 'connection-active' : ''
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0"></span>
                <span className="text-sm truncate">{conn.name}</span>
                <span className="text-[10px] text-gray-600 ml-auto">{conn.port}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(conn) }}
                  className="opacity-0 group-hover/item:opacity-100 text-gray-500 hover:text-gray-300 transition"
                >
                  <Settings className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* New connection button */}
      <div className="p-3 border-t border-gray-800">
        <button
          onClick={onNew}
          className="w-full bg-coconut-600 hover:bg-coconut-700 text-white rounded-lg py-2 text-sm font-medium transition flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t('newConnection')}
        </button>
      </div>
    </aside>
  )
}
