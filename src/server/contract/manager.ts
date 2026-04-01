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
import type { AnalysisResult } from '../../mcp/ast/engine.js'
import { FrontendApiExtractor } from '../../mcp/ast/FrontendApiExtractor.js'
import { OpenApiPathMatcher } from '../../mcp/ast/matcher/OpenApiPathMatcher.js'
import { FieldValidator } from '../../mcp/ast/matcher/FieldValidator.js'
import type { ApiCall } from '../../mcp/ast/types/frontendApiCall.js'

export type VerificationStatus = 'matched' | 'missing' | 'typeMismatch' | 'methodMismatch' | 'uncovered'

export interface VerificationResult {
  method: string
  path: string
  status: VerificationStatus
  detail: string
  file?: string
  library?: string
}

/**
 * 新的验证响应结构（前端调用 vs 契约）
 */
export interface FrontendValidationResult {
  contractId: string
  status: 'done' | 'error'

  // 前端调了，契约也有
  matched: MatchedCall[]
  // 前端调了，但契约没有定义
  missing: MissingCall[]
  // 方法不匹配
  methodMismatch: MethodMismatchCall[]
  // 字段不匹配
  fieldMismatch: FieldMismatchCall[]

  // 契约定义了，但前端没调用
  uncovered: UncoveredEndpoint[]

  // 无法静态分析的调用（需要运行时验证）
  unknown: UnknownCall[]

  summary: ValidationSummary
  meta: ValidationMeta
  errors: { file: string; message: string }[]
  // 解析警告（如框架无法识别、文件跳过等）
  warnings: { file: string; library: string; message: string }[]
}

export interface MatchedCall {
  method: string
  path: string
  normalizedPath: string
  specPath: string
  file: string
  library: string
  line: number
}

export interface MissingCall {
  method: string
  path: string
  normalizedPath: string
  file: string
  library: string
  line: number
}

export interface MethodMismatchCall {
  method: string
  path: string
  frontendMethod: string
  specMethods: string[]
  file: string
  library: string
  line: number
}

export interface FieldMismatchCall {
  method: string
  path: string
  missingFields: string[]
  extraFields: string[]
  file: string
  library: string
  line: number
}

export interface UncoveredEndpoint {
  method: string
  path: string
  operationId?: string
  missing: 'not_called' | 'partially_called'
}

export interface UnknownCall {
  method: string
  rawPath: string
  file: string
  library: string
  line: number
  reason: string
}

export interface ValidationSummary {
  total: number
  matched: number
  missing: number
  methodMismatch: number
  fieldMismatch: number
  uncovered: number
  unknown: number
}

export interface ValidationMeta {
  filesScanned: number
  duration: number
  detectedLibraries: string[]
}

/**
 * @deprecated Use FrontendValidationResult
 */
export interface ValidationResponse {
  contractId: string
  status: 'done' | 'error'
  results: VerificationResult[]
  summary: {
    total: number
    matched: number
    missing: number
    typeMismatch: number
    methodMismatch: number
  }
  warnings: { file: string; framework: string; message: string }[]
}

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
   * 验证前端代码中的 API 调用是否符合契约
   */
  /**
   * 验证前端代码中的 API 调用是否符合契约
   *
   * @param contractId 契约 ID
   * @param frontendPath 前端代码目录路径
   * @returns 前端 API 调用与契约的对比结果
   */
  async validateFrontend(contractId: string, frontendPath: string): Promise<FrontendValidationResult> {
    const contract = this.contracts.get(contractId)
    if (!contract) {
      throw new Error('Contract not found')
    }

    if (!contract.spec?.paths) {
      throw new Error('Contract has no OpenAPI spec')
    }

    // 提取前端 API 调用
    const extractor = new FrontendApiExtractor()
    const extractResult = await extractor.extract(frontendPath)

    const specPaths = contract.spec.paths
    const pathMatcher = new OpenApiPathMatcher()
    const fieldValidator = new FieldValidator()

    // 展开 spec 中的所有端点
    const specEndpoints = pathMatcher.expandSpecPaths(specPaths)

    // 用于跟踪哪些契约端点被前端调用了
    const uncoveredEndpoints = new Map<string, UncoveredEndpoint>()
    for (const endpoint of specEndpoints) {
      uncoveredEndpoints.set(`${endpoint.method}:${endpoint.path}`, {
        method: endpoint.method,
        path: endpoint.path,
        operationId: endpoint.operationId,
        missing: 'not_called',
      })
    }

    // 对比结果
    const matched: MatchedCall[] = []
    const missing: MissingCall[] = []
    const methodMismatch: MethodMismatchCall[] = []
    const fieldMismatch: FieldMismatchCall[] = []
    const unknown: UnknownCall[] = []

    for (const call of extractResult.calls) {
      if (!call.staticallyResolved) {
        unknown.push({
          method: call.method,
          rawPath: call.rawPath,
          file: call.location.file,
          library: call.library,
          line: call.location.line,
          reason: call.unresolvedReason || 'dynamic path cannot be statically resolved',
        })
        continue
      }

      // 使用路径匹配器
      const matchResult = pathMatcher.match(call.rawPath, specPaths)

      if (!matchResult) {
        // 路径在 spec 中不存在
        missing.push({
          method: call.method,
          path: call.rawPath,
          normalizedPath: call.normalizedPath,
          file: call.location.file,
          library: call.library,
          line: call.location.line,
        })
        continue
      }

      // 检查 HTTP 方法
      const specMethods = this.getSpecMethods(matchResult.specPath, specPaths)
      const normalizedSpecMethod = call.method.toUpperCase()

      if (!specMethods.includes(normalizedSpecMethod)) {
        // 方法不匹配
        methodMismatch.push({
          method: matchResult.specPath,
          path: call.rawPath,
          frontendMethod: call.method,
          specMethods,
          file: call.location.file,
          library: call.library,
          line: call.location.line,
        })

        // 标记为已覆盖
        uncoveredEndpoints.delete(`${normalizedSpecMethod}:${matchResult.specPath}`)
        continue
      }

      // 匹配成功
      matched.push({
        method: call.method,
        path: call.rawPath,
        normalizedPath: call.normalizedPath,
        specPath: matchResult.specPath,
        file: call.location.file,
        library: call.library,
        line: call.location.line,
      })

      // 字段级校验
      const specEndpoint = specPaths[matchResult.specPath]?.[call.method.toLowerCase()]
      if (specEndpoint) {
        const fieldResult = fieldValidator.validateApiCall(call, specEndpoint)

        if (!fieldResult.valid || fieldResult.typeMismatch.length > 0) {
          fieldMismatch.push({
            method: call.method,
            path: call.rawPath,
            missingFields: fieldResult.missingFields.map((f) => f.name),
            extraFields: fieldResult.extraFields.map((f) => f.name),
            file: call.location.file,
            library: call.library,
            line: call.location.line,
          })
        }
      }

      // 标记为已覆盖
      uncoveredEndpoints.delete(`${call.method}:${matchResult.specPath}`)
    }

    // 收集未覆盖的端点
    const uncovered = Array.from(uncoveredEndpoints.values())

    const summary: ValidationSummary = {
      total: extractResult.calls.length,
      matched: matched.length,
      missing: missing.length,
      methodMismatch: methodMismatch.length,
      fieldMismatch: fieldMismatch.length,
      uncovered: uncovered.length,
      unknown: unknown.length,
    }

    return {
      contractId,
      status: 'done',
      matched,
      missing,
      methodMismatch,
      fieldMismatch,
      uncovered,
      unknown,
      summary,
      meta: {
        filesScanned: extractResult.meta.filesScanned,
        duration: extractResult.meta.duration,
        detectedLibraries: extractResult.meta.detectedLibraries,
      },
      errors: extractResult.errors.map((e) => ({ file: e.file, message: e.message })),
      warnings: extractResult.warnings.map((w) => ({ file: w.file, library: w.library, message: w.message })),
    }
  }

  /**
   * @deprecated Use validateFrontend instead
   */
  validate(contractId: string, analysisResult: AnalysisResult): ValidationResponse {
    const contract = this.contracts.get(contractId)
    if (!contract) {
      throw new Error('Contract not found')
    }

    if (!contract.spec?.paths) {
      throw new Error('Contract has no OpenAPI spec')
    }

    const specPaths = contract.spec.paths
    const results: VerificationResult[] = []
    let matched = 0
    let missing = 0
    let typeMismatch = 0
    let methodMismatch = 0

    for (const route of analysisResult.routes) {
      const specPath = specPaths[route.path]
      let status: VerificationStatus
      let detail = ''

      if (!specPath) {
        // 路径在 spec 中不存在
        status = 'missing'
        detail = `路径 ${route.path} 在契约中不存在`
        missing++
      } else {
        // 检查方法
        const specMethod = specPath[route.method.toLowerCase()]
        if (!specMethod) {
          // 方法不匹配
          status = 'methodMismatch'
          const availableMethods = Object.keys(specPath)
            .filter((m) => ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(m))
          detail = `方法 ${route.method} 不支持，可用的方法: ${availableMethods.join(', ')}`
          methodMismatch++
        } else {
          status = 'matched'
          detail = `匹配 ${route.method} ${route.path}`
          matched++
        }
      }

      results.push({
        method: route.method,
        path: route.path,
        status,
        detail,
        file: route.file,
      })
    }

    // 从 analysisResult.errors 中提取 warnings
    const warnings: { file: string; framework: string; message: string }[] = []

    return {
      contractId,
      status: 'done',
      results,
      summary: {
        total: analysisResult.routes.length,
        matched,
        missing,
        typeMismatch,
        methodMismatch,
      },
      warnings,
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
   * 获取 spec 中某个路径支持的所有 HTTP 方法
   */
  private getSpecMethods(path: string, specPaths: Record<string, any>): string[] {
    const pathSpec = specPaths[path]
    if (!pathSpec) return []

    const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']
    const methods: string[] = []

    for (const method of httpMethods) {
      if (pathSpec[method.toLowerCase()]) {
        methods.push(method)
      }
    }

    return methods
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
