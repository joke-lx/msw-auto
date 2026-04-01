/**
 * SWR 检测器
 * 检测 useSWR, mutate 等调用
 */

import type * as t from '@babel/types'
import type { ApiCall, HttpMethod } from '../types/frontendApiCall'
import { BaseDetector, type DetectorContext } from './BaseDetector'

export class SWRDetector extends BaseDetector {
  readonly name = 'swr' as const

  matchesFile(filePath: string, code: string): boolean {
    return (
      code.includes("from 'swr'") ||
      code.includes('from "swr"') ||
      code.includes('from \'swr/dist/core\'') ||
      code.includes('useSWR') ||
      code.includes('mutate')
    )
  }

  extractCall(callNode: t.CallExpression, context: DetectorContext): ApiCall | null {
    const callee = callNode.callee

    if (!t.isIdentifier(callee)) return null

    const methodName = callee.name

    if (methodName === 'useSWR' || methodName === 'useSWRInfinite') {
      return this.extractUseSWRCall(callNode, context)
    }

    if (methodName === 'mutate' || methodName === 'mutateAsync') {
      // mutate 不产生 API 调用，只是缓存操作
      return null
    }

    return null
  }

  /**
   * 提取 useSWR 调用
   * useSWR('/api/users', fetcher)
   * useSWR(['users', id], () => fetch('/api/users/${id}'))
   * useSWR({ key: 'users', fetcher: () => fetch('/api/users') })
   */
  private extractUseSWRCall(callNode: t.CallExpression, context: DetectorContext): ApiCall | null {
    const args = callNode.arguments

    if (args.length === 0) return null

    const firstArg = args[0]

    // useSWR(key, fetcher, options)
    if (t.isStringLiteral(firstArg) || t.isTemplateLiteral(firstArg)) {
      // 字符串 key: useSWR('/api/users', fetcher)
      const pathResult = this.pathExtractor.extract(firstArg, context.variableValues)
      return this.createCallFromPathResult(callNode, context, pathResult, 'GET')
    }

    if (t.isArrayExpression(firstArg)) {
      // 数组 key: useSWR(['users', id], fetcher)
      const keyPath = this.extractKeyArray(firstArg, context)
      if (keyPath) {
        const pathResult = {
          rawPath: keyPath,
          normalizedPath: keyPath,
          hasDynamicSegments: keyPath.includes('{'),
          pathVariables: [],
          staticallyResolved: true,
        }
        return this.createCallFromPathResult(callNode, context, pathResult, 'GET')
      }
    }

    if (t.isObjectExpression(firstArg)) {
      // 对象 key: useSWR({ key, fetcher })
      const keyProp = this.getOption(firstArg, 'key')
      if (keyProp) {
        return this.extractUseSWRCall({ ...callNode, arguments: [keyProp, ...args.slice(1)] } as t.CallExpression, context)
      }
    }

    if (t.isIdentifier(firstArg)) {
      // 变量 key: useSWR(key, fetcher)
      // 尝试从变量值获取
      const keyValue = context.variableValues.get(firstArg.name)
      if (typeof keyValue === 'string') {
        const pathResult = {
          rawPath: keyValue,
          normalizedPath: keyValue,
          hasDynamicSegments: false,
          pathVariables: [],
          staticallyResolved: true,
        }
        return this.createCallFromPathResult(callNode, context, pathResult, 'GET')
      }
    }

    return null
  }

  private extractKeyArray(arr: t.ArrayExpression, context: DetectorContext): string | null {
    const parts: string[] = []

    for (let i = 0; i < Math.min(arr.elements.length, 5); i++) {
      const elem = arr.elements[i]
      if (!elem) continue

      if (t.isStringLiteral(elem)) {
        parts.push(elem.value)
      } else if (t.isNumericLiteral(elem)) {
        parts.push(`{${this.inferParamName(parts[parts.length - 1])}}`)
      } else if (t.isIdentifier(elem)) {
        const val = context.variableValues.get(elem.name)
        if (typeof val === 'string') {
          parts.push(val)
        } else {
          parts.push(`{${elem.name}}`)
        }
      }
    }

    if (parts.length > 0) {
      return '/' + parts.join('/')
    }
    return null
  }

  private inferParamName(resourceName: string): string {
    if (resourceName.endsWith('s')) {
      return resourceName.slice(0, -1) + 'Id'
    }
    return 'id'
  }

  private createCallFromPathResult(
    callNode: t.CallExpression,
    context: DetectorContext,
    pathResult: any,
    defaultMethod: HttpMethod
  ): ApiCall {
    return {
      id: this.generateId(defaultMethod, pathResult.normalizedPath, context.filePath, callNode.loc?.start.line || 0),
      method: defaultMethod,
      rawPath: pathResult.rawPath,
      normalizedPath: pathResult.normalizedPath,
      hasDynamicSegments: pathResult.hasDynamicSegments,
      pathVariables: pathResult.pathVariables,
      queryParams: pathResult.rawPath?.includes('?')
        ? this.pathExtractor.extractQueryParams(pathResult.rawPath)
        : [],
      location: { file: context.filePath, line: callNode.loc?.start.line || 0 },
      library: this.name,
      staticallyResolved: pathResult.staticallyResolved,
      unresolvedReason: pathResult.unresolvedReason,
    }
  }
}
