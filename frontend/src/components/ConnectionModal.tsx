import { useState } from 'react'
import { X } from 'lucide-react'
import type { SshConnection, AuthType, CreateConnectionRequest } from '../types'
import { connectionsApi } from '../services/api'

interface Props {
  connection: SshConnection | null
  onSave: (data: CreateConnectionRequest) => void
  onClose: () => void
}

export function ConnectionModal({ connection, onSave, onClose }: Props) {
  const [name, setName] = useState(connection?.name || '')
  const [host, setHost] = useState(connection?.host || '')
  const [port, setPort] = useState(connection?.port || 22)
  const [userName, setUserName] = useState(connection?.userName || '')
  const [authType, setAuthType] = useState<AuthType>((connection?.authType as AuthType) || 'Password')
  const [password, setPassword] = useState('')
  const [keyFilePath, setKeyFilePath] = useState(connection?.keyFilePath || '')
  const [group, setGroup] = useState(connection?.groupName || '')
  const [tags, setTags] = useState(connection?.tags || '')
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [testError, setTestError] = useState<string | null>(null)

  const handleHostBlur = async () => {
    if (!host || connection) return // skip for existing connections
    const cfg = await connectionsApi.lookupSshConfig(host)
    if (!cfg) return
    if (cfg.user && !userName) setUserName(cfg.user)
    if (cfg.port && port === 22) setPort(cfg.port)
    if (cfg.identityFile && !keyFilePath) {
      setKeyFilePath(cfg.identityFile)
      setAuthType('Key')
    }
  }

  const handleTest = async () => {
    if (!host || !userName) return
    setTestStatus('testing')
    setTestError(null)
    try {
      let res: { success: boolean; error?: string }
      if (connection?.id) {
        // Existing connection: test via saved ID
        res = await connectionsApi.test(connection.id, password || undefined)
      } else {
        // New connection: test with inline credentials
        res = await connectionsApi.testNew({
          host, port, userName, authType,
          password: password || undefined,
          keyFilePath: keyFilePath || undefined,
        })
      }
      if (res.success) {
        setTestStatus('ok')
      } else {
        setTestStatus('fail')
        setTestError(res.error || '连接失败')
      }
    } catch (e: unknown) {
      setTestStatus('fail')
      setTestError(e instanceof Error ? e.message : '请求失败')
    }
    setTimeout(() => { setTestStatus('idle'); setTestError(null) }, 5000)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      name, host, port, userName, authType,
      password: password || undefined,
      groupName: group || undefined,
      tags: tags || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 rounded-2xl w-[480px] border border-gray-700 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-base font-semibold text-gray-100">{connection ? '编辑连接' : '新建连接'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1.5">连接名称</label>
              <input value={name} onChange={e => setName(e.target.value)} required
                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 border border-gray-700 focus:outline-none focus:border-coconut-500"
                placeholder="web-prod-01" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">主机地址</label>
              <input value={host} onChange={e => setHost(e.target.value)} required
                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 border border-gray-700 focus:outline-none focus:border-coconut-500"
                placeholder="192.168.1.100" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">端口</label>
              <input value={port} onChange={e => setPort(parseInt(e.target.value) || 22)} type="number"
                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 border border-gray-700 focus:outline-none focus:border-coconut-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">用户名</label>
              <input value={userName} onChange={e => setUserName(e.target.value)} required
                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 border border-gray-700 focus:outline-none focus:border-coconut-500"
                placeholder="root" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">认证方式</label>
              <select value={authType} onChange={e => setAuthType(e.target.value as AuthType)}
                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 border border-gray-700 focus:outline-none focus:border-coconut-500">
                <option value="Password">密码</option>
                <option value="Key">密钥</option>
                <option value="Agent">SSH Agent</option>
              </select>
            </div>
            {authType === 'Password' && (
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1.5">密码</label>
                <input value={password} onChange={e => setPassword(e.target.value)} type="password"
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 border border-gray-700 focus:outline-none focus:border-coconut-500"
                  placeholder="••••••••" />
              </div>
            )}
            {authType === 'Key' && (
              <>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-400 mb-1.5">私钥文件路径 <span className="text-gray-600">（留空自动检测 ~/.ssh/）</span></label>
                  <input value={keyFilePath} onChange={e => setKeyFilePath(e.target.value)}
                    className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 border border-gray-700 focus:outline-none focus:border-coconut-500"
                    placeholder="自动检测 id_ed25519 / id_rsa" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-400 mb-1.5">密钥密码（可选）</label>
                  <input value={password} onChange={e => setPassword(e.target.value)} type="password"
                    className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 border border-gray-700 focus:outline-none focus:border-coconut-500"
                    placeholder="留空则无密码" />
                </div>
              </>
            )}
            {authType === 'Agent' && (
              <div className="col-span-2">
                <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50 text-xs text-gray-400">
                  将使用本机 SSH Agent 进行认证。请确保 ssh-agent 正在运行且已添加密钥。
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">分组</label>
              <input value={group} onChange={e => setGroup(e.target.value)}
                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 border border-gray-700 focus:outline-none focus:border-coconut-500"
                placeholder="生产/测试" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">标签</label>
              <input value={tags} onChange={e => setTags(e.target.value)}
                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 border border-gray-700 focus:outline-none focus:border-coconut-500"
                placeholder="web, nginx" />
            </div>
          </div>
          <div className="flex justify-between gap-3 pt-2 border-t border-gray-800">
            <div className="flex-1">
              <button
                type="button"
                onClick={handleTest}
                disabled={testStatus === 'testing' || !host || !userName}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                  testStatus === 'ok' ? 'bg-green-600/20 text-green-400' :
                  testStatus === 'fail' ? 'bg-red-600/20 text-red-400' :
                  'bg-gray-800 text-gray-300 hover:bg-gray-700'
                } disabled:opacity-50`}
              >
                {testStatus === 'testing' ? '测试中...' : testStatus === 'ok' ? '连接成功' : testStatus === 'fail' ? '连接失败' : '测试连接'}
              </button>
              {testStatus === 'fail' && testError && (
                <p className="mt-1.5 text-xs text-red-400 truncate" title={testError}>{testError}</p>
              )}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition">取消</button>
              <button type="submit" className="px-6 py-2 bg-coconut-600 hover:bg-coconut-700 text-white text-sm font-medium rounded-lg transition">保存</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
