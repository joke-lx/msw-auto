/**
 * 路径提取器
 * 从 AST 节点中提取 API 路径，支持静态字符串、模板字符串、变量拼接
 */

import type * as t from '@babel/types'
import type { ApiCall, QueryParam } from '../types/frontendApiCall'

export interface PathExtractionResult {
  rawPath: string
  normalizedPath: string
  hasDynamicSegments: boolean
  pathVariables: string[]
  staticallyResolved: boolean
  unresolvedReason?: string
}

export class PathExtractor {
  private readonly MAX_TEMPLATE_DEPTH = 5

  /**
   * 从表达式中提取路径
   */
  extract(
    node: t.Expression | t.Identifier | null | undefined,
    variableValues: Map<string, any>
  ): PathExtractionResult {
    if (!node) {
      return this.createUnresolvedResult('null node')
    }

    if (t.isStringLiteral(node)) {
      return this.extractFromStringLiteral(node)
    }

    if (t.isTemplateLiteral(node)) {
      return this.extractFromTemplateLiteral(node, variableValues, 0)
    }

    if (t.isIdentifier(node)) {
      return this.extractFromIdentifier(node, variableValues)
    }

    if (t.isBinaryExpression(node)) {
      return this.extractFromBinaryExpression(node, variableValues)
    }

    if (t.isMemberExpression(node)) {
      return this.extractFromMemberExpression(node, variableValues)
    }

    if (t.isCallExpression(node)) {
      return this.extractFromCallExpression(node, variableValues)
    }

    return this.createUnresolvedResult(`unsupported node type: ${node.type}`)
  }

  /**
   * 从字符串字面量提取
   */
  private extractFromStringLiteral(node: t.StringLiteral): PathExtractionResult {
    const rawPath = node.value
    const { normalizedPath, hasDynamic, variables } = this.normalizeToOpenAPIPath(rawPath)
    return {
      rawPath,
      normalizedPath,
      hasDynamicSegments: hasDynamic,
      pathVariables: variables,
      staticallyResolved: true,
    }
  }

  /**
   * 从模板字符串提取
   * 例如: `/api/users/${userId}` → /api/users/{userId}
   */
  private extractFromTemplateLiteral(
    node: t.TemplateLiteral,
    variableValues: Map<string, any>,
    depth: number
  ): PathExtractionResult {
    if (depth > this.MAX_TEMPLATE_DEPTH) {
      return this.createUnresolvedResult('template nesting exceeds max depth')
    }

    try {
      const parts: string[] = []

      for (let i = 0; i < node.quasis.length; i++) {
        parts.push(node.quasis[i].value.cooked || '')

        if (i < node.expressions.length) {
          const expr = node.expressions[i]
          const exprValue = this.evaluateExpression(expr, variableValues, depth + 1)

          if (exprValue !== undefined) {
            // 尝试验证变量值是否像路径参数
            const varName = t.isIdentifier(expr) ? expr.name : String(exprValue)
            if (this.looksLikePathVariable(varName, exprValue)) {
              parts.push(`{${varName}}`)
            } else if (typeof exprValue === 'string' && this.looksLikeId(exprValue)) {
              parts.push(exprValue)
            } else {
              parts.push(String(exprValue))
            }
          } else {
            // 无法解析的动态部分
            if (t.isIdentifier(expr)) {
              parts.push(`{${expr.name}}`)
            } else {
              return this.createUnresolvedResult(
                `dynamic template expression at index ${i} cannot be statically resolved`
              )
            }
          }
        }
      }

      const rawPath = parts.join('')
      const { normalizedPath, hasDynamic, variables } = this.normalizeToOpenAPIPath(rawPath)

      return {
        rawPath,
        normalizedPath,
        hasDynamicSegments: hasDynamic,
        pathVariables: variables,
        staticallyResolved: true,
      }
    } catch (e) {
      return this.createUnresolvedResult(`template literal evaluation failed: ${e}`)
    }
  }

  /**
   * 从标识符提取（变量引用）
   */
  private extractFromIdentifier(
    node: t.Identifier,
    variableValues: Map<string, any>
  ): PathExtractionResult {
    const value = variableValues.get(node.name)

    if (value === undefined) {
      return this.createUnresolvedResult(`variable '${node.name}' not in scope`)
    }

    if (typeof value === 'string') {
      return this.extractFromStringLiteral({ type: 'StringLiteral', value } as t.StringLiteral)
    }

    if (typeof value === 'number') {
      const rawPath = String(value)
      return {
        rawPath,
        normalizedPath: rawPath,
        hasDynamicSegments: false,
        pathVariables: [],
        staticallyResolved: true,
      }
    }

    return this.createUnresolvedResult(
      `variable '${node.name}' has non-string type: ${typeof value}`
    )
  }

  /**
   * 从二元表达式提取（字符串拼接）
   * 例如: '/api/users/' + userId
   */
  private extractFromBinaryExpression(
    node: t.BinaryExpression,
    variableValues: Map<string, any>,
    depth = 0
  ): PathExtractionResult {
    if (node.operator !== '+') {
      return this.createUnresolvedResult(`unsupported binary operator: ${node.operator}`)
    }

    const leftResult = this.extract(node.left, variableValues)
    const rightResult = this.extract(node.right, variableValues)

    if (!leftResult.staticallyResolved && !rightResult.staticallyResolved) {
      return this.createUnresolvedResult('both sides of binary expression are dynamic')
    }

    if (!leftResult.staticallyResolved) {
      return rightResult
    }

    if (!rightResult.staticallyResolved) {
      return leftResult
    }

    // 合并两个静态路径
    const rawPath = leftResult.rawPath + rightResult.rawPath
    const combinedNormalized = leftResult.normalizedPath + rightResult.normalizedPath

    // 提取变量（去重）
    const pathVariables = [...new Set([...leftResult.pathVariables, ...rightResult.pathVariables])]
    const hasDynamic =
      leftResult.hasDynamicSegments ||
      rightResult.hasDynamicSegments ||
      pathVariables.length > 0

    return {
      rawPath,
      normalizedPath: combinedNormalized,
      hasDynamicSegments: hasDynamic,
      pathVariables,
      staticallyResolved: true,
    }
  }

  /**
   * 从成员表达式提取
   * 例如: API_BASE_URL + '/users'
   */
  private extractFromMemberExpression(
    node: t.MemberExpression,
    variableValues: Map<string, any>
  ): PathExtractionResult {
    // 尝试获取计算后的值
    const value = this.evaluateExpression(node, variableValues, 0)

    if (value !== undefined && typeof value === 'string') {
      return this.extractFromStringLiteral({ type: 'StringLiteral', value } as t.StringLiteral)
    }

    return this.createUnresolvedResult(`member expression cannot be statically resolved`)
  }

  /**
   * 从调用表达式提取
   * 例如: getBaseUrl() + '/users'
   */
  private extractFromCallExpression(
    node: t.CallExpression,
    variableValues: Map<string, any>
  ): PathExtractionResult {
    return this.createUnresolvedResult(`call expression cannot be statically resolved`)
  }

  /**
   * 表达式求值
   */
  private evaluateExpression(
    node: t.Expression,
    variableValues: Map<string, any>,
    depth: number
  ): any {
    if (depth > this.MAX_TEMPLATE_DEPTH) return undefined

    if (t.isIdentifier(node)) {
      return variableValues.get(node.name)
    }

    if (t.isStringLiteral(node)) {
      return node.value
    }

    if (t.isNumericLiteral(node)) {
      return node.value
    }

    if (t.isTemplateLiteral(node)) {
      if (node.expressions.length === 0) {
        return node.quasis[0].value.cooked
      }
      // 复杂模板字符串
      let result = ''
      for (let i = 0; i < node.quasis.length; i++) {
        result += node.quasis[i].value.cooked || ''
        if (i < node.expressions.length) {
          const exprValue = this.evaluateExpression(node.expressions[i], variableValues, depth + 1)
          result += exprValue !== undefined ? String(exprValue) : ''
        }
      }
      return result
    }

    if (t.isBinaryExpression(node) && node.operator === '+') {
      const left = this.evaluateExpression(node.left, variableValues, depth + 1)
      const right = this.evaluateExpression(node.right, variableValues, depth + 1)
      if (left !== undefined && right !== undefined) {
        return String(left) + String(right)
      }
    }

    if (t.isMemberExpression(node)) {
      const obj = this.evaluateExpression(node.object, variableValues, depth + 1)
      if (obj !== undefined && t.isIdentifier(node.property)) {
        return obj[node.property.name]
      }
    }

    if (t.isConditionalExpression(node)) {
      // 三元表达式：尝试解析为两个可能值之一（保守策略）
      const consequent = this.evaluateExpression(node.consequent, variableValues, depth + 1)
      const alternate = this.evaluateExpression(node.alternate, variableValues, depth + 1)
      // 返回其中一个能静态解析的
      return consequent !== undefined ? consequent : alternate
    }

    return undefined
  }

  /**
   * 判断变量名是否像路径参数
   */
  private looksLikePathVariable(name: string, value?: any): boolean {
    const pathParamPatterns = [
      /^(id|userId|itemId|postId|commentId|categoryId|orderId|productId)$/i,
      /^(uuid|guid|token|key|code)$/i,
      /^p\d+$/,  // p1, p2
      /^arg\d+$/, // arg1, arg2
    ]

    if (value !== undefined && typeof value === 'string') {
      // 值像是 ID
      if (/^\d+$/.test(value) || /^[a-f0-9-]{8,}$/i.test(value)) {
        return true
      }
    }

    return pathParamPatterns.some((p) => p.test(name))
  }

  /**
   * 判断值是否像 ID
   */
  private looksLikeId(value: string): boolean {
    return /^\d+$/.test(value) || /^[a-f0-9-]{8,}$/i.test(value)
  }

  /**
   * 将路径标准化为 OpenAPI 模板格式
   * 例如: /api/users/123 → /api/users/{id} (如果 123 看起来像 ID)
   *       /api/users/:id → /api/users/{id}
   */
  private normalizeToOpenAPIPath(
    rawPath: string
  ): { normalizedPath: string; hasDynamic: boolean; variables: string[] } {
    let path = rawPath

    // 1. 移除协议和域名，只保留路径部分
    try {
      const url = new URL(rawPath)
      path = url.pathname + url.search
    } catch {
      // 不是完整 URL，保持原样
    }

    const variables: string[] = []
    let hasDynamic = false

    // 2. 处理 Express 风格路径参数 :id → {id}
    path = path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name) => {
      variables.push(name)
      hasDynamic = true
      return `{${name}}`
    })

    // 3. 处理冒号开头的路径参数 :userId
    path = path.replace(/\:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name) => {
      variables.push(name)
      hasDynamic = true
      return `{${name}}`
    })

    // 4. 处理可能的数字 ID 段（保守策略：只对看起来像 ID 的数字做转换）
    // 路径如 /users/123 → 如果后面有明确的变量上下文，保持原样
    // 这个策略在模板字符串解析时已经处理

    return {
      normalizedPath: path,
      hasDynamic,
      variables: [...new Set(variables)],
    }
  }

  /**
   * 创建未解析结果
   */
  private createUnresolvedResult(reason: string): PathExtractionResult {
    return {
      rawPath: '',
      normalizedPath: '',
      hasDynamicSegments: false,
      pathVariables: [],
      staticallyResolved: false,
      unresolvedReason: reason,
    }
  }

  /**
   * 解析 query string
   * 例如: /api/users?page=1&limit=10 → { name: 'page', value: '1' }, ...
   */
  extractQueryParams(url: string): QueryParam[] {
    try {
      const queryStart = url.indexOf('?')
      if (queryStart === -1) return []

      const queryString = url.substring(queryStart + 1)
      const params: QueryParam[] = []

      for (const pair of queryString.split('&')) {
        const [key, value] = pair.split('=')
        if (key) {
          params.push({
            name: decodeURIComponent(key),
            value: value !== undefined ? decodeURIComponent(value) : undefined,
            type: 'static',
          })
        }
      }

      return params
    } catch {
      return []
    }
  }
}
