/**
 * OpenAPI 3.x 解析器
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

export class OpenAPI3Parser {
  private spec: OpenAPISpec
  private resolver: RefResolver

  constructor(spec: OpenAPISpec) {
    this.spec = spec
    this.resolver = new RefResolver(spec)
  }

  parse(): EndpointDefinition[] {
    const endpoints: EndpointDefinition[] = []

    for (const [path, pathItem] of Object.entries(this.spec.paths)) {
      // 解析 $ref
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
    // 合并 path-level 和 operation-level 参数
    const pathParameters = pathItem.parameters || []
    const operationParameters = operation.parameters || []
    const allParameters = [...pathParameters, ...operationParameters]

    return {
      method: method.toUpperCase(),
      path,
      framework: 'openapi',
      specVersion: 'openapi3',
      operationId: operation.operationId,
      summary: operation.summary,
      description: operation.description,
      tags: operation.tags || [],
      parameters: this.parseParameters(allParameters),
      requestBody: this.parseRequestBody(operation.requestBody),
      responses: this.parseResponses(operation.responses),
      successResponse: this.findSuccessResponse(operation.responses),
      security: this.parseSecurity(operation.security),
      servers: this.parseServers(operation.servers || this.spec.servers),
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
      if (!resolved) continue

      const paramDef: ParameterDefinition = {
        name: resolved.name,
        in: resolved.in,
        required: resolved.required || false,
        schema: this.resolver.resolveSchema(resolved.schema),
        description: resolved.description,
        example: resolved.example || resolved.schema?.example,
      }

      result[resolved.in as keyof typeof result]?.push(paramDef)
    }

    return result
  }

  private parseRequestBody(requestBody: any): RequestBodyDefinition | undefined {
    if (!requestBody) return undefined

    const resolved = requestBody.$ref
      ? this.resolver.resolve(requestBody.$ref)
      : requestBody

    if (!resolved || !resolved.content) return undefined

    // 优先使用 application/json
    const contentType = Object.keys(resolved.content)[0]
    const mediaType = resolved.content[contentType]

    return {
      required: resolved.required || false,
      contentType,
      schema: this.resolver.resolveSchema(mediaType.schema),
      example: mediaType.example || mediaType.examples,
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

      const content = (resolved as any).content
      const contentType = content ? Object.keys(content)[0] : undefined
      const mediaType = contentType ? content[contentType] : undefined

      result.push({
        statusCode,
        description: (resolved as any).description,
        contentType,
        schema: mediaType ? this.resolver.resolveSchema(mediaType.schema) : undefined,
        example: mediaType?.example || mediaType?.examples,
      })
    }

    return result
  }

  private findSuccessResponse(responses: any): ResponseDefinition | undefined {
    if (!responses) return undefined

    // 优先级: 200 > 201 > 2xx > default
    const priorities = ['200', '201', '202', '204']

    for (const code of priorities) {
      if (responses[code]) {
        const resolved = responses[code].$ref
          ? this.resolver.resolve(responses[code].$ref)
          : responses[code]

        const content = resolved.content
        const contentType = content ? Object.keys(content)[0] : undefined
        const mediaType = contentType ? content[contentType] : undefined

        return {
          statusCode: code,
          description: resolved.description,
          contentType,
          schema: mediaType ? this.resolver.resolveSchema(mediaType.schema) : undefined,
          example: mediaType?.example || mediaType?.examples,
        }
      }
    }

    // 查找任何 2xx
    for (const code of Object.keys(responses)) {
      if (code.startsWith('2')) {
        const resolved = responses[code].$ref
          ? this.resolver.resolve(responses[code].$ref)
          : responses[code]

        const content = resolved.content
        const contentType = content ? Object.keys(content)[0] : undefined
        const mediaType = contentType ? content[contentType] : undefined

        return {
          statusCode: code,
          description: resolved.description,
          contentType,
          schema: mediaType ? this.resolver.resolveSchema(mediaType.schema) : undefined,
          example: mediaType?.example || mediaType?.examples,
        }
      }
    }

    return undefined
  }

  private parseSecurity(security: any[]): SecurityRequirement[] | undefined {
    if (!security || !this.spec.components?.securitySchemes) return undefined

    const result: SecurityRequirement[] = []

    for (const requirement of security) {
      for (const [name, scopes] of Object.entries(requirement)) {
        const scheme = this.spec.components.securitySchemes[name]
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

  private parseServers(servers: any[]): string[] | undefined {
    if (!servers || servers.length === 0) return undefined

    return servers.map((server: any) => server.url)
  }
}
