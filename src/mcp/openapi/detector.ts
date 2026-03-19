/**
 * OpenAPI/Swagger 版本检测
 */

import type { OpenAPISpec } from './types.js'

export type SpecVersion = 'openapi3' | 'swagger2' | 'unknown'

export function detectSpecVersion(spec: OpenAPISpec): SpecVersion {
  // OpenAPI 3.x
  if (spec.openapi && spec.openapi.startsWith('3.')) {
    return 'openapi3'
  }

  // Swagger 2.0
  if (spec.swagger && spec.swagger === '2.0') {
    return 'swagger2'
  }

  return 'unknown'
}

export function validateSpec(spec: any): spec is OpenAPISpec {
  if (!spec || typeof spec !== 'object') {
    return false
  }

  // 必须有 paths
  if (!spec.paths || typeof spec.paths !== 'object') {
    return false
  }

  // 必须有 info
  if (!spec.info || typeof spec.info !== 'object') {
    return false
  }

  // 必须有版本标识
  const version = detectSpecVersion(spec)
  return version !== 'unknown'
}
