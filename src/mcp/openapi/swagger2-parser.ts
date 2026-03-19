/**
 * Swagger 2.0 解析器
 */

import type {
  EndpointDefinition,
  ParameterDefinition,
  RequestBodyDefinition,
  ResponseDefinition,
  SecurityRequirement,
  OpenAPISpec,
} from './types.js'
import { RefResolver } from './resolver.js'

export class Swagger2Parser {
  private spec: OpenAPISpec
  private resolver: RefResolver

  constructor(spec: OpenAPISpec) {
    this.spec = spec
    this.resolver = new RefResolver(spec)
  }

  parse(): EndpointDefinition[] {
    const endpoints: EndpointDefinition[] = []

    for (const [path, pathItem] of Object.entries(this.spec.paths)) {
      const resolvedPathItem = pathItem.$ref
        ? this.resolver.resolve(pathItem.$ref)
        : pathItem

      if (!resolvedPathItem) continue

      const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head']

      for (const method of methods) {
        const operation = resolvedPathItem[method]
        if (!operation) continue

        endpoints.push(this.parseOperation(path, method, operation, resolvedPathItem))
      }
    }

    return endpoints
  }

  private parseOperation(
    path: string,
    method: string,
    operation: any,
    pathItem: any
  ): EndpointDefinition {
    const pathParameters = pathItem.parameters || []
    const operationParameters = operation.parameters || []
    const allParameters = [...pathParameters, ...operationParameters]

    return {
      method: method.toUpperCase(),
      path,
      framework: 'openapi',
      specVersion: 'swagger2',
      operationId: operation.operationId,
      summary: operation.summary,
      description: operation.description,
      tags: operation.tags || [],
      parameters: this.parseParameters(allParameters),
      requestBody: this.parseRequestBody(allParameters),
      responses: this.parseResponses(operation.responses),
      successResponse: this.findSuccessResponse(operation.responses),
      security: this.parseSecurity(operation.security),
      servers: this.parseServers(),
    }
  }

  private parseParameters(parameters: any[]): EndpointDefinition['parameters'] {
    const result: EndpointDefinition['parameters'] = {
      path: [],
      query: [],
      header: [],
      cookie: [],
    }

    for (const param of parameters) {
      const resolved = param.$ref ? this.resolver.resolve(param.$ref) : param
      if (!resolved || resolved.in === 'body' || resolved.in === 'formData') continue

      const paramDef: ParameterDefinition = {
        name: resolved.name,
        in: resolved.in,
        required: resolved.required || false,
        type: resolved.type,
        description: resolved.description,
        example: resolved['x-example'],
      }

      // Swagger 2.0 没有 cookie 参数
      if (resolved.in === 'path' || resolved.in === 'query' || resolved.in === 'header') {
        result[resolved.in].push(paramDef)
      }
    }

    return result
  }

  private parseRequestBody(parameters: any[]): RequestBodyDefinition | undefined {
    // Swagger 2.0 使用 body 或 formData 参数
    const bodyParam = parameters.find(p => {
      const resolved = p.$ref ? this.resolver.resolve(p.$ref) : p
      return resolved && resolved.in === 'body'
    })

    if (!bodyParam) return undefined

    const resolved = bodyParam.$ref ? this.resolver.resolve(bodyParam.$ref) : bodyParam

    return {
      required: resolved.required || false,
      contentType: 'application/json',
      schema: this.resolver.resolveSchema(resolved.schema),
      example: resolved['x-example'],
    }
  }

  private parseResponses(responses: any): ResponseDefinition[] {
    if (!responses) return []

    const result: ResponseDefinition[] = []

    for (const [statusCode, response] of Object.entries(responses)) {
      const resolved = (response as any).$ref
        ? this.resolver.resolve((response as any).$ref)
        : response

      if (!resolved) continue

      result.push({
        statusCode,
        description: (resolved as any).description,
        contentType: 'application/json',
        schema: this.resolver.resolveSchema((resolved as any).schema),
        example: (resolved as any).examples?.['application/json'],
      })
    }

    return result
  }

  private findSuccessResponse(responses: any): ResponseDefinition | undefined {
    if (!responses) return undefined

    const priorities = ['200', '201', '202', '204']

    for (const code of priorities) {
      if (responses[code]) {
        const resolved = responses[code].$ref
          ? this.resolver.resolve(responses[code].$ref)
          : responses[code]

        return {
          statusCode: code,
          description: resolved.description,
          contentType: 'application/json',
          schema: this.resolver.resolveSchema(resolved.schema),
          example: resolved.examples?.['application/json'],
        }
      }
    }

    for (const code of Object.keys(responses)) {
      if (code.startsWith('2')) {
        const resolved = responses[code].$ref
          ? this.resolver.resolve(responses[code].$ref)
          : responses[code]

        return {
          statusCode: code,
          description: resolved.description,
          contentType: 'application/json',
          schema: this.resolver.resolveSchema(resolved.schema),
          example: resolved.examples?.['application/json'],
        }
      }
    }

    return undefined
  }

  private parseSecurity(security: any[]): SecurityRequirement[] | undefined {
    if (!security || !this.spec.securityDefinitions) return undefined

    const result: SecurityRequirement[] = []

    for (const requirement of security) {
      for (const [name, scopes] of Object.entries(requirement)) {
        const scheme = (this.spec.securityDefinitions as any)[name]
        if (!scheme) continue

        result.push({
          type: scheme.type,
          name,
          in: scheme.in,
        })
      }
    }

    return result.length > 0 ? result : undefined
  }

  private parseServers(): string[] | undefined {
    // Swagger 2.0 使用 host + basePath
    if (!this.spec.host) return undefined

    const schemes = (this.spec as any).schemes || ['http']
    const basePath = this.spec.basePath || ''

    return schemes.map((scheme: string) => `${scheme}://${this.spec.host}${basePath}`)
  }
}
