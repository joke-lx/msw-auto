/**
 * OpenAPI/Swagger 统一类型定义
 */

export interface ParameterDefinition {
  name: string
  in: 'path' | 'query' | 'header' | 'cookie'
  required: boolean
  schema?: any
  type?: string
  description?: string
  example?: any
}

export interface RequestBodyDefinition {
  required: boolean
  contentType: string
  schema?: any
  example?: any
}

export interface ResponseDefinition {
  statusCode: string
  description?: string
  contentType?: string
  schema?: any
  example?: any
}

export interface SecurityRequirement {
  type: string
  name: string
  in?: string
}

export interface EndpointDefinition {
  method: string
  path: string
  framework: 'openapi'
  specVersion: 'openapi3' | 'swagger2'
  operationId?: string
  summary?: string
  description?: string
  tags?: string[]
  parameters: {
    path: ParameterDefinition[]
    query: ParameterDefinition[]
    header: ParameterDefinition[]
    cookie: ParameterDefinition[]
  }
  requestBody?: RequestBodyDefinition
  responses: ResponseDefinition[]
  successResponse?: ResponseDefinition
  security?: SecurityRequirement[]
  servers?: string[]
}

export interface OpenAPISpec {
  openapi?: string
  swagger?: string
  info: {
    title: string
    version: string
  }
  paths: Record<string, any>
  components?: any
  definitions?: any
  servers?: any[]
  host?: string
  basePath?: string
}
