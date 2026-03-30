/**
 * OpenAPI 文档自动发现器
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import crypto from 'crypto'
import type { OpenAPISource, OpenAPISpec, SpecVersion } from '../types/index.js'

// 正则表达式匹配 HTML 中的 OpenAPI URL
const SWAGGER_LINK_REGEX = /<link[^>]*rel=["']api正式文档["'][^>]*href=["']([^"']+)["'][^>]*>/i
const SWAGGER_LINK_REGEX_ALT = /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']api正式文档["'][^>]*>/i
const SWAGGER_URL_REGEX = /url\s*:\s*["']([^"']+)["']/
const SWAGGER_UIBUNDLE_REGEX = /SwaggerUIBundle\(\s*\{[^}]*url\s*:\s*["']([^"']+)["']/

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

    // 构建 serverUrl：优先使用 backendUrl，如果提供了 port 则合并
    let serverUrl: string | null = null
    if (options.backendUrl) {
      // 如果 backendUrl 不包含端口且提供了 port，则合并
      try {
        const url = new URL(options.backendUrl)
        if (!url.port && options.port) {
          url.port = options.port.toString()
        }
        serverUrl = `${url.protocol}//${url.host}`
      } catch {
        // backendUrl 不是有效 URL，使用它作为基础
        serverUrl = options.backendUrl
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
        // 处理尾部斜杠：如果 swaggerPath 没有斜杠但服务器重定向有，则补充
        let swaggerPath = options.swaggerPath
        if (!swaggerPath.endsWith('/')) {
          // 尝试带尾部斜杠的版本
          const responseWithSlash = await fetch(`${serverUrl}${swaggerPath}/`, {
            signal: AbortSignal.timeout(options.timeout || 5000),
            headers: {
              'Accept': 'application/json,application/swagger+json,application/vnd.oai.openapi',
            },
          })

          if (responseWithSlash.ok) {
            const contentType = responseWithSlash.headers.get('content-type') || ''
            if (contentType.includes('json')) {
              const spec = await responseWithSlash.json()
              const version = this.detectVersion(spec)
              if (version !== 'unknown') {
                sources.push({
                  type: version,
                  source: 'live',
                  url: `${serverUrl}${swaggerPath}/`,
                  spec,
                  timestamp: new Date().toISOString(),
                  hash: this.generateHash(spec),
                })
                console.log(`✅ Found OpenAPI ${version} at: ${serverUrl}${swaggerPath}/`)
                return sources
              }
            }
          }
        }

        // 尝试不带尾部斜杠的版本
        const response = await fetch(`${serverUrl}${swaggerPath}`, {
          signal: AbortSignal.timeout(options.timeout || 5000),
          headers: {
            'Accept': 'application/json,application/swagger+json,application/vnd.oai.openapi',
          },
        })

        if (response.ok) {
          const contentType = response.headers.get('content-type') || ''

          if (contentType.includes('json')) {
            const spec = await response.json()
            const version = this.detectVersion(spec)

            if (version !== 'unknown') {
              sources.push({
                type: version,
                source: 'live',
                url: `${serverUrl}${swaggerPath}`,
                spec,
                timestamp: new Date().toISOString(),
                hash: this.generateHash(spec),
              })

              console.log(`✅ Found OpenAPI ${version} at: ${serverUrl}${swaggerPath}`)
              return sources
            }
          } else if (contentType.includes('html')) {
            // HTML 页面，尝试解析其中的 OpenAPI URL 或内联规范
            const html = await response.text()
            const result = await this.extractOpenApiFromHtml(html, serverUrl)

            if (result) {
              let spec = result.spec
              let url = result.url

              // 如果 spec 为空，需要从 URL 获取
              if (!spec) {
                console.log(`🔍 Found OpenAPI URL in HTML: ${url}`)
                const jsonResponse = await fetch(url, {
                  signal: AbortSignal.timeout(options.timeout || 5000),
                  headers: { 'Accept': 'application/json' },
                })

                if (!jsonResponse.ok) {
                  // 获取 JSON 失败，尝试 commonEndpoints
                  // 不使用 continue，而是让代码继续到 commonEndpoints
                } else {
                  spec = await jsonResponse.json()
                }
              } else {
                console.log(`🔍 Found inline OpenAPI spec in HTML from: ${url}`)
              }

              if (spec) {
                const version = this.detectVersion(spec)

                if (version !== 'unknown') {
                  sources.push({
                    type: version,
                    source: 'live',
                    url,
                    spec,
                    timestamp: new Date().toISOString(),
                    hash: this.generateHash(spec),
                  })

                  console.log(`✅ Found OpenAPI ${version} at: ${url}`)
                  return sources
                }
              }
            }
          } else {
            console.log(`⚠️  Unexpected content-type: ${contentType} from ${serverUrl}${swaggerPath}`)
          }
        }
      } catch (error) {
        console.log(`❌ Failed to fetch from ${serverUrl}${options.swaggerPath}:`, error)
        // 自定义路径失败后，尝试 fallback 到 commonEndpoints
      }
    }

    // 如果 swaggerPath 已经成功找到并返回，不会执行到这里
    // 如果 swaggerPath 失败或未提供，使用 commonEndpoints

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

          if (contentType.includes('json')) {
            // 直接返回 JSON
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
              break
            }
          } else if (contentType.includes('html')) {
            // HTML 页面，尝试解析其中的 OpenAPI URL 或内联规范
            const html = await response.text()
            const result = await this.extractOpenApiFromHtml(html, serverUrl)

            if (result) {
              let spec = result.spec
              let url = result.url

              // 如果 spec 为空，需要从 URL 获取
              if (!spec) {
                console.log(`🔍 Found OpenAPI URL in HTML: ${url}`)
                const jsonResponse = await fetch(url, {
                  signal: AbortSignal.timeout(options.timeout || 5000),
                  headers: { 'Accept': 'application/json' },
                })

                if (!jsonResponse.ok) {
                  // 获取 JSON 失败，继续尝试下一个端点
                  continue
                }
                spec = await jsonResponse.json()
              } else {
                console.log(`🔍 Found inline OpenAPI spec in HTML from: ${url}`)
              }

              const version = this.detectVersion(spec)

              if (version !== 'unknown') {
                sources.push({
                  type: version,
                  source: 'live',
                  url,
                  spec,
                  timestamp: new Date().toISOString(),
                  hash: this.generateHash(spec),
                })

                console.log(`✅ Found OpenAPI ${version} at: ${url}`)
                break
              }
            }
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
   * 从 HTML 中提取 OpenAPI JSON URL 或内联规范
   * @returns 返回 URL 和 spec 对象，或 null
   */
  private async extractOpenApiFromHtml(html: string, baseUrl: string): Promise<{ url: string, spec: any } | null> {
    // 1. 如果是 Swagger UI 页面，尝试从 swagger-ui-init.js 提取内联规范
    if (html.includes('swagger-ui') || html.includes('SwaggerUI')) {
      // 尝试多个可能的 swagger-ui-init.js 路径
      const possiblePaths = [
        '/swagger-ui-init.js',           // 标准路径
        '/api-docs/swagger-ui-init.js',  // swagger-ui-express 路径
        '/docs/swagger-ui-init.js',      // 其他常见路径
      ]

      for (const initPath of possiblePaths) {
        const initJsUrl = this.resolveUrl(baseUrl, initPath)
        try {
          const initResponse = await fetch(initJsUrl, {
            signal: AbortSignal.timeout(5000),
          })
          if (initResponse.ok) {
            const initJs = await initResponse.text()
            // 尝试提取 swaggerDoc 对象（swagger-ui-express 使用的方式）
            // swaggerDoc 对象格式: "swaggerDoc": { ... }
            // 查找 "swaggerDoc": { 开始位置
            const swaggerDocPattern = /"swaggerDoc"\s*:\s*\{/
            const match = initJs.match(swaggerDocPattern)
            if (match && match.index !== undefined) {
              // 找到了 "swaggerDoc": {  开始解析
              const startIdx = match.index + match[0].length
              // 使用简单的括号计数找到对应的结束括号
              let braceCount = 1
              let endIdx = startIdx
              for (let i = startIdx; i < initJs.length && braceCount > 0; i++) {
                if (initJs[i] === '{') braceCount++
                else if (initJs[i] === '}') braceCount--
                if (braceCount === 0) {
                  endIdx = i
                  break
                }
              }
              const specStr = initJs.substring(startIdx, endIdx).trim()
              try {
                // 移除可能存在的尾随逗号
                const cleanStr = specStr.replace(/,\s*$/, '')
                const spec = JSON.parse(cleanStr)
                if (spec && (spec.openapi || spec.swagger)) {
                  return { url: initJsUrl, spec }
                }
              } catch {
                // JSON 解析失败，尝试其他方式
              }
            }
            // 也尝试提取 url 配置
            const urlMatch = initJs.match(/url\s*:\s*["']([^"']+)["']/)
            if (urlMatch && urlMatch[1]) {
              const specUrl = this.resolveUrl(baseUrl, urlMatch[1])
              const specResponse = await fetch(specUrl, {
                signal: AbortSignal.timeout(5000),
                headers: { 'Accept': 'application/json' },
              })
              if (specResponse.ok) {
                const spec = await specResponse.json()
                return { url: specUrl, spec }
              }
            }
          }
        } catch {
          // 忽略获取 init.js 的错误，继续尝试下一个路径
        }
      }
    }

    // 2. <link rel="api正式文档" type="application/json" href="...">
    let match = html.match(SWAGGER_LINK_REGEX) || html.match(SWAGGER_LINK_REGEX_ALT)
    if (match) {
      const url = this.resolveUrl(baseUrl, match[1])
      return { url, spec: null }
    }

    // 3. url: "..." 在 script 或 config 中
    match = html.match(SWAGGER_URL_REGEX)
    if (match) {
      const url = this.resolveUrl(baseUrl, match[1])
      return { url, spec: null }
    }

    // 4. SwaggerUIBundle({ url: "..." })
    match = html.match(SWAGGER_UIBUNDLE_REGEX)
    if (match) {
      const url = this.resolveUrl(baseUrl, match[1])
      return { url, spec: null }
    }

    // 5. urls: [{ url: "...", name: "..." }]
    const urlsMatch = html.match(/urls\s*:\s*\[\s*\{\s*url\s*:\s*["']([^"']+)["']/)
    if (urlsMatch) {
      const url = this.resolveUrl(baseUrl, urlsMatch[1])
      return { url, spec: null }
    }

    return null
  }

  /**
   * 解析相对 URL 为绝对 URL
   */
  private resolveUrl(baseUrl: string, relativeUrl: string): string {
    if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
      return relativeUrl
    }
    if (relativeUrl.startsWith('//')) {
      return 'https:' + relativeUrl
    }
    // 相对路径，基于 baseUrl
    const base = new URL(baseUrl)
    if (relativeUrl.startsWith('/')) {
      return `${base.protocol}//${base.host}${relativeUrl}`
    }
    return `${base.protocol}//${base.host}/${relativeUrl}`
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
   * 生成内容哈希
   */
  private generateHash(spec: OpenAPISpec): string {
    const content = JSON.stringify(spec)
    return crypto.createHash('sha256').update(content).digest('hex')
  }
}
