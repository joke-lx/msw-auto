/**
 * Schema-Based Mock Generator 单元测试
 */

import { describe, it, expect } from 'vitest'
import { SchemaBasedMockGenerator } from '../../../contract/mock-generator.js'
import type { OpenAPISchema } from '../../../types/index.js'

describe('SchemaBasedMockGenerator', () => {
  const generator = new SchemaBasedMockGenerator()

  describe('generateFromSchema', () => {
    it('should generate mock for string schema', () => {
      const schema: OpenAPISchema = {
        type: 'string',
        example: 'test value',
      }

      const mock = generator.generateFromSchema('/test', 'GET', schema)
      expect(mock).toBeDefined()
      expect(typeof mock).toBe('string')
    })

    it('should generate mock for number schema', () => {
      const schema: OpenAPISchema = {
        type: 'number',
        minimum: 1,
        maximum: 100,
      }

      const mock = generator.generateFromSchema('/test', 'GET', schema)
      expect(typeof mock).toBe('number')
      expect(mock).toBeGreaterThanOrEqual(1)
      expect(mock).toBeLessThanOrEqual(100)
    })

    it('should generate mock for array schema', () => {
      const schema: OpenAPISchema = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
          },
        },
      }

      const mock = generator.generateFromSchema('/test', 'GET', schema)
      expect(Array.isArray(mock)).toBe(true)
      expect(mock.length).toBeGreaterThan(0)
    })

    it('should generate mock for object schema', () => {
      const schema: OpenAPISchema = {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['id', 'name'],
      }

      const mock = generator.generateFromSchema('/test', 'GET', schema)
      expect(typeof mock).toBe('object')
      // id 和 name 是必需字段，应该存在
      expect(mock).toHaveProperty('id')
      expect(mock).toHaveProperty('name')
    })

    it('should handle nested objects', () => {
      const schema: OpenAPISchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              profile: {
                type: 'object',
                properties: {
                  bio: { type: 'string' },
                },
              },
            },
          },
        },
        required: ['user'],
      }

      const mock = generator.generateFromSchema('/test', 'GET', schema)
      expect(mock.user).toBeDefined()
      expect(mock.user.profile).toBeDefined()
    })
  })

  describe('semantic string generation', () => {
    it('should generate email for email field', () => {
      const schema: OpenAPISchema = {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
        },
        required: ['email'],
      }

      const mock = generator.generateFromSchema('/test', 'GET', schema)
      expect(mock.email).toMatch(/^[^@]+@[^@]+\.[^@]+$/)
    })

    it('should generate UUID for uuid field', () => {
      const schema: OpenAPISchema = {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      }

      const mock = generator.generateFromSchema('/test', 'GET', schema)
      expect(mock.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    })

    it('should generate date-time for date-time field', () => {
      const schema: OpenAPISchema = {
        type: 'object',
        properties: {
          createdAt: { type: 'string', format: 'date-time' },
        },
        required: ['createdAt'],
      }

      const mock = generator.generateFromSchema('/test', 'GET', schema)
      expect(mock.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('should detect semantic field names', () => {
      const schema: OpenAPISchema = {
        type: 'object',
        properties: {
          userEmail: { type: 'string' },
          userId: { type: 'string' },
          phoneNumber: { type: 'string' },
        },
        required: ['userEmail', 'userId', 'phoneNumber'],
      }

      const mock = generator.generateFromSchema('/test', 'GET', schema)
      expect(mock.userEmail).toMatch(/@/)
      expect(mock.userId).toMatch(/^[0-9a-f-]+$/i)
      expect(mock.phoneNumber).toBeDefined()
    })
  })

  describe('complex schema handling', () => {
    it('should handle allOf', () => {
      const schema: OpenAPISchema = {
        allOf: [
          { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
          { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
        ],
      }

      const mock = generator.generateFromSchema('/test', 'GET', schema)
      expect(mock).toHaveProperty('id')
      expect(mock).toHaveProperty('name')
    })

    it('should handle oneOf', () => {
      const schema: OpenAPISchema = {
        oneOf: [
          { type: 'string' },
          { type: 'number' },
        ],
      }

      const mock = generator.generateFromSchema('/test', 'GET', schema)
      expect(['string', 'number']).toContain(typeof mock)
    })

    it('should handle enums', () => {
      const schema: OpenAPISchema = {
        type: 'string',
        enum: ['active', 'inactive', 'pending'],
      }

      const mock = generator.generateFromSchema('/test', 'GET', schema)
      expect(['active', 'inactive', 'pending']).toContain(mock)
    })
  })

  describe('edge cases', () => {
    it('should handle empty schema', () => {
      const mock = generator.generateFromSchema('/test', 'GET', {})
      expect(mock).toBeDefined()
    })

    it('should handle array type items', () => {
      const schema: OpenAPISchema = {
        type: 'object',
        properties: {
          items: { type: 'array', items: { type: 'string' } },
        },
        required: ['items'],
      }

      const mock = generator.generateFromSchema('/test', 'GET', schema)
      expect(mock.items).toBeDefined()
      expect(Array.isArray(mock.items)).toBe(true)
    })

    it('should handle additional properties', () => {
      const schema: OpenAPISchema = {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
        additionalProperties: true,
      }

      const mock = generator.generateFromSchema('/test', 'GET', schema)
      expect(mock).toHaveProperty('id')
    })

    it('should handle boolean type', () => {
      const schema: OpenAPISchema = {
        type: 'boolean',
      }

      const mock = generator.generateFromSchema('/test', 'GET', schema)
      expect(typeof mock).toBe('boolean')
    })
  })
})
