/**
 * React Query / TanStack Query 检测器
 * 检测 useQuery, useMutation, useSWR, fetchQuery 等调用
 */

import type * as t from '@babel/types'
import type { ApiCall, HttpMethod } from '../types/frontendApiCall'
import { BaseDetector, type DetectorContext } from './BaseDetector'

export class ReactQueryDetector extends BaseDetector {
  readonly name = 'react-query' as const

  // React Query v5 / TanStack Query
  private static readonly QUERY_METHODS = [
    'useQuery',
    'useQueryClient',
    'useMutation',
    'useSuspenseQuery',
    'useBaseQuery',
    'useBaseMutation',
  ] as const

  // TanStack Query specific
  private static readonly TANSTACK_METHODS = [
    'useQuery',
    'useMutation',
    'useInfiniteQuery',
    'useSuspenseQuery',
    'useBaseQuery',
    'fetchQuery',
    'fetchInfiniteQuery',
    'prefetchQuery',
    'invalidateQueries',
    'setQueryData',
  ] as const

  matchesFile(filePath: string, code: string): boolean {
    return (
      code.includes('from \'@tanstack/react-query\'') ||
      code.includes('from "@tanstack/react-query"') ||
      code.includes('from \'react-query\'') ||
      code.includes('from "react-query"') ||
      code.includes('from \'@tanstack/query-core\'') ||
      code.includes('from "@tanstack/query-core"') ||
      // 通用检测：任何包含 useQuery 或 useMutation 的文件
      code.includes('useQuery') ||
      code.includes('useMutation') ||
      code.includes('fetchQuery')
    )
  }

  extractCall(callNode: t.CallExpression, context: DetectorContext): ApiCall | null {
    const callee = callNode.callee

    if (!t.isIdentifier(callee)) return null

    const methodName = callee.name

    // 检测是否是我们关心的 React Query 方法
    if (ReactQueryDetector.QUERY_METHODS.includes(methodName as any) ||
        ReactQueryDetector.TANSTACK_METHODS.includes(methodName as any)) {
      return this.extractQueryCall(callNode, context, methodName)
    }

    return null
  }

  /**
   * 提取 React Query 调用
   * useQuery({ queryKey: ['users'], queryFn: () => fetch('/api/users') })
   * useQuery(['users', id], () => fetch(`/api/users/${id}`))
   * fetchQuery({ queryKey: ['user', id], queryFn: () => fetch(`/api/users/${id}`) })
   */
  private extractQueryCall(
    callNode: t.CallExpression,
    context: DetectorContext,
    methodName: string
  ): ApiCall | null {
    const args = callNode.arguments

    // useQuery 的两种形式:
    // 1. useQuery(options) - React Query v5
    // 2. useQuery(queryKey, queryFn, options) - React Query v4

    if (args.length === 0) return null

    // 检测调用风格
    const firstArg = args[0]

    if (t.isObjectExpression(firstArg)) {
      // useQuery({ queryKey, queryFn, ... })
      return this.extractObjectStyleCall(callNode, context, methodName)
    } else if (t.isArrayExpression(firstArg)) {
      // useQuery(['users', id], queryFn, options)
      return this.extractArrayStyleCall(callNode, context, methodName)
    } else if (t.isIdentifier(firstArg)) {
      // useQuery(queryKey) 或 queryFn 作为第一个参数（不常见）
      return null
    }

    return null
  }

  /**
   * 对象风格: useQuery({ queryKey: ['users'], queryFn: () => fetch('/api/users') })
   */
  private extractObjectStyleCall(
    callNode: t.CallExpression,
    context: DetectorContext,
    methodName: string
  ): ApiCall | null {
    const options = callNode.arguments[0] as t.ObjectExpression
    if (!t.isObjectExpression(options)) return null

    // 提取 queryFn
    const queryFnProp = this.getOption(options, 'queryFn')
    if (!queryFnProp) {
      // 没有 queryFn，可能是 queryKey only (只定义缓存键)
      return null
    }

    // 从 queryFn 中提取 URL
    const apiCall = this.extractFromQueryFn(queryFnProp, context, methodName)
    if (!apiCall) return null

    // 尝试从 queryKey 补充路径信息
    const queryKeyProp = this.getOption(options, 'queryKey')
    if (queryKeyProp) {
      const keyPath = this.extractQueryKeyPath(queryKeyProp, context)
      if (keyPath && !apiCall.staticallyResolved) {
        apiCall.rawPath = keyPath
        apiCall.normalizedPath = keyPath
        apiCall.staticallyResolved = true
      }
    }

    return apiCall
  }

  /**
   * 数组风格: useQuery(['users', id], () => fetch('/api/users'))
   */
  private extractArrayStyleCall(
    callNode: t.CallExpression,
    context: DetectorContext,
    methodName: string
  ): ApiCall | null {
    const args = callNode.arguments

    // args[0] = queryKey 数组
    // args[1] = queryFn
    // args[2] = options (可选)

    if (args.length < 2) return null

    const queryFn = args[1]
    if (!t.isArrowFunctionExpression(queryFn) && !t.isFunctionExpression(queryFn)) {
      return null
    }

    // 从 queryFn 的 return 语句中提取 fetch/axios 调用
    return this.extractFromQueryFnBody(queryFn.body, context, methodName)
  }

  /**
   * 从 queryFn 属性值中提取 API 调用
   */
  private extractFromQueryFn(
    queryFnNode: t.Expression,
    context: DetectorContext
  ): ApiCall | null {
    // 支持直接是函数表达式
    if (t.isArrowFunctionExpression(queryFnNode) || t.isFunctionExpression(queryFnNode)) {
      return this.extractFromQueryFnBody(queryFnNode.body, context)
    }

    // 支持是变量引用
    if (t.isIdentifier(queryFnNode)) {
      const fn = context.variableValues.get(queryFnNode.name)
      // 变量引用的函数，暂时无法追踪
      return null
    }

    return null
  }

  /**
   * 从 queryFn 的函数体中提取 API 调用
   */
  private extractFromQueryFnBody(
    body: t.Statement | t.Expression,
    context: DetectorContext,
    methodName = 'useQuery'
  ): ApiCall | null {
    // 情况1: 直接 return fetch('/api/...') 或 return axios.get('/api/...')
    if (t.isReturnStatement(body) && body.argument) {
      return this.extractFromReturnValue(body.argument, context, methodName)
    }

    // 情况2: 函数体是块语句，里面有 return
    if (t.isBlockStatement(body)) {
      for (const stmt of body.body) {
        if (t.isReturnStatement(stmt) && stmt.argument) {
          return this.extractFromReturnValue(stmt.argument, context, methodName)
        }
      }
    }

    // 情况3: 箭头函数直接是表达式: () => fetch('/api/...')
    if (t.isExpressionStatement(body)) {
      // 这种情况不应该发生，因为箭头函数的 body 如果是表达式会直接作为返回值
    }

    return null
  }

  /**
   * 从 return 的值中提取 API 调用
   */
  private extractFromReturnValue(
    node: t.Expression,
    context: DetectorContext,
    methodName: string
  ): ApiCall | null {
    // 支持: return fetch('/api/...')
    if (t.isCallExpression(node) && t.isIdentifier(node.callee) && node.callee.name === 'fetch') {
      // 使用 FetchDetector 的逻辑
      const fetchDetector = new (require('./FetchDetector').FetchDetector)()
      return fetchDetector.extractCall(node, context)
    }

    // 支持: return axios.get('/api/...')
    if (t.isCallExpression(node) && t.isMemberExpression(node.callee)) {
      const calleeObj = node.callee.object
      if (t.isIdentifier(calleeObj) && calleeObj.name === 'axios') {
        const axiosDetector = new (require('./AxiosDetector').AxiosDetector)()
        return axiosDetector.extractCall(node, context)
      }
    }

    // 支持: return api.get('/api/...') 等封装
    if (t.isCallExpression(node) && t.isMemberExpression(node.callee)) {
      // 通用的 HTTP 方法调用
      return this.extractGenericHttpCall(node, context)
    }

    return null
  }

  /**
   * 提取通用的 HTTP 调用
   */
  private extractGenericHttpCall(
    callNode: t.CallExpression,
    context: DetectorContext
  ): ApiCall | null {
    const callee = callNode.callee

    if (!t.isMemberExpression(callee)) return null

    const method = callee.property
    if (!t.isIdentifier(method)) return null

    const httpMethods: Record<string, HttpMethod> = {
      get: 'GET',
      post: 'POST',
      put: 'PUT',
      patch: 'PATCH',
      delete: 'DELETE',
      head: 'HEAD',
      options: 'OPTIONS',
    }

    const httpMethod = httpMethods[method.name.toLowerCase()]
    if (!httpMethod) return null

    const args = callNode.arguments
    if (args.length === 0) return null

    const urlNode = args[0]
    const pathResult = this.pathExtractor.extract(urlNode, context.variableValues)

    if (!pathResult.staticallyResolved) {
      return {
        id: this.generateId(httpMethod, '', context.filePath, callNode.loc?.start.line || 0),
        method: httpMethod,
        rawPath: pathResult.rawPath || '[dynamic]',
        normalizedPath: '',
        hasDynamicSegments: true,
        pathVariables: pathResult.pathVariables,
        queryParams: [],
        location: { file: context.filePath, line: callNode.loc?.start.line || 0 },
        library: this.name,
        staticallyResolved: false,
        unresolvedReason: pathResult.unresolvedReason,
      }
    }

    return {
      id: this.generateId(httpMethod, pathResult.normalizedPath, context.filePath, callNode.loc?.start.line || 0),
      method: httpMethod,
      rawPath: pathResult.rawPath,
      normalizedPath: pathResult.normalizedPath,
      hasDynamicSegments: pathResult.hasDynamicSegments,
      pathVariables: pathResult.pathVariables,
      queryParams: pathResult.rawPath.includes('?')
        ? this.pathExtractor.extractQueryParams(pathResult.rawPath)
        : [],
      location: { file: context.filePath, line: callNode.loc?.start.line || 0 },
      library: this.name,
      staticallyResolved: pathResult.staticallyResolved,
    }
  }

  /**
   * 从 queryKey 数组中提取路径
   * 例如: ['users', { id: 1 }] -> /users
   *       ['users', 123] -> /users/{id}
   */
  private extractQueryKeyPath(queryKeyNode: t.Expression, context: DetectorContext): string | null {
    if (t.isArrayExpression(queryKeyNode)) {
      const elements = queryKeyNode.elements
      if (elements.length === 0) return null

      const parts: string[] = []

      for (let i = 0; i < Math.min(elements.length, 5); i++) {
        const elem = elements[i]
        if (!elem) continue

        if (t.isStringLiteral(elem)) {
          parts.push(elem.value)
        } else if (t.isNumericLiteral(elem)) {
          // 数字通常是 ID 参数
          parts.push(`{${this.inferParamName(parts[parts.length - 1])}}`)
        } else if (t.isObjectExpression(elem)) {
          // 对象通常是筛选参数，不影响路径
          break
        }
      }

      if (parts.length > 0) {
        return '/' + parts.join('/')
      }
    }

    return null
  }

  /**
   * 从资源名推断参数名
   */
  private inferParamName(resourceName: string): string {
    // 单数变复数后推断
    if (resourceName.endsWith('s')) {
      return resourceName.slice(0, -1) + 'Id'
    }
    if (resourceName.endsWith('y') && !['ay', 'ey', 'iy', 'oy', 'uy'].some(s => resourceName.endsWith(s))) {
      return resourceName.slice(0, -1) + 'ies' + 'Id'
    }
    return 'id'
  }
}
