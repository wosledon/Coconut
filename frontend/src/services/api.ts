import type {
  SshConnection, AiProvider, AiChatSession, AiChatMessage,
  AppSettings, SftpFileInfo, CreateConnectionRequest, UpdateConnectionRequest,
  CreateProviderRequest, CreateSessionRequest
} from '../types'

const BASE = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// ===== Connections =====
export const connectionsApi = {
  getAll: () => request<SshConnection[]>('/connections'),
  get: (id: string) => request<SshConnection>(`/connections/${id}`),
  create: (data: CreateConnectionRequest) =>
    request<SshConnection>('/connections', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: UpdateConnectionRequest) =>
    request<void>(`/connections/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/connections/${id}`, { method: 'DELETE' }),
  test: (id: string, password?: string) =>
    request<{ success: boolean; error?: string }>(`/connections/${id}/test`, {
      method: 'POST', body: JSON.stringify({ password })
    }),
  testNew: (data: { host: string; port: number; userName: string; authType: string; password?: string; keyFilePath?: string }) =>
    request<{ success: boolean; error?: string }>('/connections/test', {
      method: 'POST', body: JSON.stringify(data)
    }),
  lookupSshConfig: (host: string) =>
    request<{ hostName: string; user: string; port: number; identityFile: string } | null>(
      `/connections/ssh-config?host=${encodeURIComponent(host)}`
    ).catch(() => null),
}

// ===== AI Providers =====
export const providersApi = {
  getAll: () => request<AiProvider[]>('/aiproviders'),
  get: (id: string) => request<AiProvider>(`/aiproviders/${id}`),
  create: (data: CreateProviderRequest) =>
    request<AiProvider>('/aiproviders', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<CreateProviderRequest & { isEnabled: boolean; isDefault: boolean }>) =>
    request<void>(`/aiproviders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/aiproviders/${id}`, { method: 'DELETE' }),
  healthCheck: (id: string) =>
    request<{ healthy: boolean }>(`/aiproviders/${id}/health`, { method: 'POST' }),
}

// ===== AI Chat =====
export const chatApi = {
  getSessions: () => request<AiChatSession[]>('/aichat/sessions'),
  createSession: (data: CreateSessionRequest) =>
    request<AiChatSession>('/aichat/sessions', { method: 'POST', body: JSON.stringify(data) }),
  getMessages: (sessionId: string) =>
    request<AiChatMessage[]>(`/aichat/sessions/${sessionId}/messages`),
  deleteSession: (sessionId: string) =>
    request<void>(`/aichat/sessions/${sessionId}`, { method: 'DELETE' }),
  stream: async function* (sessionId: string, message: string, context?: string) {
    const res = await fetch(`${BASE}/aichat/sessions/${sessionId}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, context }),
    })
    if (!res.ok) throw new Error('Stream failed')
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') return
          try {
            const parsed = JSON.parse(data)
            if (parsed.content) yield parsed.content as string
          } catch { }
        }
      }
    }
  },
}

// ===== SFTP =====
export const sftpApi = {
  list: (connectionId: string, path: string) =>
    request<SftpFileInfo[]>(`/sftp/${connectionId}/list?path=${encodeURIComponent(path)}`),
  upload: async (connectionId: string, remotePath: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE}/sftp/${connectionId}/upload?path=${encodeURIComponent(remotePath)}`, {
      method: 'POST', body: form,
    })
    if (!res.ok) throw new Error('Upload failed')
  },
  download: (connectionId: string, path: string) =>
    `${BASE}/sftp/${connectionId}/download?path=${encodeURIComponent(path)}`,
  delete: (connectionId: string, path: string) =>
    request<void>(`/sftp/${connectionId}/file?path=${encodeURIComponent(path)}`, { method: 'DELETE' }),
  rename: (connectionId: string, oldPath: string, newPath: string) =>
    request<void>(`/sftp/${connectionId}/rename`, {
      method: 'POST', body: JSON.stringify({ oldPath, newPath })
    }),
  mkdir: (connectionId: string, path: string) =>
    request<void>(`/sftp/${connectionId}/mkdir?path=${encodeURIComponent(path)}`, { method: 'POST' }),
}

// ===== Settings =====
export const settingsApi = {
  get: () => request<AppSettings>('/settings'),
  update: (data: Partial<AppSettings>) =>
    request<void>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  clearAll: () => request<void>('/settings/clear', { method: 'POST' }),
}
