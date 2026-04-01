/**
 * 检测器基类
 * 所有前端 API 调用检测器的抽象基类
 */

import type * as t from '@babel/types'
import type { ApiCall, DetectedLibrary, HttpMethod } from '../types/frontendApiCall'
import { PathExtractor } from '../extractors/PathExtractor'
import { RequestBodyExtractor } from '../extractors/RequestBodyExtractor'

export interface DetectorContext {
  filePath: string
  variableValues: Map<string, any>
}

export abstract class BaseDetector {
  protected pathExtractor = new PathExtractor()
  protected requestBodyExtractor = new RequestBodyExtractor()

  /**
   * 检测器名称
   */
  abstract readonly name: DetectedLibrary

  /**
   * 检测此文件是否使用此检测器对应的库
   */
  abstract matchesFile(filePath: string, code: string): boolean

  /**
   * 从 CallExpression 中提取 API 调用
   */
  abstract extractCall(
    callNode: t.CallExpression,
    context: DetectorContext
  ): ApiCall | null

  /**
   * 提取 HTTP 方法
   */
  protected extractMethod(callNode: t.CallExpression): HttpMethod {
    // 默认从方法名推断
    if (t.isMemberExpression(callNode.callee)) {
      const methodName = callNode.callee.property
      if (t.isIdentifier(methodName)) {
        const m = methodName.name.toUpperCase()
        const validMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'ALL']
        if (validMethods.includes(m as HttpMethod)) {
          return m as HttpMethod
        }
      }
    }
    return 'GET'
  }

  /**
   * 从 call expression 提取 options 参数（第二个或第三个参数）
   */
  protected extractOptions(callNode: t.CallExpression): t.ObjectExpression | null {
    const args = callNode.arguments

    // 查找 options 对象参数
    for (const arg of args) {
      if (t.isObjectExpression(arg)) {
        return arg
      }
    }

    return null
  }

  /**
   * 从 options 对象中提取配置
   */
  protected getOption(options: t.ObjectExpression, key: string): t.Expression | null {
    for (const prop of options.properties) {
      if (t.isObjectProperty(prop) && !prop.computed) {
        const propKey = prop.key
        if (t.isIdentifier(propKey) && propKey.name === key) {
          return prop.value
        }
        if (t.isStringLiteral(propKey) && propKey.value === key) {
          return prop.value
        }
      }
    }
    return null
  }

  /**
   * 生成 API 调用 ID
   */
  protected generateId(method: string, path: string, file: string, line: number): string {
    return `${method}:${path}:${file}:${line}`
  }
}
