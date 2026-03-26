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
  port?: number
  swaggerPath?: string
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
    let serverUrl: string

    if (options.backendUrl) {
      // Parse the URL and rebuild with the provided port
      try {
        const url = new URL(options.backendUrl)
        if (options.port) {
          url.port = String(options.port)
        }
        serverUrl = url.origin
      } catch {
        // If URL parsing fails, fall back to simple string manipulation
        serverUrl = `${options.backendUrl.replace(/\/$/, '')}:${options.port || 80}`
      }
    } else {
      serverUrl = await this.detectBackendUrl(options.projectPath, options.port)
    }

    if (!serverUrl) {
      return sources
    }

    // 如果提供了自定义 swaggerPath，直接使用它
    if (options.swaggerPath) {
      try {
        const response = await fetch(`${serverUrl}${options.swaggerPath}`, {
          signal: AbortSignal.timeout(options.timeout || 5000),
          headers: {
            'Accept': 'application/json,application/swagger+json,application/vnd.oai.openapi',
          },
        })

        if (response.ok) {
          const contentType = response.headers.get('content-type') || ''
          const text = await response.text()

          // HTML 页面需要额外处理
          if (contentType.includes('text/html') || text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
            // 尝试从 swagger-ui-init.js 提取
            const specFromInit = await this.extractSpecFromSwaggerInit(serverUrl, options.swaggerPath)
            if (specFromInit) {
              const version = this.detectVersion(specFromInit)
              if (version !== 'unknown') {
                sources.push({
                  type: version,
                  source: 'live',
                  url: `${serverUrl}${options.swaggerPath}`,
                  spec: specFromInit,
                  timestamp: new Date().toISOString(),
                  hash: this.generateHash(specFromInit),
                })
                console.log(`✅ Found OpenAPI ${version} from swagger-ui-init.js`)
                return sources
              }
            }
            // 尝试从 HTML 直接提取
            const specFromHtml = this.extractSwaggerDocFromHtml(text)
            if (specFromHtml) {
              const version = this.detectVersion(specFromHtml)
              if (version !== 'unknown') {
                sources.push({
                  type: version,
                  source: 'live',
                  url: `${serverUrl}${options.swaggerPath}`,
                  spec: specFromHtml,
                  timestamp: new Date().toISOString(),
                  hash: this.generateHash(specFromHtml),
                })
                console.log(`✅ Found OpenAPI ${version} from HTML at: ${serverUrl}${options.swaggerPath}`)
                return sources
              }
            }
          } else {
            // JSON 响应
            try {
              const spec = JSON.parse(text)
              const version = this.detectVersion(spec)
              if (version !== 'unknown') {
                sources.push({
                  type: version,
                  source: 'live',
                  url: `${serverUrl}${options.swaggerPath}`,
                  spec,
                  timestamp: new Date().toISOString(),
                  hash: this.generateHash(spec),
                })
                console.log(`✅ Found OpenAPI ${version} at: ${serverUrl}${options.swaggerPath}`)
                return sources
              }
            } catch {
              // 忽略
            }
          }
        }
      } catch {
        // 自定义路径失败后，尝试 fallback 到 commonEndpoints
      }
    }

    // 默认：遍历 commonEndpoints
    for (const endpoint of this.commonEndpoints) {
      try {
        const response = await fetch(`${serverUrl}${endpoint}`, {
          signal: AbortSignal.timeout(options.timeout || 5000),
          headers: {
            'Accept': 'application/json,application/swagger+json,application/vnd.oai.openapi',
          },
        })

        if (response.ok) {
          const contentType = response.headers.get('content-type') || ''
          const text = await response.text()

          // 如果返回的是 HTML，尝试从中提取 swaggerDoc
          if (contentType.includes('text/html') || text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
            // 先尝试从 swagger-ui-init.js 提取
            const specFromInit = await this.extractSpecFromSwaggerInit(serverUrl, endpoint)
            if (specFromInit) {
              const version = this.detectVersion(specFromInit)
              if (version !== 'unknown') {
                sources.push({
                  type: version,
                  source: 'live',
                  url: `${serverUrl}${endpoint}`,
                  spec: specFromInit,
                  timestamp: new Date().toISOString(),
                  hash: this.generateHash(specFromInit),
                })
                console.log(`✅ Found OpenAPI ${version} from swagger-ui-init.js`)
                return sources
              }
            }

            const specFromHtml = this.extractSwaggerDocFromHtml(text)
            if (specFromHtml) {
              const version = this.detectVersion(specFromHtml)
              if (version !== 'unknown') {
                sources.push({
                  type: version,
                  source: 'live',
                  url: `${serverUrl}${endpoint}`,
                  spec: specFromHtml,
                  timestamp: new Date().toISOString(),
                  hash: this.generateHash(specFromHtml),
                })
                console.log(`✅ Found OpenAPI ${version} from HTML at: ${serverUrl}${endpoint}`)
                return sources
              }
            }
            continue
          }

          // 尝试解析为 JSON
          try {
            const spec = JSON.parse(text)
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
          } catch {
            continue
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
   * 从 swagger-ui-init.js 提取 spec
   */
  private async extractSpecFromSwaggerInit(baseUrl: string, swaggerPath: string): Promise<OpenAPISpec | null> {
    // 构建 swagger-ui-init.js 的 URL
    const initUrl = `${baseUrl}${swaggerPath.replace(/\/$/, '')}/swagger-ui-init.js`
    try {
      const response = await fetch(initUrl, {
        signal: AbortSignal.timeout(5000),
      })
      if (response.ok) {
        const text = await response.text()
        return this.extractSwaggerDocFromHtml(text)
      }
    } catch {
      // 忽略
    }
    return null
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
  private async detectBackendUrl(projectPath: string, port?: number): Promise<string | null> {
    // 如果指定了端口，只检测该端口
    const defaultUrls = port
      ? [`http://localhost:${port}`, `http://127.0.0.1:${port}`]
      : [
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
   * 从 HTML 页面中提取 swaggerDoc 对象
   */
  private extractSwaggerDocFromHtml(html: string): OpenAPISpec | null {
    // 策略1: 查找 var options = { "swaggerDoc": { ... } } 形式
    // 这种格式的 swagger-ui-init.js 使用 var options 包裹
    const optionsMatch = html.match(/var\s+options\s*=\s*(\{[\s\S]*?\})\s*;/)
    if (optionsMatch && optionsMatch[1]) {
      try {
        const optionsObj = JSON.parse(optionsMatch[1])
        if (optionsObj.swaggerDoc && (optionsObj.swaggerDoc.openapi || optionsObj.swaggerDoc.swagger)) {
          return optionsObj.swaggerDoc
        }
      } catch {
        // 忽略
      }
    }

    // 策略2: 查找 window.swaggerDoc = { ... }
    const windowMatch = html.match(/window\.swaggerDoc\s*=\s*\{([\s\S]*?)\}\s*;/)
    if (windowMatch && windowMatch[1]) {
      try {
        const spec = JSON.parse('{' + windowMatch[1] + '}')
        if (spec && (spec.openapi || spec.swagger)) {
          return spec
        }
      } catch {
        // 忽略
      }
    }

    // 策略3: 使用括号计数法提取 "swaggerDoc": { ... }
    const swaggerDocIndex = html.indexOf('"swaggerDoc"')
    if (swaggerDocIndex === -1) {
      return null
    }

    // 找到 "swaggerDoc" 后面的 { 位置
    let braceStart = -1
    for (let i = swaggerDocIndex; i < html.length; i++) {
      if (html[i] === ':') {
        // 跳过冒号后的空白
        let j = i + 1
        while (j < html.length && (html[j] === ' ' || html[j] === '\t' || html[j] === '\n')) j++
        if (html[j] === '{') {
          braceStart = j
          break
        }
      }
    }

    if (braceStart === -1) return null

    // 括号计数找到匹配的 }
    let braceCount = 1
    let endPos = braceStart + 1
    while (endPos < html.length && braceCount > 0) {
      if (html[endPos] === '{') braceCount++
      else if (html[endPos] === '}') braceCount--
      endPos++
    }

    if (braceCount !== 0) return null

    const swaggerDocJson = html.substring(braceStart, endPos)
    try {
      const spec = JSON.parse(swaggerDocJson)
      if (spec && (spec.openapi || spec.swagger)) {
        return spec
      }
    } catch {
      // 忽略
    }

    return null
  }

  /**
   * 生成内容哈希
   */
  private generateHash(spec: OpenAPISpec): string {
    const content = JSON.stringify(spec)
    return crypto.createHash('sha256').update(content).digest('hex')
  }
}
