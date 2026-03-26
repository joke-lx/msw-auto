/**
 * 契约管理器
 * 管理所有 API 契约（OpenAPI/Swagger 文档）
 */

import crypto from 'crypto'
import { OpenAPIDiscovery } from '../../contract/discovery.js'
import { SchemaBasedMockGenerator } from '../../contract/mock-generator.js'
import { TypeScriptTypeGenerator } from '../../contract/type-generator.js'
import type { Database } from '../storage/database.js'
import type {
  Contract,
  OpenAPISpec,
  OpenAPISource,
  MockGenerationResult,
  TypeGenerationResult,
  ContractDiff,
} from '../types/index.js'

export interface CreateContractDto {
  name: string
  sourceType: 'live' | 'file' | 'config'
  sourceUrl?: string
  spec: OpenAPISpec
}

export interface DiscoverOptions {
  projectPath?: string
  backendUrl?: string
  port?: number
  swaggerPath?: string
}

export class ContractManager {
  private contracts: Map<string, Contract> = new Map()
  private readonly discovery: OpenAPIDiscovery
  private readonly mockGenerator: SchemaBasedMockGenerator
  private readonly typeGenerator: TypeScriptTypeGenerator

  constructor(private database: Database) {
    this.discovery = new OpenAPIDiscovery()
    this.mockGenerator = new SchemaBasedMockGenerator()
    this.typeGenerator = new TypeScriptTypeGenerator()
    this.loadContracts()
  }

  private async loadContracts() {
    try {
      const contracts = await this.database.getAllContracts()
      contracts.forEach((contract) => {
        this.contracts.set(contract.id, contract)
      })
    } catch (error) {
      console.log('[ContractManager] Using in-memory storage')
    }
  }

  /**
   * 获取所有契约
   */
  async findAll(): Promise<Contract[]> {
    return Array.from(this.contracts.values())
  }

  /**
   * 根据 ID 获取契约
   */
  async findById(id: string): Promise<Contract | null> {
    return this.contracts.get(id) || null
  }

  /**
   * 创建契约
   */
  async create(dto: CreateContractDto): Promise<Contract> {
    const hash = this.generateHash(dto.spec)

    const contract: Contract = {
      id: `contract_${crypto.randomUUID()}`,
      name: dto.name,
      sourceType: dto.sourceType,
      sourceUrl: dto.sourceUrl,
      version: this.detectVersion(dto.spec),
      spec: dto.spec,
      hash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    this.contracts.set(contract.id, contract)

    try {
      await this.database.saveContract(contract)
    } catch (error) {
      // Continue with in-memory storage
    }

    return contract
  }

  /**
   * 更新契约
   */
  async update(id: string, updates: Partial<CreateContractDto>): Promise<Contract | null> {
    const existing = this.contracts.get(id)
    if (!existing) return null

    const updated: Contract = {
      ...existing,
      ...updates,
      spec: updates.spec || existing.spec,
      hash: updates.spec ? this.generateHash(updates.spec) : existing.hash,
      updatedAt: new Date().toISOString(),
    }

    this.contracts.set(id, updated)

    try {
      await this.database.saveContract(updated)
    } catch (error) {
      // Continue with in-memory storage
    }

    return updated
  }

  /**
   * 删除契约
   */
  async delete(id: string): Promise<boolean> {
    const existed = this.contracts.has(id)
    this.contracts.delete(id)

    try {
      await this.database.deleteContract(id)
    } catch (error) {
      // Ignore
    }

    return existed
  }

  /**
   * 发现契约（自动发现项目中的 OpenAPI 文档）
   */
  async discover(options: DiscoverOptions): Promise<Contract[]> {
    const sources: OpenAPISource[] = await this.discovery.discover({
      projectPath: options.projectPath || process.cwd(),
      backendUrl: options.backendUrl,
      port: options.port,
      swaggerPath: options.swaggerPath,
    })

    const contracts: Contract[] = []

    for (const source of sources) {
      // 检查是否已存在相同内容的契约
      const existing = Array.from(this.contracts.values()).find(
        (c) => c.hash === source.hash
      )

      if (existing) {
        // 更新时间戳
        existing.lastSyncedAt = new Date().toISOString()
        contracts.push(existing)
        continue
      }

      // 创建新契约
      const name = this.generateContractName(source)
      const contract = await this.create({
        name,
        sourceType: source.source,
        sourceUrl: source.url,
        spec: source.spec,
      })

      contracts.push(contract)
    }

    return contracts
  }

  /**
   * 同步契约（重新获取最新内容）
   */
  async sync(id: string): Promise<Contract | null> {
    const contract = this.contracts.get(id)
    if (!contract) return null

    if (contract.sourceType === 'live' && contract.sourceUrl) {
      try {
        const response = await fetch(contract.sourceUrl)
        if (response.ok) {
          const spec = await response.json()
          return await this.update(id, { spec })
        }
      } catch (error) {
        console.error(`Failed to sync contract ${id}:`, error)
      }
    }

    return contract
  }

  /**
   * 生成 Mock 数据
   */
  generateMocks(
    contractId: string,
    endpoint?: string,
    method?: string
  ): MockGenerationResult[] {
    const contract = this.contracts.get(contractId)
    if (!contract) {
      throw new Error(`Contract not found: ${contractId}`)
    }

    const results: MockGenerationResult[] = []

    if (contract.spec.paths) {
      for (const [path, methods] of Object.entries(contract.spec.paths)) {
        if (endpoint && !this.matchPath(path, endpoint)) {
          continue
        }

        for (const [httpMethod, operation] of Object.entries(methods)) {
          if (method && httpMethod.toUpperCase() !== method.toUpperCase()) {
            continue
          }

          const schema = operation.responses?.['200']?.content?.['application/json']?.schema
          if (schema) {
            const mock = this.mockGenerator.generateFromSchema(
              path,
              httpMethod,
              schema
            )

            results.push({
              contractId,
              endpoint: path,
              method: httpMethod,
              mock,
              variants: {
                empty: this.generateEmptyMock(schema),
                error: this.generateErrorMock(),
              },
              generatedAt: new Date().toISOString(),
            })
          }
        }
      }
    }

    return results
  }

  /**
   * 生成 TypeScript 类型
   */
  generateTypes(contractId: string): TypeGenerationResult {
    const contract = this.contracts.get(contractId)
    if (!contract) {
      throw new Error(`Contract not found: ${contractId}`)
    }

    const types = this.typeGenerator.generateTypes(contract.spec)

    // 提取接口名称
    const interfaces: string[] = []
    if (contract.spec.components?.schemas) {
      interfaces.push(...Object.keys(contract.spec.components.schemas))
    }
    if (contract.spec.definitions) {
      interfaces.push(...Object.keys(contract.spec.definitions))
    }

    return {
      contractId,
      types,
      filePath: `src/types/api/${this.sanitizeName(contract.name)}.ts`,
      interfaces,
      generatedAt: new Date().toISOString(),
    }
  }

  /**
   * 比较两个契约的差异
   */
  diff(contractId: string, version1: number, version2: number): ContractDiff | null {
    // TODO: 实现版本对比
    return {
      added: [],
      removed: [],
      modified: [],
      breaking: false,
    }
  }

  /**
   * 检测 OpenAPI 版本
   */
  private detectVersion(spec: OpenAPISpec): 'openapi3' | 'swagger2' {
    if (spec.openapi) {
      return 'openapi3'
    }
    if (spec.swagger) {
      return 'swagger2'
    }
    return 'openapi3' // 默认
  }

  /**
   * 生成内容哈希
   */
  private generateHash(spec: OpenAPISpec): string {
    const content = JSON.stringify(spec)
    return crypto.createHash('sha256').update(content).digest('hex')
  }

  /**
   * 生成契约名称
   */
  private generateContractName(source: OpenAPISource): string {
    if (source.spec.info?.title) {
      return source.spec.info.title
    }

    if (source.url) {
      return new URL(source.url).hostname
    }

    if (source.path) {
      const parts = source.path.split(/[/\\]/)
      return parts[parts.length - 1] || 'API'
    }

    return 'API Contract'
  }

  /**
   * 清理名称用于文件路径
   */
  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  /**
   * 匹配路径
   */
  private pathMatch(pattern: string, path: string): boolean {
    // 简单的通配符匹配
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    )
    return regex.test(path)
  }

  /**
   * 生成空数组 Mock
   */
  private generateEmptyMock(schema: any): any {
    if (schema.type === 'array') {
      return []
    }
    return {}
  }

  /**
   * 生成错误 Mock
   */
  private generateErrorMock(): any {
    return {
      error: 'Internal Server Error',
      message: 'An error occurred',
      code: 500,
    }
  }
}
