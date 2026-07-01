// ===== Enums =====
export type AuthType = 'Password' | 'Key' | 'Agent'
export type ProviderType = 'OpenAI' | 'Anthropic' | 'Ollama' | 'Custom'
export type MessageRole = 'User' | 'Assistant' | 'System'
export type Page = 'workspace' | 'settings'
export type SettingsTab = 'general' | 'terminal' | 'ssh' | 'ai' | 'data' | 'about'
export type BottomTab = 'ai' | 'sftp'

// ===== Entities =====
export interface SshConnection {
  id: string
  name: string
  host: string
  port: number
  userName: string
  authType: AuthType
  encryptedPassword?: string
  keyFilePath?: string
  keyFingerprint?: string
  groupName?: string
  tags?: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface AiProvider {
  id: string
  name: string
  providerType: ProviderType
  endpoint?: string
  encryptedApiKey?: string
  defaultModel: string
  temperature: number
  maxTokens: number
  isEnabled: boolean
  isDefault: boolean
  lastHealthCheckAt?: string
  isHealthy: boolean
}

export interface AiChatSession {
  id: string
  title: string
  aiProviderId: string
  sshConnectionId?: string
  systemPrompt?: string
  createdAt: string
  updatedAt: string
  aiProvider?: AiProvider
  messages?: AiChatMessage[]
}

export interface AiChatMessage {
  id: string
  sessionId: string
  role: MessageRole
  content: string
  contextSnapshot?: string
  suggestedCommands?: string
  createdAt: string
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system'
  language: string
  autoConnectLast: boolean
  fontSize: number
  fontFamily: string
  cursorStyle: string
  scrollbackLines: number
  defaultPort: number
  connectionTimeout: number
  keepAliveInterval: number
  autoReconnect: boolean
}

export interface ServerMetrics {
  cpuUsage: number
  totalMemoryMB: number
  usedMemoryMB: number
  diskTotal: string
  diskUsed: string
  diskUsagePercent: string
  networkRxBytes: number
  networkTxBytes: number
  uptime: string
  hostname: string
  kernel: string
}

export interface ProcessInfo {
  user: string
  pid: number
  cpuPercent: number
  memPercent: number
  command: string
}

export interface SftpFileInfo {
  name: string
  path: string
  isDirectory: boolean
  size: number
  lastModified: string
  permissions?: string
}

// ===== Request DTOs =====
export interface CreateConnectionRequest {
  name: string
  host: string
  port: number
  userName: string
  authType: AuthType
  password?: string
  groupName?: string
  tags?: string
}

export interface UpdateConnectionRequest {
  name?: string
  host?: string
  port?: number
  userName?: string
  authType?: AuthType
  password?: string
  groupName?: string
  tags?: string
}

export interface CreateProviderRequest {
  name: string
  providerType: ProviderType
  endpoint?: string
  apiKey?: string
  defaultModel: string
  temperature?: number
  maxTokens?: number
}

export interface CreateSessionRequest {
  title: string
  providerId: string
  connectionId?: string
  systemPrompt?: string
}
