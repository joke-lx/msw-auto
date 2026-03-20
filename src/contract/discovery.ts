/**
 * OpenAPI 文档自动发现器
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import crypto from 'crypto'
import type { OpenAPISource, OpenAPISpec, SpecVersion } from '../types/index.js'

export interface DiscoveryOptions {
  projectPath: string
  backendUrl?: string
  timeout?: number
}

export class OpenAPIDiscovery {
  private readonly commonEndpoints = [
    '/api-docs',
    '/swagger.json',
    '/swagger/v1/swagger.json',
    '/openapi.json',
    '/api/openapi.json',
    '/v3/api-docs',
    '/v2/api-docs',
    '/docs/swagger.json',
    '/api-json',
  ]

  private readonly commonPaths = [
    'swagger.json',
    'swagger.yaml',
    'openapi.json',
    'openapi.yaml',
    'api-docs.json',
    'api-docs.yaml',
    '.swagger/swagger.json',
    '.swagger/openapi.json',
  ]

  /**
   * 自动发现项目中的 OpenAPI 文档
   */
  async discover(options: DiscoveryOptions): Promise<OpenAPISource[]> {
    const sources: OpenAPISource[] = []

    // 1. 检查运行中的后端服务
    const liveSources = await this.checkLiveEndpoints(options)
    sources.push(...liveSources)

    // 2. 检查静态文件
    const fileSources = this.checkStaticFiles(options.projectPath)
    sources.push(...fileSources)

    // 3. 检查配置文件
    const configSources = this.checkConfigFiles(options.projectPath)
    sources.push(...configSources)

    return sources
  }

  /**
   * 检查运行中的后端服务
   */
  private async checkLiveEndpoints(options: DiscoveryOptions): Promise<OpenAPISource[]> {
    const sources: OpenAPISource[] = []
    const serverUrl = options.backendUrl || await this.detectBackendUrl(options.projectPath)

    if (!serverUrl) {
      return sources
    }

    for (const endpoint of this.commonEndpoints) {
      try {
        const response = await fetch(`${serverUrl}${endpoint}`, {
          signal: AbortSignal.timeout(options.timeout || 5000),
          headers: {
            'Accept': 'application/json,application/swagger+json,application/vnd.oai.openapi',
          },
        })

        if (response.ok) {
          const spec = await response.json()
          const version = this.detectVersion(spec)

          if (version !== 'unknown') {
            sources.push({
              type: version,
              source: 'live',
              url: `${serverUrl}${endpoint}`,
              spec,
              timestamp: new Date().toISOString(),
              hash: this.generateHash(spec),
            })

            console.log(`✅ Found OpenAPI ${version} at: ${serverUrl}${endpoint}`)
            break // 找到一个就停止
          }
        }
      } catch {
        // 忽略连接错误，继续尝试下一个端点
        continue
      }
    }

    return sources
  }

  /**
   * 检查静态文件
   */
  private checkStaticFiles(projectPath: string): OpenAPISource[] {
    const sources: OpenAPISource[] = []

    for (const relativePath of this.commonPaths) {
      const fullPath = join(projectPath, relativePath)

      if (existsSync(fullPath)) {
        try {
          const content = readFileSync(fullPath, 'utf-8')
          const spec = this.parseContent(content)

          if (spec) {
            const version = this.detectVersion(spec)

            if (version !== 'unknown') {
              sources.push({
                type: version,
                source: 'file',
                path: fullPath,
                spec,
                timestamp: new Date().toISOString(),
                hash: this.generateHash(spec),
              })

              console.log(`✅ Found OpenAPI ${version} at: ${fullPath}`)
            }
          }
        } catch (error) {
          // 忽略解析错误
          continue
        }
      }
    }

    return sources
  }

  /**
   * 检查配置文件
   */
  private checkConfigFiles(projectPath: string): OpenAPISource[] {
    const sources: OpenAPISource[] = []

    // 检查 package.json 中的配置
    const packageJsonPath = join(projectPath, 'package.json')
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
        const config = packageJson.mswAuto

        if (config?.openApiUrl) {
          // 这个会在 live endpoints 检查时处理
        }

        if (config?.openApiPath) {
          const fullPath = join(projectPath, config.openApiPath)
          if (existsSync(fullPath)) {
            const content = readFileSync(fullPath, 'utf-8')
            const spec = this.parseContent(content)

            if (spec) {
              const version = this.detectVersion(spec)

              if (version !== 'unknown') {
                sources.push({
                  type: version,
                  source: 'config',
                  path: fullPath,
                  spec,
                  timestamp: new Date().toISOString(),
                  hash: this.generateHash(spec),
                })

                console.log(`✅ Found OpenAPI ${version} from config: ${fullPath}`)
              }
            }
          }
        }
      } catch {
        // 忽略错误
      }
    }

    return sources
  }

  /**
   * 检测后端 URL
   */
  private async detectBackendUrl(projectPath: string): Promise<string | null> {
    const defaultUrls = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8000',
      'http://localhost:8080',
      'http://127.0.0.1:3000',
    ]

    // 优先检查 package.json 配置
    const packageJsonPath = join(projectPath, 'package.json')
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
        const config = packageJson.mswAuto

        if (config?.backendUrl) {
          return config.backendUrl
        }
      } catch {
        // 忽略
      }
    }

    // 尝试检测哪个端口有服务运行
    for (const url of defaultUrls) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(1000),
        })
        if (response.ok || response.status === 404) {
          // 404 也说明服务器在运行，只是路径不对
          return url
        }
      } catch {
        continue
      }
    }

    return null
  }

  /**
   * 检测 OpenAPI 版本
   */
  detectVersion(spec: any): SpecVersion {
    if (!spec || typeof spec !== 'object') {
      return 'unknown'
    }

    if (spec.openapi) {
      const version = spec.openapi
      if (typeof version === 'string' && version.startsWith('3.')) {
        return 'openapi3'
      }
    }

    if (spec.swagger) {
      const version = spec.swagger
      if (typeof version === 'string' && version.startsWith('2.')) {
        return 'swagger2'
      }
    }

    return 'unknown'
  }

  /**
   * 解析内容
   */
  private parseContent(content: string): OpenAPISpec | null {
    try {
      // 尝试 JSON 解析
      return JSON.parse(content)
    } catch {
      // TODO: 支持 YAML 解析
      return null
    }
  }

  /**
   * 生成内容哈希
   */
  private generateHash(spec: OpenAPISpec): string {
    const content = JSON.stringify(spec)
    return crypto.createHash('sha256').update(content).digest('hex')
  }
}
