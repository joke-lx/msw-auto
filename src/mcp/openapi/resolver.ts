/**
 * OpenAPI $ref 引用解析
 */

import type { OpenAPISpec } from './types.js'

export class RefResolver {
  private spec: OpenAPISpec
  private cache: Map<string, any> = new Map()

  constructor(spec: OpenAPISpec) {
    this.spec = spec
  }

  /**
   * 解析 $ref 引用
   * 支持格式: #/components/schemas/User, #/definitions/User
   */
  resolve(ref: string): any {
    if (this.cache.has(ref)) {
      return this.cache.get(ref)
    }

    if (!ref.startsWith('#/')) {
      console.warn(`Unsupported $ref format: ${ref}`)
      return null
    }

    const path = ref.slice(2).split('/')
    let current: any = this.spec

    for (const segment of path) {
      if (!current || typeof current !== 'object') {
        console.warn(`Cannot resolve $ref: ${ref}`)
        return null
      }
      current = current[segment]
    }

    this.cache.set(ref, current)
    return current
  }

  /**
   * 递归解析对象中的所有 $ref
   */
  resolveAll(obj: any, visited: Set<string> = new Set()): any {
    if (!obj || typeof obj !== 'object') {
      return obj
    }

    // 检测循环引用
    if (obj.$ref) {
      if (visited.has(obj.$ref)) {
        return { type: 'circular', ref: obj.$ref }
      }
      visited.add(obj.$ref)
      const resolved = this.resolve(obj.$ref)
      return this.resolveAll(resolved, visited)
    }

    // 处理数组
    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveAll(item, new Set(visited)))
    }

    // 处理对象
    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = this.resolveAll(value, new Set(visited))
    }
    return result
  }

  /**
   * 解析 schema 定义
   */
  resolveSchema(schema: any): any {
    if (!schema) return null

    // 直接引用
    if (schema.$ref) {
      return this.resolveAll(schema)
    }

    // allOf 合并
    if (schema.allOf) {
      const merged: any = {}
      for (const subSchema of schema.allOf) {
        const resolved = this.resolveAll(subSchema)
        Object.assign(merged, resolved)
      }
      return merged
    }

    // oneOf/anyOf 返回第一个
    if (schema.oneOf || schema.anyOf) {
      const variants = schema.oneOf || schema.anyOf
      return this.resolveAll(variants[0])
    }

    return this.resolveAll(schema)
  }
}
