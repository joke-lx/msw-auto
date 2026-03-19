/**
 * OpenAPI/Swagger 统一解析器
 * 自动检测版本并使用相应的解析器
 */

import type { EndpointDefinition, OpenAPISpec } from './types.js'
import { detectSpecVersion, validateSpec, type SpecVersion } from './detector.js'
import { OpenAPI3Parser } from './openapi3-parser.js'
import { Swagger2Parser } from './swagger2-parser.js'

export interface ParseResult {
  success: boolean
  version: SpecVersion
  endpoints: EndpointDefinition[]
  errors: string[]
  warnings: string[]
}

export class OpenAPIParser {
  /**
   * 从 URL 获取并解析 OpenAPI/Swagger 规范
   */
  static async parseFromUrl(url: string): Promise<ParseResult> {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        return {
          success: false,
          version: 'unknown',
          endpoints: [],
          errors: [`HTTP ${response.status}: ${response.statusText}`],
          warnings: [],
        }
      }

      const spec = await response.json()
      return this.parse(spec)
    } catch (error) {
      return {
        success: false,
        version: 'unknown',
        endpoints: [],
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
      }
    }
  }

  /**
   * 从文件路径解析 OpenAPI/Swagger 规范
   */
  static parseFromFile(content: string): ParseResult {
    try {
      const spec = JSON.parse(content)
      return this.parse(spec)
    } catch (error) {
      // 尝试 YAML 解析（如果安装了 yaml 库）
      return {
        success: false,
        version: 'unknown',
        endpoints: [],
        errors: [`Failed to parse: ${error instanceof Error ? error.message : String(error)}`],
        warnings: ['YAML parsing not yet supported, please provide JSON format'],
      }
    }
  }

  /**
   * 解析 OpenAPI/Swagger 规范对象
   */
  static parse(spec: any): ParseResult {
    const errors: string[] = []
    const warnings: string[] = []

    // 验证规范
    if (!validateSpec(spec)) {
      return {
        success: false,
        version: 'unknown',
        endpoints: [],
        errors: ['Invalid OpenAPI/Swagger specification: missing required fields (paths, info)'],
        warnings: [],
      }
    }

    // 检测版本
    const version = detectSpecVersion(spec)

    if (version === 'unknown') {
      return {
        success: false,
        version: 'unknown',
        endpoints: [],
        errors: ['Unknown specification version. Expected OpenAPI 3.x or Swagger 2.0'],
        warnings: [],
      }
    }

    // 使用相应的解析器
    let endpoints: EndpointDefinition[] = []

    try {
      if (version === 'openapi3') {
        const parser = new OpenAPI3Parser(spec as OpenAPISpec)
        endpoints = parser.parse()
      } else {
        const parser = new Swagger2Parser(spec as OpenAPISpec)
        endpoints = parser.parse()
      }

      // 检查未解析的 $ref
      endpoints.forEach((ep, i) => {
        if (ep.parameters.path.some(p => p.schema?.type === 'circular')) {
          warnings.push(`Endpoint ${ep.method} ${ep.path}: circular reference detected`)
        }
      })

      return {
        success: true,
        version,
        endpoints,
        errors,
        warnings,
      }
    } catch (error) {
      return {
        success: false,
        version,
        endpoints: [],
        errors: [`Parse error: ${error instanceof Error ? error.message : String(error)}`],
        warnings,
      }
    }
  }

  /**
   * 转换为旧的 Endpoint 格式（兼容现有代码）
   */
  static toLegacyEndpoints(endpoints: EndpointDefinition[]): any[] {
    return endpoints.map(ep => ({
      method: ep.method,
      path: ep.path,
      framework: ep.framework,
      // 新增字段
      operationId: ep.operationId,
      summary: ep.summary,
      description: ep.description,
      tags: ep.tags,
      parameters: ep.parameters,
      requestBody: ep.requestBody,
      responses: ep.responses,
      successResponse: ep.successResponse,
    }))
  }
}

// 导出所有类型
export * from './types.js'
export * from './detector.js'