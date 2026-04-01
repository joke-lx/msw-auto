/**
 * Fetch API 检测器
 * 检测 fetch(), 上古版本 fetch, undici.fetch 等调用
 */

import type * as t from '@babel/types'
import type { ApiCall, HttpMethod } from '../types/frontendApiCall'
import { BaseDetector, type DetectorContext } from './BaseDetector'

export class FetchDetector extends BaseDetector {
  readonly name = 'fetch' as const

  matchesFile(filePath: string, code: string): boolean {
    // fetch 是全局 API，所有 JS/TS 文件都可能使用
    // 不需要特定的文件匹配
    return code.includes('fetch(') || code.includes('fetch ('))
  }

  extractCall(callNode: t.CallExpression, context: DetectorContext): ApiCall | null {
    // 检查是否是 fetch 调用
    if (!this.isFetchCall(callNode)) {
      return null
    }

    const args = callNode.arguments
    if (args.length === 0) return null

    // 第一个参数是 URL
    const urlNode = args[0]
    const pathResult = this.pathExtractor.extract(urlNode, context.variableValues)

    if (!pathResult.staticallyResolved) {
      return this.createUnresolvedCall(callNode, context, pathResult)
    }

    // 第二个参数是 options
    const options = args.length > 1 && t.isObjectExpression(args[1]) ? args[1] : null
    const method = options ? this.extractMethodFromOptions(options) : 'GET'
    const queryParams = pathResult.rawPath.includes('?')
      ? this.pathExtractor.extractQueryParams(pathResult.rawPath)
      : []
    const requestBody = options ? this.extractBody(options, context) : undefined

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

  private isFetchCall(node: t.CallExpression): boolean {
    const callee = node.callee

    // fetch(url, options)
    if (t.isIdentifier(callee) && callee.name === 'fetch') {
      return true
    }

    // globalThis.fetch, window.fetch 等
    if (t.isMemberExpression(callee)) {
      const property = callee.property
      if (t.isIdentifier(property) && property.name === 'fetch') {
        return true
      }
    }

    // undici.fetch
    if (t.isMemberExpression(callee)) {
      const obj = callee.object
      if (t.isIdentifier(obj) && obj.name === 'undici') {
        return true
      }
    }

    return false
  }

  private extractMethodFromOptions(options: t.ObjectExpression): HttpMethod {
    const methodProp = this.getOption(options, 'method')
    if (methodProp && t.isStringLiteral(methodProp)) {
      const m = methodProp.value.toUpperCase()
      const validMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']
      if (validMethods.includes(m as HttpMethod)) {
        return m as HttpMethod
      }
    }
    return 'GET'
  }

  private extractBody(options: t.ObjectExpression, context: DetectorContext) {
    const bodyProp = this.getOption(options, 'body')
    if (bodyProp) {
      return this.requestBodyExtractor.extract(bodyProp, context.variableValues)
    }
    return undefined
  }

  private createUnresolvedCall(
    callNode: t.CallExpression,
    context: DetectorContext,
    pathResult: any
  ): ApiCall {
    return {
      id: this.generateId('GET', '', context.filePath, callNode.loc?.start.line || 0),
      method: 'GET',
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
