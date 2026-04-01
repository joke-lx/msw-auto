/**
 * OpenAPI 路径匹配器
 *
 * 将前端调用的实际路径与 OpenAPI spec 中的路径模板进行匹配
 * 例如: /users/123 与 /users/{id} 匹配
 */

export interface PathMatchResult {
  /** 是否匹配 */
  matched: boolean
  /** 匹配的 spec 路径模板 */
  specPath: string
  /** spec 中的路径参数 */
  pathParameters: Record<string, string>
  /** 匹配得分 (0-1) */
  score: number
  /** 不匹配原因 */
  reason?: string
}

export interface SpecEndpoint {
  path: string
  method: string
  operationId?: string
  parameters?: {
    path?: Record<string, any>
    query?: Record<string, any>
  }
}

/**
 * OpenAPI 路径匹配器
 *
 * 支持:
 * - 精确匹配: /users/123 == /users/123
 * - 模板匹配: /users/123 matches /users/{id}
 * - 多段模板: /users/123/posts/456 matches /users/{userId}/posts/{postId}
 */
export class OpenApiPathMatcher {
  /**
   * 匹配前端路径到 OpenAPI spec 路径
   *
   * @param frontendPath 前端调用的实际路径
   * @param specPaths OpenAPI spec 中的所有路径
   * @returns 匹配结果列表，按得分降序排列
   */
  match(
    frontendPath: string,
    specPaths: Record<string, any>
  ): PathMatchResult | null {
    // 1. 尝试精确匹配
    const exactMatch = this.tryExactMatch(frontendPath, specPaths)
    if (exactMatch) return exactMatch

    // 2. 尝试模板匹配
    const templateMatch = this.tryTemplateMatch(frontendPath, specPaths)
    if (templateMatch) return templateMatch

    // 3. 返回未匹配
    return null
  }

  /**
   * 尝试精确匹配
   */
  private tryExactMatch(
    frontendPath: string,
    specPaths: Record<string, any>
  ): PathMatchResult | null {
    // 直接路径完全相等
    if (specPaths[frontendPath]) {
      return {
        matched: true,
        specPath: frontendPath,
        pathParameters: {},
        score: 1.0,
      }
    }

    // URL 解码后匹配
    try {
      const decoded = decodeURIComponent(frontendPath)
      if (decoded !== frontendPath && specPaths[decoded]) {
        return {
          matched: true,
          specPath: decoded,
          pathParameters: {},
          score: 1.0,
        }
      }
    } catch {
      // 解码失败，忽略
    }

    return null
  }

  /**
   * 尝试模板匹配
   *
   * 将前端路径和所有 spec 路径模板进行对比
   * 返回得分最高且 > 0 的结果
   */
  private tryTemplateMatch(
    frontendPath: string,
    specPaths: Record<string, any>
  ): PathMatchResult | null {
    let bestMatch: PathMatchResult | null = null
    let bestScore = 0

    // 清理前端路径
    const cleanPath = this.cleanPath(frontendPath)
    const frontendSegments = this.splitPath(cleanPath)

    for (const specPath of Object.keys(specPaths)) {
      const cleanSpecPath = this.cleanPath(specPath)
      const specSegments = this.splitPath(cleanSpecPath)

      // 段数不同，无法匹配
      if (frontendSegments.length !== specSegments.length) continue

      const result = this.matchSegments(frontendSegments, specSegments)

      if (result.matched && result.score > bestScore) {
        bestScore = result.score
        bestMatch = {
          matched: true,
          specPath,
          pathParameters: result.parameters,
          score: result.score,
        }
      }
    }

    return bestMatch
  }

  /**
   * 清理路径
   */
  private cleanPath(p: string): string {
    // 移除协议和域名
    try {
      const url = new URL(p, 'http://localhost')
      p = url.pathname
    } catch {
      // 不是完整 URL
    }

    // 移除重复的斜杠
    p = p.replace(/\/+/g, '/')

    // 移除末尾斜杠
    p = p.replace(/\/$/, '')

    return p
  }

  /**
   * 拆分路径为段
   */
  private splitPath(p: string): string[] {
    return p.split('/').filter(Boolean)
  }

  /**
   * 匹配路径段
   *
   * @returns 匹配结果和提取的参数
   */
  private matchSegments(
    frontendSegments: string[],
    specSegments: string[]
  ): { matched: boolean; score: number; parameters: Record<string, string> } {
    const parameters: Record<string, string> = {}
    let matchedCount = 0

    for (let i = 0; i < frontendSegments.length; i++) {
      const front = frontendSegments[i]
      const spec = specSegments[i]

      if (spec.startsWith('{') && spec.endsWith('}')) {
        // 模板参数
        const paramName = spec.slice(1, -1)
        parameters[paramName] = front
        matchedCount++
      } else if (front === spec) {
        // 完全匹配
        matchedCount++
      } else if (this.looksLikeId(front) && this.looksLikeId(spec)) {
        // 都是 ID 形式的参数
        parameters[`__auto_${i}`] = front
        matchedCount++
      } else {
        // 不匹配
        return { matched: false, score: 0, parameters: {} }
      }
    }

    const score = matchedCount / frontendSegments.length

    return { matched: true, score, parameters }
  }

  /**
   * 判断字符串是否像 ID
   */
  private looksLikeId(value: string): boolean {
    // 纯数字
    if (/^\d+$/.test(value)) return true
    // UUID/GUID
    if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) return true
    // 短 UUID
    if (/^[a-f0-9]{8,}$/i.test(value)) return true
    return false
  }

  /**
   * 批量匹配前端调用到 spec
   *
   * @param frontendPaths 前端调用的路径列表
   * @param specPaths OpenAPI spec 中的所有路径
   * @returns 每个前端路径的匹配结果
   */
  matchBatch(
    frontendPaths: string[],
    specPaths: Record<string, any>
  ): Map<string, PathMatchResult> {
    const results = new Map<string, PathMatchResult>()

    for (const frontendPath of frontendPaths) {
      const result = this.match(frontendPath, specPaths)
      if (result) {
        results.set(frontendPath, result)
      }
    }

    return results
  }

  /**
   * 获取 spec 中定义的所有路径（按方法展开）
   */
  expandSpecPaths(specPaths: Record<string, any>): SpecEndpoint[] {
    const endpoints: SpecEndpoint[] = []

    for (const [path, methods] of Object.entries(specPaths)) {
      if (typeof methods !== 'object') continue

      for (const [method, operation] of Object.entries(methods)) {
        if (typeof method !== 'string') continue

        const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head']
        if (!httpMethods.includes(method.toLowerCase())) continue

        endpoints.push({
          path,
          method: method.toUpperCase(),
          operationId: (operation as any)?.operationId,
          parameters: (operation as any)?.parameters,
        })
      }
    }

    return endpoints
  }
}
