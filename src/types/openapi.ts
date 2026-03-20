/**
 * OpenAPI/Swagger 类型定义
 */

export type SpecVersion = 'openapi3' | 'swagger2' | 'unknown'

export interface OpenAPISchema {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'
  format?: string
  enum?: any[]
  pattern?: string
  minLength?: number
  maxLength?: number
  minimum?: number
  maximum?: number
  minItems?: number
  maxItems?: number
  required?: string[]
  properties?: Record<string, OpenAPISchema>
  items?: OpenAPISchema
  allOf?: OpenAPISchema[]
  oneOf?: OpenAPISchema[]
  anyOf?: OpenAPISchema[]
  $ref?: string
  description?: string
  example?: any
}

export interface OpenAPISpec {
  openapi?: string
  swagger?: string
  info?: {
    title: string
    version: string
    description?: string
  }
  paths?: Record<string, Record<string, OperationObject>>
  components?: {
    schemas?: Record<string, OpenAPISchema>
    responses?: Record<string, ResponseObject>
    parameters?: Record<string, ParameterObject>
  }
  definitions?: Record<string, OpenAPISchema>
}

export interface OperationObject {
  operationId?: string
  summary?: string
  description?: string
  tags?: string[]
  parameters?: ParameterObject[]
  requestBody?: RequestBodyObject
  responses?: Record<string, ResponseObject>
}

export interface ParameterObject {
  name: string
  in: 'query' | 'path' | 'header' | 'cookie'
  required?: boolean
  schema?: OpenAPISchema
  description?: string
}

export interface RequestBodyObject {
  description?: string
  required?: boolean
  content?: Record<string, MediaTypeObject>
}

export interface ResponseObject {
  description?: string
  content?: Record<string, MediaTypeObject>
}

export interface MediaTypeObject {
  schema?: OpenAPISchema
  example?: any
  examples?: Record<string, any>
}

export interface OpenAPISource {
  type: SpecVersion
  source: 'live' | 'file' | 'config'
  url?: string
  path?: string
  spec: OpenAPISpec
  timestamp?: string
  hash?: string
}

export interface EndpointDefinition {
  method: string
  path: string
  operationId?: string
  summary?: string
  description?: string
  tags?: string[]
  parameters: {
    path: ParameterObject[]
    query: ParameterObject[]
    header: ParameterObject[]
  }
  requestBody?: {
    content: Record<string, { schema: OpenAPISchema }>
  }
  responses: Record<string, {
    description?: string
    schema?: OpenAPISchema
  }>
  successResponse?: OpenAPISchema
  framework?: string
}
