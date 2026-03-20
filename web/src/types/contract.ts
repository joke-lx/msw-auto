/**
 * API 契约类型定义
 * 与后端 OpenAPI/Swagger 契约类型保持一致
 */

export type SpecVersion = 'openapi3' | 'swagger2'

export interface OpenAPISchema {
  type?: string
  format?: string
  description?: string
  enum?: any[]
  items?: OpenAPISchema
  properties?: Record<string, OpenAPISchema>
  required?: string[]
  additionalProperties?: boolean | OpenAPISchema
  allOf?: OpenAPISchema[]
  oneOf?: OpenAPISchema[]
  anyOf?: OpenAPISchema[]
  $ref?: string
  default?: any
  example?: any
}

export interface OpenAPISpec {
  openapi?: string
  swagger?: string
  info?: {
    title?: string
    version?: string
    description?: string
  }
  paths?: Record<string, any>
  components?: {
    schemas?: Record<string, OpenAPISchema>
  }
  definitions?: Record<string, OpenAPISchema>
}

export interface Contract {
  id: string
  name: string
  sourceType: 'live' | 'file' | 'config'
  sourceUrl?: string
  version: SpecVersion
  spec: OpenAPISpec
  hash: string
  createdAt: string
  updatedAt: string
  lastSyncedAt?: string
}

export interface EndpointInfo {
  path: string
  method: string
  summary?: string
  description?: string
  operationId?: string
  tags?: string[]
  hasResponse: boolean
}

export interface MockGenerationResult {
  contractId: string
  endpoint: string
  method: string
  mock: {
    name: string
    method: string
    path: string
    status: number
    response: any
    headers?: Record<string, string>
  }
  variants?: {
    empty?: any
    error?: any
  }
  generatedAt: string
}

export interface TypeGenerationResult {
  contractId: string
  types: string
  interfaces: string[]
  filePath: string
  generatedAt: string
}

export interface ContractDiff {
  added: string[]
  removed: string[]
  modified: string[]
  breaking: boolean
}

export interface DiscoverOptions {
  projectPath?: string
  backendUrl?: string
}

export interface ContractStats {
  totalContracts: number
  totalEndpoints: number
  liveSources: number
  fileSources: number
  recentlySynced: number
}
