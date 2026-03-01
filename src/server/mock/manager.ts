import type { Database } from '../storage/database.js'
import crypto from 'crypto'

export interface Mock {
  id: string
  name: string
  method: string
  path: string
  status: number
  response: any
  headers?: Record<string, string>
  cookies?: Record<string, string>
  delay?: number
  enabled: boolean
  description?: string
  tags?: string[]
  version: number
  created_at: string
  updated_at: string
}

export interface CreateMockDto {
  name: string
  method: string
  path: string
  status?: number
  response: any
  headers?: Record<string, string>
  cookies?: Record<string, string>
  delay?: number
  enabled?: boolean
  description?: string
  tags?: string[]
}

export class MockManager {
  private mocks: Map<string, Mock> = new Map()
  private globalEnabled: boolean = true  // 全局开关，默认开启

  constructor(private database: Database) {
    this.loadMocks()
  }

  private async loadMocks() {
    try {
      const mocks = await this.database.getAllMocks()
      mocks.forEach((mock) => {
        this.mocks.set(mock.id, mock)
      })
    } catch (error) {
      console.log('[MockManager] Using in-memory storage')
    }
  }

  async create(dto: CreateMockDto): Promise<Mock> {
    const mock: Mock = {
      id: `mock_${crypto.randomUUID()}`,
      name: dto.name,
      method: dto.method.toUpperCase(),
      path: dto.path,
      status: dto.status || 200,
      response: dto.response,
      headers: dto.headers,
      cookies: dto.cookies,
      delay: dto.delay || 0,
      enabled: dto.enabled !== false,
      description: dto.description,
      tags: dto.tags,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    this.mocks.set(mock.id, mock)

    try {
      await this.database.saveMock(mock)
    } catch (error) {
      // Continue with in-memory storage
    }

    return mock
  }

  async update(id: string, updates: Partial<CreateMockDto>): Promise<Mock | null> {
    const existing = this.mocks.get(id)
    if (!existing) return null

    const updated: Mock = {
      ...existing,
      ...updates,
      method: updates.method?.toUpperCase() || existing.method,
      status: updates.status || existing.status,
      delay: updates.delay ?? existing.delay,
      enabled: updates.enabled ?? existing.enabled,
      updated_at: new Date().toISOString(),
      version: existing.version + 1,
    }

    this.mocks.set(id, updated)

    try {
      await this.database.updateMock(updated)
    } catch (error) {
      // Continue with in-memory storage
    }

    return updated
  }

  async delete(id: string): Promise<boolean> {
    const existed = this.mocks.delete(id)

    if (existed) {
      try {
        await this.database.deleteMock(id)
      } catch (error) {
        // Continue with in-memory storage
      }
    }

    return existed
  }

  async findById(id: string): Promise<Mock | null> {
    return this.mocks.get(id) || null
  }

  async findAll(): Promise<Mock[]> {
    return Array.from(this.mocks.values())
  }

  async findEnabled(): Promise<Mock[]> {
    return Array.from(this.mocks.values()).filter((mock) => mock.enabled)
  }

  // 全局开关相关方法
  isGlobalEnabled(): boolean {
    return this.globalEnabled
  }

  setGlobalEnabled(enabled: boolean): void {
    this.globalEnabled = enabled
  }

  toggleGlobal(): boolean {
    this.globalEnabled = !this.globalEnabled
    return this.globalEnabled
  }

  findMatchingMock(method: string, path: string): Mock | null {
    // 全局开关关闭时，跳过所有 Mock
    if (!this.globalEnabled) {
      return null
    }

    const enabledMocks = Array.from(this.mocks.values()).filter((mock) => mock.enabled)

    for (const mock of enabledMocks) {
      if (this.isMatch(method, path, mock)) {
        return mock
      }
    }

    return null
  }

  private isMatch(method: string, path: string, mock: Mock): boolean {
    // Method check
    if (mock.method !== '*' && mock.method !== method.toUpperCase()) {
      return false
    }

    // Path matching with parameter support
    const mockPathParts = mock.path.split('/')
    const reqPathParts = path.split('?')[0].split('/')

    if (mockPathParts.length !== reqPathParts.length) {
      return false
    }

    for (let i = 0; i < mockPathParts.length; i++) {
      const mockPart = mockPathParts[i]
      const reqPart = reqPathParts[i]

      // Skip empty parts
      if (!mockPart && !reqPart) continue

      // Parameter matching (:id, :userId, etc.)
      if (mockPart.startsWith(':')) {
        continue
      }

      // Wildcard matching
      if (mockPart === '*') {
        continue
      }

      // Exact matching
      if (mockPart !== reqPart) {
        return false
      }
    }

    return true
  }

  async toggle(id: string): Promise<Mock | null> {
    const mock = this.mocks.get(id)
    if (!mock) return null

    return this.update(id, { enabled: !mock.enabled })
  }

  async duplicate(id: string): Promise<Mock | null> {
    const original = this.mocks.get(id)
    if (!original) return null

    return this.create({
      name: `${original.name} (copy)`,
      method: original.method,
      path: original.path,
      status: original.status,
      response: original.response,
      headers: original.headers,
      cookies: original.cookies,
      delay: original.delay,
      enabled: false,
      description: original.description,
      tags: original.tags,
    })
  }
}
