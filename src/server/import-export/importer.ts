import type { Mock, CreateMockDto } from '../mock/manager.js'
import pc from 'picocolors'

export interface OpenAPISpec {
  openapi?: string
  swagger?: string
  info: {
    title: string
    version: string
    description?: string
  }
  paths: Record<string, PathItem>
  components?: {
    schemas?: Record<string, any>
  }
}

export interface PathItem {
  get?: Operation
  post?: Operation
  put?: Operation
  delete?: Operation
  patch?: Operation
  options?: Operation
  head?: Operation
}

export interface Operation {
  summary?: string
  description?: string
  operationId?: string
  parameters?: Parameter[]
  requestBody?: RequestBody
  responses?: Record<string, Response>
  tags?: string[]
}

export interface Parameter {
  name: string
  in: 'path' | 'query' | 'header' | 'cookie'
  required?: boolean
  schema?: any
  description?: string
}

export interface RequestBody {
  content?: Record<string, MediaType>
  required?: boolean
}

export interface MediaType {
  schema?: any
  example?: any
}

export interface Response {
  description?: string
  content?: Record<string, MediaType>
}

export interface PostmanCollection {
  info: {
    name: string
    description?: string
    schema: string
  }
  item: PostmanItem[]
}

export interface PostmanItem {
  name: string
  request?: PostmanRequest
  item?: PostmanItem[]
}

export interface PostmanRequest {
  method: string
  url: string | PostmanUrl
  header?: PostmanHeader[]
  body?: PostmanBody
}

export interface PostmanUrl {
  raw: string
  path?: string[]
  query?: { key: string; value: string }[]
}

export interface PostmanHeader {
  key: string
  value: string
}

export interface PostmanBody {
  mode?: 'raw' | 'formdata' | 'urlencoded'
  raw?: string
  json?: any
}

export class ImportExporter {
  /**
   * Import from OpenAPI/Swagger specification
   */
  async fromOpenAPI(spec: OpenAPISpec): Promise<Partial<Mock>[]> {
    const mocks: Partial<Mock>[] = []

    console.log(pc.cyan('[Import] Processing OpenAPI specification...'))

    for (const [path, pathItem] of Object.entries(spec.paths)) {
      const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'] as const

      for (const method of methods) {
        const operation = pathItem[method]
        if (!operation) continue

        const mock = this.convertOpenAPIToMock(method.toUpperCase(), path, operation, spec)
        mocks.push(mock)
      }
    }

    console.log(pc.green(`[Import] Generated ${mocks.length} mocks from OpenAPI`))
    return mocks
  }

  /**
   * Import from Postman collection
   */
  async fromPostman(collection: PostmanCollection): Promise<Partial<Mock>[]> {
    const mocks: Partial<Mock>[] = []

    console.log(pc.cyan('[Import] Processing Postman collection...'))

    const processItems = (items: PostmanItem[], basePath = '') => {
      for (const item of items) {
        if (item.item) {
          // Folder - recurse
          processItems(item.item, basePath)
        } else if (item.request) {
          // Request
          const mock = this.convertPostmanToMock(item, basePath)
          if (mock) {
            mocks.push(mock)
          }
        }
      }
    }

    processItems(collection.item)

    console.log(pc.green(`[Import] Generated ${mocks.length} mocks from Postman`))
    return mocks
  }

  /**
   * Export to OpenAPI specification
   */
  toOpenAPI(mocks: Mock[]): OpenAPISpec {
    const paths: Record<string, PathItem> = {}

    for (const mock of mocks) {
      const method = mock.method.toLowerCase() as keyof PathItem
      if (!paths[mock.path]) {
        paths[mock.path] = {}
      }

      paths[mock.path][method] = {
        summary: mock.name,
        description: mock.description,
        tags: mock.tags,
        responses: {
          [mock.status.toString()]: {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                },
                example: mock.response,
              },
            },
          },
        },
      }
    }

    return {
      openapi: '3.0.0',
      info: {
        title: 'MSW Auto Export',
        version: '1.0.0',
        description: 'Generated from MSW Auto mocks',
      },
      paths,
      components: {
        schemas: {},
      },
    }
  }

  /**
   * Export to Postman collection
   */
  toPostman(mocks: Mock[]): PostmanCollection {
    const items: PostmanItem[] = mocks.map((mock) => ({
      name: mock.name,
      request: {
        method: mock.method,
        url: {
          raw: mock.path,
          path: mock.path.split('/').filter(Boolean),
        },
        header: mock.headers
          ? Object.entries(mock.headers).map(([key, value]) => ({ key, value }))
          : [],
        body: {
          mode: 'raw',
          raw: JSON.stringify(mock.response, null, 2),
        },
      },
    }))

    return {
      info: {
        name: 'MSW Auto Export',
        description: 'Generated from MSW Auto mocks',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: items,
    }
  }

  /**
   * Export to JSON file
   */
  toJSON(mocks: Mock[]): string {
    return JSON.stringify(mocks, null, 2)
  }

  // ============ Private Helpers ============

  private convertOpenAPIToMock(
    method: string,
    path: string,
    operation: Operation,
    spec: OpenAPISpec
  ): Partial<Mock> {
    // Generate mock response from schema
    const response = this.generateMockResponse(operation, spec)

    // Extract status code
    const statusCode = this.extractStatusCode(operation.responses)

    return {
      name: operation.summary || operation.operationId || `${method} ${path}`,
      method,
      path: this.convertPathParams(path),
      status: statusCode,
      response,
      description: operation.description || operation.summary,
      tags: operation.tags,
      headers: {
        'Content-Type': 'application/json',
      },
      enabled: true,
    }
  }

  private convertPostmanToMock(item: PostmanItem, basePath: string): Partial<Mock> | null {
    if (!item.request) return null

    const method = item.request.method
    let url = ''

    if (typeof item.request.url === 'string') {
      url = item.request.url
    } else if (item.request.url?.raw) {
      url = item.request.url.raw
    }

    // Combine base path
    const fullPath = basePath ? `${basePath}/${url}`.replace(/\/+/g, '/') : url

    let response = { message: 'Mock response' }

    // Try to parse body
    if (item.request.body?.raw) {
      try {
        response = JSON.parse(item.request.body.raw)
      } catch {
        // Keep default
      }
    }

    return {
      name: item.name,
      method,
      path: fullPath,
      status: 200,
      response,
      description: item.name,
      enabled: true,
    }
  }

  private convertPathParams(path: string): string {
    // Convert {id} to :id for MSW compatibility
    return path.replace(/\{(\w+)\}/g, ':$1')
  }

  private generateMockResponse(operation: Operation, spec: OpenAPISpec): any {
    // Look for successful response (2xx)
    const successResponse = operation.responses?.['200'] ||
      operation.responses?.['201'] ||
      operation.responses?.['default']

    if (!successResponse?.content?.['application/json']?.example) {
      // Try to generate from schema
      const schema = successResponse?.content?.['application/json']?.schema
      if (schema) {
        return this.generateFromSchema(schema, spec.components?.schemas || {})
      }
      return { message: 'Mock response' }
    }

    return successResponse.content['application/json'].example
  }

  private generateFromSchema(schema: any, definitions: Record<string, any>): any {
    if (!schema) return null

    // Handle $ref
    if (schema.$ref) {
      const refName = schema.$ref.split('/').pop()
      if (refName && definitions[refName]) {
        return this.generateFromSchema(definitions[refName], definitions)
      }
    }

    // Handle type
    switch (schema.type) {
      case 'object':
        if (schema.properties) {
          const obj: Record<string, any> = {}
          for (const [key, prop] of Object.entries(schema.properties)) {
            obj[key] = this.generateFromSchema(prop, definitions)
          }
          return obj
        }
        return {}

      case 'array':
        if (schema.items) {
          return [this.generateFromSchema(schema.items, definitions)]
        }
        return []

      case 'string':
        if (schema.enum) return schema.enum[0]
        if (schema.format === 'date-time') return new Date().toISOString()
        if (schema.format === 'date') return new Date().toISOString().split('T')[0]
        if (schema.format === 'email') return 'user@example.com'
        if (schema.format === 'uri') return 'https://example.com'
        return 'string'

      case 'integer':
      case 'number':
        return schema.minimum || 0

      case 'boolean':
        return true

      default:
        return null
    }
  }

  private extractStatusCode(responses: Record<string, Response> | undefined): number {
    if (!responses) return 200

    // Try 2xx first
    if (responses['200']) return 200
    if (responses['201']) return 201
    if (responses['202']) return 202

    // Default to first available
    const codes = Object.keys(responses)
    if (codes.length > 0) {
      return parseInt(codes[0]) || 200
    }

    return 200
  }
}
