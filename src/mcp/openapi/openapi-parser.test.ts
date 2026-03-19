/**
 * OpenAPI 解析器测试
 */

import { describe, it, expect } from 'vitest'
import { OpenAPIParser } from './index.js'

describe('OpenAPI Parser', () => {
  it('should parse OpenAPI 3.0 spec', () => {
    const spec = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {
        '/users': {
          get: {
            summary: 'Get users',
            operationId: 'getUsers',
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: { type: 'object' }
                    }
                  }
                }
              }
            }
          },
          post: {
            summary: 'Create user',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      email: { type: 'string' }
                    }
                  }
                }
              }
            },
            responses: {
              '201': {
                description: 'Created'
              }
            }
          }
        }
      }
    }

    const result = OpenAPIParser.parse(spec)

    expect(result.success).toBe(true)
    expect(result.version).toBe('openapi3')
    expect(result.endpoints).toHaveLength(2)

    const getEndpoint = result.endpoints.find(e => e.method === 'GET')
    expect(getEndpoint).toBeDefined()
    expect(getEndpoint?.path).toBe('/users')
    expect(getEndpoint?.summary).toBe('Get users')
    expect(getEndpoint?.operationId).toBe('getUsers')

    const postEndpoint = result.endpoints.find(e => e.method === 'POST')
    expect(postEndpoint).toBeDefined()
    expect(postEndpoint?.requestBody).toBeDefined()
    expect(postEndpoint?.requestBody?.required).toBe(true)
  })

  it('should parse Swagger 2.0 spec', () => {
    const spec = {
      swagger: '2.0',
      info: { title: 'Test API', version: '1.0.0' },
      host: 'api.example.com',
      basePath: '/v1',
      paths: {
        '/products': {
          get: {
            summary: 'Get products',
            responses: {
              '200': {
                description: 'Success',
                schema: {
                  type: 'array'
                }
              }
            }
          }
        }
      }
    }

    const result = OpenAPIParser.parse(spec)

    expect(result.success).toBe(true)
    expect(result.version).toBe('swagger2')
    expect(result.endpoints).toHaveLength(1)
    expect(result.endpoints[0].method).toBe('GET')
    expect(result.endpoints[0].path).toBe('/products')
    expect(result.endpoints[0].servers).toContain('http://api.example.com/v1')
  })

  it('should handle $ref resolution', () => {
    const spec = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {
        '/users/{id}': {
          get: {
            parameters: [
              {
                $ref: '#/components/parameters/UserId'
              }
            ],
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/User'
                    }
                  }
                }
              }
            }
          }
        }
      },
      components: {
        parameters: {
          UserId: {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        },
        schemas: {
          User: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' }
            }
          }
        }
      }
    }

    const result = OpenAPIParser.parse(spec)

    expect(result.success).toBe(true)
    expect(result.endpoints[0].parameters.path).toHaveLength(1)
    expect(result.endpoints[0].parameters.path[0].name).toBe('id')
    expect(result.endpoints[0].successResponse?.schema).toBeDefined()
    expect(result.endpoints[0].successResponse?.schema.type).toBe('object')
  })

  it('should reject invalid spec', () => {
    const invalidSpec = {
      // Missing paths
      info: { title: 'Test', version: '1.0.0' }
    }

    const result = OpenAPIParser.parse(invalidSpec)

    expect(result.success).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})
