/**
 * Axios 检测器
 * 检测 axios.get(), axios.post(), axios.request() 等调用
 */

import type * as t from '@babel/types'
import type { ApiCall, HttpMethod } from '../types/frontendApiCall'
import { BaseDetector, type DetectorContext } from './BaseDetector'

export class AxiosDetector extends BaseDetector {
  readonly name = 'axios' as const

  // HTTP 方法映射
  private static readonly HTTP_METHODS: Record<string, HttpMethod> = {
    get: 'GET',
    post: 'POST',
    put: 'PUT',
    patch: 'PATCH',
    delete: 'DELETE',
    head: 'HEAD',
    options: 'OPTIONS',
  }

  matchesFile(filePath: string, code: string): boolean {
    return (
      code.includes("from 'axios'") ||
      code.includes('from "axios"') ||
      code.includes('axios.get') ||
      code.includes('axios.post') ||
      code.includes('axios.put') ||
      code.includes('axios.patch') ||
      code.includes('axios.delete') ||
      code.includes('axios.request') ||
      code.includes('axios.create')
    )
  }

  extractCall(callNode: t.CallExpression, context: DetectorContext): ApiCall | null {
    const callee = callNode.callee

    if (!t.isMemberExpression(callee)) return null

    const property = callee.property
    if (!t.isIdentifier(property)) return null

    const methodName = property.name.toLowerCase()

    // axios.request() 特殊处理
    if (methodName === 'request') {
      return this.extractRequestCall(callNode, context)
    }

    // axios.create() 返回的实例方法
    if (methodName === 'create') {
      // axios.create() 返回实例，不直接产生 API 调用
      return null
    }

    // 标准 HTTP 方法: axios.get(), axios.post() 等
    const httpMethod = AxiosDetector.HTTP_METHODS[methodName]
    if (!httpMethod) return null

    return this.extractHttpMethodCall(callNode, context, httpMethod)
  }

  /**
   * 提取 axios.get('/url', { params, data }) 格式
   */
  private extractHttpMethodCall(
    callNode: t.CallExpression,
    context: DetectorContext,
    defaultMethod: HttpMethod
  ): ApiCall | null {
    const args = callNode.arguments

    if (args.length === 0) return null

    // 第一个参数是 URL
    const urlNode = args[0]
    const pathResult = this.pathExtractor.extract(urlNode, context.variableValues)

    if (!pathResult.staticallyResolved) {
      return this.createUnresolvedCall(callNode, context, pathResult, defaultMethod)
    }

    // 第二个参数是配置
    const config = args.length > 1 && t.isObjectExpression(args[1]) ? args[1] : null

    // 从 config 中提取 params (query string)
    const queryParams = this.extractQueryParams(config, context)

    // 从 config 中提取 data/requestBody
    const requestBody = this.extractRequestBody(config, context)

    // Axios 默认 method
    let method = defaultMethod

    // 如果是 axios.get 但 config 中指定了 method，以 config 为准
    if (config) {
      const methodProp = this.getOption(config, 'method')
      if (methodProp && t.isStringLiteral(methodProp)) {
        const m = methodProp.value.toUpperCase()
        if (m in AxiosDetector.HTTP_METHODS) {
          method = AxiosDetector.HTTP_METHODS[m.toLowerCase()]
        }
      }
    }

    // 如果是 DELETE 但有 data，Axios 会用 request body
    if (method === 'DELETE' && requestBody) {
      // DELETE with body 是合法的
    }

    return {
      id: this.generateId(method, pathResult.normalizedPath, context.filePath, callNode.loc?.start.line || 0),
      method,
      rawPath: pathResult.rawPath,
      normalizedPath: pathResult.normalizedPath,
      hasDynamicSegments: pathResult.hasDynamicSegments,
      pathVariables: pathResult.pathVariables,
      queryParams,
      requestBody,
      location: {
        file: context.filePath,
        line: callNode.loc?.start.line || 0,
      },
      library: this.name,
      staticallyResolved: pathResult.staticallyResolved,
    }
  }

  /**
   * 提取 axios.request({ url, method, params, data })
   */
  private extractRequestCall(callNode: t.CallExpression, context: DetectorContext): ApiCall | null {
    const args = callNode.arguments

    if (args.length === 0) return null

    const config = args[0]
    if (!t.isObjectExpression(config)) return null

    // 提取 url
    const urlProp = this.getOption(config, 'url')
    if (!urlProp) return null

    const pathResult = this.pathExtractor.extract(urlProp, context.variableValues)

    if (!pathResult.staticallyResolved) {
      return this.createUnresolvedCall(callNode, context, pathResult, 'GET')
    }

    // 提取 method
    const methodProp = this.getOption(config, 'method')
    let method: HttpMethod = 'GET'
    if (methodProp && t.isStringLiteral(methodProp)) {
      const m = methodProp.value.toUpperCase()
      if (m in AxiosDetector.HTTP_METHODS) {
        method = AxiosDetector.HTTP_METHODS[m.toLowerCase()]
      }
    }

    // 提取 params
    const queryParams = this.extractQueryParams(config, context)

    // 提取 data
    const requestBody = this.extractRequestBody(config, context)

    return {
      id: this.generateId(method, pathResult.normalizedPath, context.filePath, callNode.loc?.start.line || 0),
      method,
      rawPath: pathResult.rawPath,
      normalizedPath: pathResult.normalizedPath,
      hasDynamicSegments: pathResult.hasDynamicSegments,
      pathVariables: pathResult.pathVariables,
      queryParams,
      requestBody,
      location: {
        file: context.filePath,
        line: callNode.loc?.start.line || 0,
      },
      library: this.name,
      staticallyResolved: pathResult.staticallyResolved,
    }
  }

  /**
   * 从 config 中提取 query 参数
   */
  private extractQueryParams(config: t.ObjectExpression | null, context: DetectorContext) {
    if (!config) return []

    const paramsProp = this.getOption(config, 'params')
    if (!paramsProp) return []

    // params 可以是对象或 URL
    if (t.isObjectExpression(paramsProp)) {
      const queryParams = []
      for (const prop of paramsProp.properties) {
        if (t.isObjectProperty(prop)) {
          const key = this.getPropertyKey(prop.key)
          const valueResult = this.evaluatePropertyValue(prop.value, context.variableValues)
          if (key) {
            queryParams.push({
              name: key,
              value: valueResult.value,
              type: valueResult.type,
            })
          }
        }
      }
      return queryParams
    }

    return []
  }

  /**
   * 从 config 中提取请求体
   */
  private extractRequestBody(config: t.ObjectExpression | null, context: DetectorContext) {
    if (!config) return undefined

    const dataProp = this.getOption(config, 'data')
    if (!dataProp) return undefined

    return this.requestBodyExtractor.extract(dataProp, context.variableValues)
  }

  private getPropertyKey(key: t.Expression): string | null {
    if (t.isIdentifier(key)) return key.name
    if (t.isStringLiteral(key)) return key.value
    if (t.isNumericLiteral(key)) return String(key.value)
    return null
  }

  private evaluatePropertyValue(node: t.Expression, variableValues: Map<string, any>): { value: any; type: 'static' | 'dynamic' | 'template' } {
    if (t.isStringLiteral(node)) return { value: node.value, type: 'static' }
    if (t.isNumericLiteral(node)) return { value: node.value, type: 'static' }
    if (t.isBooleanLiteral(node)) return { value: node.value, type: 'static' }
    if (t.isIdentifier(node)) {
      const value = variableValues.get(node.name)
      return { value: value !== undefined ? value : node.name, type: 'dynamic' }
    }
    if (t.isTemplateLiteral(node)) {
      if (node.expressions.length === 0) {
        return { value: node.quasis[0].value.cooked, type: 'static' }
      }
      let result = ''
      for (let i = 0; i < node.quasis.length; i++) {
        result += node.quasis[i].value.cooked || ''
        if (i < node.expressions.length) {
          const val = this.evaluateExpression(node.expressions[i], variableValues)
          result += val !== undefined ? String(val) : ''
        }
      }
      return { value: result, type: 'template' }
    }
    return { value: '[expression]', type: 'dynamic' }
  }

  private evaluateExpression(node: t.Expression, variableValues: Map<string, any>): any {
    if (t.isIdentifier(node)) return variableValues.get(node.name)
    if (t.isStringLiteral(node)) return node.value
    if (t.isNumericLiteral(node)) return node.value
    return undefined
  }

  private createUnresolvedCall(
    callNode: t.CallExpression,
    context: DetectorContext,
    pathResult: any,
    method: HttpMethod
  ): ApiCall {
    return {
      id: this.generateId(method, '', context.filePath, callNode.loc?.start.line || 0),
      method,
      rawPath: pathResult.rawPath || '[dynamic]',
      normalizedPath: '',
      hasDynamicSegments: true,
      pathVariables: [],
      queryParams: [],
      location: {
        file: context.filePath,
        line: callNode.loc?.start.line || 0,
      },
      library: this.name,
      staticallyResolved: false,
      unresolvedReason: pathResult.unresolvedReason,
    }
  }
}
