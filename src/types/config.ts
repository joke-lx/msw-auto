/**
 * 配置类型定义
 */

export interface Config {
  server: ServerConfig
  llm: LLMConfig
  contract: ContractConfig
  mock: MockConfig
  validation: ValidationConfig
}

export interface ServerConfig {
  port: number
  webPort: number
  host: string
}

export interface LLMConfig {
  provider: 'anthropic' | 'openai' | 'custom'
  apiKey?: string
  baseUrl?: string
  model: string
  maxTokens?: number
}

export interface ContractConfig {
  autoDiscovery: boolean
  watchInterval: number
  sources: ContractSource[]
}

export interface ContractSource {
  type: 'live' | 'file' | 'config'
  url?: string
  path?: string
  enabled: boolean
}

export interface MockConfig {
  aiEnhanced: boolean
  defaultDelay: number
  generateExamples: boolean
}

export interface ValidationConfig {
  enabled: boolean
  frontendPath: string
  framework: 'react' | 'vue' | 'angular' | 'svelte' | 'none'
  autoFix: boolean
}
