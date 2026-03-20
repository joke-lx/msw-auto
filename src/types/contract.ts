/**
 * 契约中心类型定义
 */

import type { OpenAPISpec, OpenAPISource, SpecVersion } from './openapi.js'

/**
 * 契约实体
 */
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

/**
 * 契约版本
 */
export interface ContractVersion {
  id: string
  contractId: string
  version: number
  spec: OpenAPISpec
  diff?: ContractDiff
  createdAt: string
}

/**
 * 契约差异
 */
export interface ContractDiff {
  added: string[]
  removed: string[]
  modified: FieldChange[]
  breaking: boolean
}

/**
 * 字段变更
 */
export interface FieldChange {
  path: string
  type: 'added' | 'removed' | 'modified'
  oldValue?: any
  newValue?: any
  breaking?: boolean
}

/**
 * 验证问题
 */
export interface ValidationIssue {
  id: string
  contractId: string
  type: 'missing-in-openapi' | 'extra-in-openapi' | 'type-mismatch' | 'missing-required'
  severity: 'error' | 'warning' | 'info'
  endpoint?: string
  field?: string
  location?: string
  expected?: string
  actual?: string
  message: string
  createdAt: string
  resolvedAt?: string
}

/**
 * 验证报告
 */
export interface ValidationReport {
  contractId: string
  totalApis: number
  matchedFields: number
  totalFields: number
  issues: ValidationIssue[]
  score: number
  generatedAt: string
}

/**
 * 前端字段使用
 */
export interface FieldUsage {
  path: string
  type: string
  location: string
  line?: number
  column?: number
}

/**
 * 前端使用情况
 */
export interface FrontendUsage {
  [endpoint: string]: FieldUsage[]
}

/**
 * TypeScript 类型生成结果
 */
export interface TypeGenerationResult {
  contractId: string
  types: string
  filePath: string
  interfaces: string[]
  generatedAt: string
}

/**
 * Mock 生成配置
 */
export interface MockGenerationConfig {
  includeOptionalFields: boolean
  useRealExamples: boolean
  generateArrayVariants: boolean
  maxArrayLength: number
}

/**
 * Mock 生成结果
 */
export interface MockGenerationResult {
  contractId: string
  endpoint: string
  method: string
  mock: any
  variants: Record<string, any>
  generatedAt: string
}
