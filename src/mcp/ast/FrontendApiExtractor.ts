/**
 * 前端 API 调用提取器
 *
 * 静态分析前端代码，提取所有 HTTP 调用
 * 支持: fetch, axios, ky, react-query, swr, vueuse, umi-request, taro-request 等
 */

import * as parser from '@babel/parser'
import * as traverseModule from '@babel/traverse'
import * as t from '@babel/types'
import * as fs from 'fs'
import * as path from 'path'

import type { ApiCall, FrontendApiExtractorResult, DetectedLibrary } from './types/frontendApiCall'
import { FetchDetector } from './detectors/FetchDetector'
import { AxiosDetector } from './detectors/AxiosDetector'
import { ReactQueryDetector } from './detectors/ReactQueryDetector'
import { SWRDetector } from './detectors/SWRDetector'
import type { BaseDetector } from './detectors/BaseDetector'
import { MonorepoDetector } from './utils/MonorepoDetector'

const traverse = (traverseModule as any).default?.default || (traverseModule as any).default || traverseModule

export interface FrontendExtractorOptions {
  /** 扫描的文件扩展名 */
  extensions?: string[]
  /** 最大文件数 */
  maxFiles?: number
  /** 最大递归深度 */
  maxDepth?: number
  /** 是否跳过 node_modules */
  skipNodeModules?: boolean
}

const DEFAULT_OPTIONS: Required<FrontendExtractorOptions> = {
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs'],
  maxFiles: 5000,
  maxDepth: 20,
  skipNodeModules: true,
}

/**
 * 前端 API 调用提取器
 *
 * @example
 * const extractor = new FrontendApiExtractor()
 * const result = await extractor.extract('/path/to/frontend')
 * console.log(result.calls) // 所有提取到的 API 调用
 */
export class FrontendApiExtractor {
  private detectors: BaseDetector[] = []
  private options: Required<FrontendExtractorOptions>

  constructor(options: FrontendExtractorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }

    // 初始化所有检测器
    this.detectors = [
      new FetchDetector(),
      new AxiosDetector(),
      new ReactQueryDetector(),
      new SWRDetector(),
    ]
  }

  /**
   * 添加自定义检测器
   */
  addDetector(detector: BaseDetector): void {
    this.detectors.push(detector)
  }

  /**
   * 提取目录中的所有前端 API 调用
   */
  async extract(dirPath: string): Promise<FrontendApiExtractorResult> {
    const startTime = Date.now()
    const allCalls: ApiCall[] = []
    const allErrors: { file: string; message: string; line?: number }[] = []
    const allWarnings: { file: string; library: DetectedLibrary; message: string }[] = []
    const unsupportedFiles: string[] = []
    const detectedLibrariesSet = new Set<DetectedLibrary>()

    let filesScanned = 0

    // 检测 monorepo
    const monorepoDetector = new MonorepoDetector()
    const monorepoInfo = monorepoDetector.detect(dirPath)

    // 确定要扫描的根目录列表
    const scanRoots: string[] = []
    if (monorepoInfo.type) {
      // monorepo: 扫描所有包
      scanRoots.push(...monorepoInfo.packages)
    } else {
      // 非 monorepo: 只扫描给定目录
      scanRoots.push(dirPath)
    }

    const scanDir = async (currentPath: string, depth: number): Promise<void> => {
      if (filesScanned >= this.options.maxFiles) return
      if (depth > this.options.maxDepth) return

      try {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true })

        for (const entry of entries) {
          if (filesScanned >= this.options.maxFiles) break

          const fullPath = path.join(currentPath, entry.name)

          // 跳过 node_modules
          if (this.options.skipNodeModules && entry.name === 'node_modules') continue
          // 跳过 .git
          if (entry.name === '.git') continue
          // 跳过 dist/build 等输出目录
          if (['dist', 'build', '.next', '.nuxt', 'coverage', 'out'].includes(entry.name)) continue

          if (entry.isDirectory()) {
            await scanDir(fullPath, depth + 1)
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase()
            if (!this.options.extensions.includes(ext)) continue

            filesScanned++

            try {
              const result = await this.analyzeFile(fullPath)

              // 记录检测到的库
              for (const lib of result.meta.detectedLibraries) {
                detectedLibrariesSet.add(lib)
              }

              // 收集 API 调用
              allCalls.push(...result.calls)

              // 收集错误
              allErrors.push(...result.errors)

              // 收集警告
              allWarnings.push(...result.warnings)

              // 收集无法处理的文件
              unsupportedFiles.push(...result.meta.unsupportedFiles)
            } catch (error: any) {
              allErrors.push({
                file: fullPath,
                message: error instanceof Error ? error.message : String(error),
              })
            }
          }
        }
      } catch (error: any) {
        allErrors.push({
          file: currentPath,
          message: `Failed to scan directory: ${error instanceof Error ? error.message : String(error)}`,
        })
      }
    }

    // 扫描所有根目录
    for (const root of scanRoots) {
      await scanDir(root, 0)
    }

    // 去重（同一个调用可能在多个地方被检测到）
    const uniqueCalls = this.deduplicateCalls(allCalls)

    return {
      calls: uniqueCalls,
      errors: allErrors,
      warnings: allWarnings,
      meta: {
        filesScanned,
        duration: Date.now() - startTime,
        detectedLibraries: Array.from(detectedLibrariesSet),
        unsupportedFiles,
        monorepoType: monorepoInfo.type,
        packagesScanned: monorepoInfo.type ? monorepoInfo.packages.length : 0,
      },
    }
  }

  /**
   * 分析单个文件
   */
  async analyzeFile(filePath: string): Promise<FrontendApiExtractorResult> {
    const calls: ApiCall[] = []
    const errors: { file: string; message: string; line?: number }[] = []
    const warnings: { file: string; library: DetectedLibrary; message: string }[] = []
    const detectedLibraries: DetectedLibrary[] = []
    const unsupportedFiles: string[] = []

    try {
      const code = fs.readFileSync(filePath, 'utf-8')

      // 快速检测：跳过明显不包含 API 调用的文件
      if (!this.quickCheck(code)) {
        unsupportedFiles.push(filePath)
        return { calls, errors, warnings, meta: { filesScanned: 1, duration: 0, detectedLibraries: [], unsupportedFiles } }
      }

      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: [
          'typescript',
          'jsx',
          'tsx',
          'decorators-legacy',
          'classProperties',
          'objectRestSpread',
          'asyncGenerators',
          'dynamicImport',
        ],
        errorRecovery: true,
      })

      // 收集变量值（用于常量折叠）
      const variableValues = this.collectVariables(ast)

      // 收集所有 API 调用
      const extractedCalls = this.extractCallsFromAST(ast, filePath, variableValues)
      calls.push(...extractedCalls)

      // 检测使用的库
      for (const detector of this.detectors) {
        if (detector.matchesFile(filePath, code)) {
          if (!detectedLibraries.includes(detector.name)) {
            detectedLibraries.push(detector.name)
          }
        }
      }

      // 如果没有检测到任何库但文件有 API 调用模式，记录警告
      if (calls.length > 0 && detectedLibraries.length === 0) {
        warnings.push({
          file: filePath,
          library: 'unknown',
          message: '检测到 API 调用但无法识别具体库',
        })
      }
    } catch (error: any) {
      errors.push({
        file: filePath,
        message: `Parse error: ${error instanceof Error ? error.message : String(error)}`,
      })
    }

    return {
      calls,
      errors,
      warnings,
      meta: {
        filesScanned: 1,
        duration: 0,
        detectedLibraries,
        unsupportedFiles,
      },
    }
  }

  /**
   * 快速检查文件是否可能包含 API 调用
   */
  private quickCheck(code: string): boolean {
    // 检查是否包含常见 HTTP 相关关键字
    const httpKeywords = [
      'fetch(',
      'axios',
      'useQuery',
      'useMutation',
      'useSWR',
      'ky(',
      'request(',
      'http.',
      'XMLHttpRequest',
      'XMLHttpRequest',
    ]

    return httpKeywords.some((keyword) => code.includes(keyword))
  }

  /**
   * 收集变量值（常量折叠）
   */
  private collectVariables(ast: t.File): Map<string, any> {
    const variableValues = new Map<string, any>()

    traverse(ast, {
      VariableDeclarator: (path) => {
        const { id, init } = path.node

        if (t.isIdentifier(id) && init) {
          const value = this.evaluateInitExpression(init)
          if (value !== undefined) {
            variableValues.set(id.name, value)
          }
        }
      },

      // 也收集 const 声明的枚举
      TSTypeAliasDeclaration: () => {
        // 跳过 TypeScript 类型声明
      },
    })

    return variableValues
  }

  /**
   * 估算初始表达式的值
   */
  private evaluateInitExpression(node: t.Expression): any {
    if (t.isStringLiteral(node)) return node.value
    if (t.isNumericLiteral(node)) return node.value
    if (t.isBooleanLiteral(node)) return node.value
    if (t.isNullLiteral(node)) return null
    if (t.isTemplateLiteral(node)) {
      if (node.expressions.length === 0) {
        return node.quasis[0].value.cooked
      }
    }
    // 复杂表达式无法静态求值
    return undefined
  }

  /**
   * 从 AST 中提取所有 API 调用
   */
  private extractCallsFromAST(
    ast: t.File,
    filePath: string,
    variableValues: Map<string, any>
  ): ApiCall[] {
    const calls: ApiCall[] = []
    const context = { filePath, variableValues }

    traverse(ast, {
      CallExpression: (callPath) => {
        const callNode = callPath.node

        // 尝试每个检测器
        for (const detector of this.detectors) {
          try {
            const call = detector.extractCall(callNode, context)
            if (call) {
              calls.push(call)
              // 一个 CallExpression 只有一个库，不继续尝试其他检测器
              break
            }
          } catch (error) {
            // 单个检测器出错不影响其他检测器
            console.error(`[FrontendApiExtractor] Detector ${detector.name} error:`, error)
          }
        }
      },
    })

    return calls
  }

  /**
   * 对 API 调用进行去重
   * 同一个 URL + method 的调用可能在多个地方被检测到（如 useQuery 和直接 fetch）
   */
  private deduplicateCalls(calls: ApiCall[]): ApiCall[] {
    const seen = new Map<string, ApiCall>()

    for (const call of calls) {
      const key = `${call.method}:${call.rawPath}:${call.location.file}`

      // 保留第一个遇到的，或者保留静态解析成功的
      const existing = seen.get(key)
      if (!existing || (!existing.staticallyResolved && call.staticallyResolved)) {
        seen.set(key, call)
      }
    }

    return Array.from(seen.values())
  }

  /**
   * 获取统计信息
   */
  getStats(calls: ApiCall[]): {
    byMethod: Record<string, number>
    byLibrary: Record<string, number>
    staticallyResolved: number
    dynamicallyResolved: number
  } {
    const byMethod: Record<string, number> = {}
    const byLibrary: Record<string, number> = {}
    let staticallyResolved = 0
    let dynamicallyResolved = 0

    for (const call of calls) {
      byMethod[call.method] = (byMethod[call.method] || 0) + 1
      byLibrary[call.library] = (byLibrary[call.library] || 0) + 1

      if (call.staticallyResolved) {
        staticallyResolved++
      } else {
        dynamicallyResolved++
      }
    }

    return { byMethod, byLibrary, staticallyResolved, dynamicallyResolved }
  }
}
