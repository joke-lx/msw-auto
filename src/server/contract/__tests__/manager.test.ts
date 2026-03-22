/**
 * Contract Manager 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ContractManager } from '../../../contract/manager.js'
import { Database } from '../../storage/database.js'

// Mock Database
vi.mock('../../storage/database.js', () => ({
  Database: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    getAllContracts: vi.fn().mockResolvedValue([]),
    saveContract: vi.fn().mockResolvedValue(undefined),
    deleteContract: vi.fn().mockResolvedValue(undefined),
  })),
}))

describe('ContractManager', () => {
  let manager: ContractManager
  let mockDatabase: Database

  beforeEach(() => {
    mockDatabase = new Database(':memory:')
    manager = new ContractManager(mockDatabase)
  })

  describe('findAll', () => {
    it('should return empty array initially', async () => {
      const contracts = await manager.findAll()
      expect(contracts).toEqual([])
    })

    it('should return all contracts', async () => {
      const mockContract = {
        id: 'test-1',
        name: 'Test API',
        sourceType: 'file' as const,
        version: 'openapi3' as const,
        spec: { openapi: '3.0.0', info: { title: 'Test' } },
        hash: 'abc123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      vi.spyOn(mockDatabase, 'getAllContracts').mockResolvedValue([mockContract])

      const contracts = await manager.findAll()
      expect(contracts).toHaveLength(1)
      expect(contracts[0].name).toBe('Test API')
    })
  })

  describe('create', () => {
    it('should create a new contract', async () => {
      const dto = {
        name: 'New API',
        sourceType: 'live' as const,
        sourceUrl: 'https://api.example.com/openapi.json',
        spec: {
          openapi: '3.0.0',
          info: { title: 'New API', version: '1.0.0' },
          paths: {},
        },
      }

      const contract = await manager.create(dto)

      expect(contract.id).toBeDefined()
      expect(contract.name).toBe('New API')
      expect(contract.sourceType).toBe('live')
      expect(contract.hash).toBeDefined()
    })

    it('should generate hash from spec', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
      }

      const dto = {
        name: 'Hash Test',
        sourceType: 'file' as const,
        spec,
      }

      const contract = await manager.create(dto)
      expect(contract.hash).toMatch(/^[a-f0-9]{64}$/) // SHA-256 hex
    })
  })

  describe('delete', () => {
    it('should delete existing contract', async () => {
      const dto = {
        name: 'To Delete',
        sourceType: 'file' as const,
        spec: { openapi: '3.0.0', info: { title: 'Test' }, paths: {} },
      }

      const contract = await manager.create(dto)
      const deleted = await manager.delete(contract.id)

      expect(deleted).toBe(true)
    })

    it('should return false for non-existent contract', async () => {
      const deleted = await manager.delete('non-existent')
      expect(deleted).toBe(false)
    })
  })

  describe('extractEndpoints', () => {
    it('should extract endpoints from OpenAPI spec', async () => {
      const dto = {
        name: 'API with Endpoints',
        sourceType: 'file' as const,
        spec: {
          openapi: '3.0.0',
          info: { title: 'Test' },
          paths: {
            '/users': {
              get: {
                summary: 'List users',
                responses: { '200': { description: 'OK' } },
              },
              post: {
                summary: 'Create user',
                responses: { '201': { description: 'Created' } },
              },
            },
            '/users/{id}': {
              get: {
                summary: 'Get user',
                responses: { '200': { description: 'OK' } },
              },
            },
          },
        },
      }

      await manager.create(dto)
      const contracts = await manager.findAll()
      const contract = contracts[0]

      // Test the internal method via reflection or public API
      const endpoints = (manager as any).extractEndpoints(contract)

      expect(endpoints).toHaveLength(3)
      expect(endpoints).toContainEqual({
        path: '/users',
        method: 'GET',
        summary: 'List users',
        hasResponse: true,
      })
    })
  })

  describe('version detection', () => {
    it('should detect OpenAPI 3.x', async () => {
      const dto = {
        name: 'OpenAPI 3',
        sourceType: 'file' as const,
        spec: { openapi: '3.0.0', info: { title: 'Test' }, paths: {} },
      }

      const contract = await manager.create(dto)
      expect(contract.version).toBe('openapi3')
    })

    it('should detect Swagger 2.0', async () => {
      const dto = {
        name: 'Swagger 2',
        sourceType: 'file' as const,
        spec: { swagger: '2.0', info: { title: 'Test' }, paths: {} },
      }

      const contract = await manager.create(dto)
      expect(contract.version).toBe('swagger2')
    })
  })
})
