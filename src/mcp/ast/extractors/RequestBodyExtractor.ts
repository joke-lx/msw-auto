/**
 * 请求体提取器
 * 从 AST 节点中提取 HTTP 请求体信息
 */

import type * as t from '@babel/types'
import type { RequestBody, RequestBodyProperty } from '../types/frontendApiCall'

export class RequestBodyExtractor {
  /**
   * 从表达式中提取请求体
   */
  extract(
    node: t.Expression | t.ObjectExpression | t.ArrayExpression | null | undefined,
    variableValues: Map<string, any>,
    contentType?: string
  ): RequestBody | undefined {
    if (!node) return undefined

    // 处理 undefined/null
    if (
      t.isIdentifier(node) &&
      (node.name === 'undefined' || node.name === 'null')
    ) {
      return undefined
    }

    // 处理对象字面量
    if (t.isObjectExpression(node)) {
      return this.extractFromObjectExpression(node, variableValues, contentType)
    }

    // 处理数组字面量
    if (t.isArrayExpression(node)) {
      return {
        type: 'json',
        properties: this.extractArrayProperties(node, variableValues),
        raw: this.nodeToString(node),
      }
    }

    // 处理标识符（变量引用）
    if (t.isIdentifier(node)) {
      const value = variableValues.get(node.name)
      if (value !== undefined && typeof value === 'object' && value !== null) {
        return this.extractFromPlainObject(value, contentType)
      }
    }

    // 处理二元表达式
    if (t.isObjectExpression(node)) {
      return this.extractFromObjectExpression(node, variableValues, contentType)
    }

    return {
      type: 'unknown',
      raw: this.nodeToString(node),
    }
  }

  /**
   * 从对象表达式提取
   */
  private extractFromObjectExpression(
    node: t.ObjectExpression,
    variableValues: Map<string, any>,
    contentType?: string
  ): RequestBody {
    const properties: RequestBodyProperty[] = []

    for (const prop of node.properties) {
      if (t.isObjectProperty(prop)) {
        const name = this.getPropertyKey(prop.key)
        const valueResult = this.evaluatePropertyValue(prop.value, variableValues)

        if (name) {
          properties.push({
            name,
            value: valueResult.value,
            type: valueResult.type,
            required: !prop.computed, // 字面量 key 认为是 required
          })
        }
      } else if (t.isSpreadElement(prop)) {
        // 展开运算符 { ...obj }
        const spreadValue = this.evaluateExpression(prop.argument, variableValues)
        if (spreadValue && typeof spreadValue === 'object') {
          // 展开对象的所有属性
          for (const [key, val] of Object.entries(spreadValue)) {
            properties.push({
              name: key,
              value: val,
              type: 'dynamic',
              required: false,
            })
          }
        }
      }
    }

    return {
      type: this.inferContentType(contentType, properties),
      properties,
      raw: this.nodeToString(node),
    }
  }

  /**
   * 从纯 JS 对象提取
   */
  private extractFromPlainObject(obj: any, contentType?: string): RequestBody {
    const properties: RequestBodyProperty[] = []

    for (const [key, value] of Object.entries(obj)) {
      properties.push({
        name: key,
        value,
        type: typeof value === 'string' ? 'static' : 'dynamic',
        required: true,
      })
    }

    return {
      type: this.inferContentType(contentType, properties),
      properties,
    }
  }

  /**
   * 从数组提取属性
   */
  private extractArrayProperties(
    node: t.ArrayExpression,
    variableValues: Map<string, any>
  ): RequestBodyProperty[] {
    const properties: RequestBodyProperty[] = []

    for (let i = 0; i < Math.min(node.elements.length, 10); i++) {
      const element = node.elements[i]
      if (element && t.isObjectExpression(element)) {
        // 数组中的对象
        for (const prop of element.properties) {
          if (t.isObjectProperty(prop)) {
            const name = this.getPropertyKey(prop.key)
            const valueResult = this.evaluatePropertyValue(prop.value, variableValues)
            if (name) {
              properties.push({
                name,
                value: valueResult.value,
                type: valueResult.type,
                required: true,
              })
            }
          }
        }
      }
    }

    return properties
  }

  /**
   * 获取对象属性的 key 名称
   */
  private getPropertyKey(key: t.Expression): string | null {
    if (t.isIdentifier(key)) return key.name
    if (t.isStringLiteral(key)) return key.value
    if (t.isNumericLiteral(key)) return String(key.value)
    return null
  }

  /**
   * 估算属性值
   */
  private evaluatePropertyValue(
    node: t.Expression,
    variableValues: Map<string, any>
  ): { value: any; type: 'static' | 'dynamic' | 'template' } {
    if (t.isStringLiteral(node)) {
      return { value: node.value, type: 'static' }
    }

    if (t.isNumericLiteral(node)) {
      return { value: node.value, type: 'static' }
    }

    if (t.isBooleanLiteral(node)) {
      return { value: node.value, type: 'static' }
    }

    if (t.isNullLiteral(node)) {
      return { value: null, type: 'static' }
    }

    if (t.isIdentifier(node)) {
      const value = variableValues.get(node.name)
      if (value !== undefined) {
        return { value, type: 'dynamic' }
      }
      return { value: node.name, type: 'dynamic' }
    }

    if (t.isTemplateLiteral(node)) {
      if (node.expressions.length === 0) {
        return { value: node.quasis[0].value.cooked, type: 'static' }
      }
      // 有动态部分
      let result = ''
      for (let i = 0; i < node.quasis.length; i++) {
        result += node.quasis[i].value.cooked || ''
        if (i < node.expressions.length) {
          const exprValue = this.evaluateExpression(node.expressions[i], variableValues)
          result += exprValue !== undefined ? String(exprValue) : '${...}'
        }
      }
      return { value: result, type: 'template' }
    }

    if (t.isObjectExpression(node)) {
      const obj: Record<string, any> = {}
      for (const prop of node.properties) {
        if (t.isObjectProperty(prop)) {
          const key = this.getPropertyKey(prop.key)
          const valResult = this.evaluatePropertyValue(prop.value, variableValues)
          if (key) obj[key] = valResult.value
        }
      }
      return { value: obj, type: 'dynamic' }
    }

    if (t.isArrayExpression(node)) {
      const arr: any[] = []
      for (const elem of node.elements) {
        if (elem && t.isObjectExpression(elem)) {
          const item: Record<string, any> = {}
          for (const prop of elem.properties) {
            if (t.isObjectProperty(prop)) {
              const key = this.getPropertyKey(prop.key)
              const valResult = this.evaluatePropertyValue(prop.value, variableValues)
              if (key) item[key] = valResult.value
            }
          }
          arr.push(item)
        }
      }
      return { value: arr, type: 'dynamic' }
    }

    return { value: this.nodeToString(node), type: 'dynamic' }
  }

  /**
   * 表达式求值
   */
  private evaluateExpression(node: t.Expression, variableValues: Map<string, any>): any {
    if (t.isIdentifier(node)) {
      return variableValues.get(node.name)
    }
    if (t.isStringLiteral(node)) return node.value
    if (t.isNumericLiteral(node)) return node.value
    if (t.isBooleanLiteral(node)) return node.value
    if (t.isTemplateLiteral(node)) {
      if (node.expressions.length === 0) {
        return node.quasis[0].value.cooked
      }
      let result = ''
      for (let i = 0; i < node.quasis.length; i++) {
        result += node.quasis[i].value.cooked || ''
        if (i < node.expressions.length) {
          const val = this.evaluateExpression(node.expressions[i], variableValues)
          result += val !== undefined ? String(val) : ''
        }
      }
      return result
    }
    return undefined
  }

  /**
   * 根据内容类型和属性推断请求体类型
   */
  private inferContentType(
    contentType: string | undefined,
    properties: RequestBodyProperty[]
  ): RequestBody['type'] {
    if (!contentType) {
      // 默认根据属性判断
      const hasFiles = properties.some(
        (p) => p.name.toLowerCase().includes('file') || p.name.toLowerCase().includes('image')
      )
      return hasFiles ? 'form-data' : 'json'
    }

    if (contentType.includes('application/json')) return 'json'
    if (contentType.includes('multipart/form-data')) return 'form-data'
    if (contentType.includes('application/x-www-form-urlencoded')) return 'x-www-form-urlencoded'
    if (contentType.includes('image/') || contentType.includes('application/octet-stream')) {
      return 'binary'
    }

    return 'unknown'
  }

  /**
   * 节点转字符串（用于 raw 字段）
   */
  private nodeToString(node: t.Expression): string {
    // 简单实现，实际可以用 @babel/generator
    return `[ObjectExpression:${node.type}]`
  }
}
