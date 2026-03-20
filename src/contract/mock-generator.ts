/**
 * Schema-Based Mock 生成器
 * 从 OpenAPI schema 生成精确的 Mock 数据
 */

import crypto from 'crypto'
import type { OpenAPISchema } from '../types/index.js'

export interface MockGenerationContext {
  fieldName?: string
  parent?: MockGenerationContext
  depth?: number
  maxDepth?: number
}

export class SchemaBasedMockGenerator {
  private readonly defaultMaxDepth = 5

  /**
   * 从 OpenAPI schema 生成精确 Mock 数据
   */
  generateFromSchema(
    endpoint: string,
    method: string,
    schema: OpenAPISchema,
    context?: MockGenerationContext
  ): any {
    const ctx = { ...context, depth: (context?.depth || 0) + 1 }
    return this.generateValue(schema, ctx)
  }

  /**
   * 递归生成值
   */
  private generateValue(schema: OpenAPISchema, context?: MockGenerationContext): any {
    // 深度检查，防止无限递归
    if (context?.depth && context.maxDepth && context.depth > context.maxDepth) {
      return null
    }

    // 处理 $ref
    if (schema.$ref) {
      // TODO: 解析 $ref 引用
      return this.generateFallbackValue(schema.$ref)
    }

    // 处理 allOf
    if (schema.allOf && schema.allOf.length > 0) {
      return this.mergeSchemas(schema.allOf, context)
    }

    // 处理 oneOf
    if (schema.oneOf && schema.oneOf.length > 0) {
      const selected = schema.oneOf[Math.floor(Math.random() * schema.oneOf.length)]
      return this.generateValue(selected, context)
    }

    // 处理 anyOf
    if (schema.anyOf && schema.anyOf.length > 0) {
      const selected = schema.anyOf[Math.floor(Math.random() * schema.anyOf.length)]
      return this.generateValue(selected, context)
    }

    // 基础类型
    switch (schema.type) {
      case 'string':
        return this.generateString(schema, context?.fieldName)
      case 'number':
      case 'integer':
        return this.generateNumber(schema)
      case 'boolean':
        return Math.random() > 0.5
      case 'array':
        return this.generateArray(schema, context)
      case 'object':
        return this.generateObject(schema, context)
      default:
        return this.generateFallbackValue(schema.type || 'unknown')
    }
  }

  /**
   * 生成字符串
   */
  private generateString(schema: OpenAPISchema, fieldName?: string): string {
    // 1. 检查 format
    if (schema.format) {
      return this.generateStringByFormat(schema.format)
    }

    // 2. 检查字段名（语义感知）
    if (fieldName) {
      const semantic = this.generateStringByFieldName(fieldName)
      if (semantic) {
        return semantic
      }
    }

    // 3. 检查 enum
    if (schema.enum && schema.enum.length > 0) {
      return schema.enum[Math.floor(Math.random() * schema.enum.length)]
    }

    // 4. 检查 pattern（简单处理）
    if (schema.pattern) {
      return this.generateStringByPattern(schema.pattern)
    }

    // 5. 根据约束生成
    const minLength = schema.minLength || 1
    const maxLength = schema.maxLength || 20
    const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength

    // 默认示例值
    const examples = ['example', 'sample', 'test', 'value']
    return examples[Math.floor(Math.random() * examples.length)].substring(0, length)
  }

  /**
   * 根据 format 生成字符串
   */
  private generateStringByFormat(format: string): string {
    const formatGenerators: Record<string, () => string> = {
      'email': () => 'user@example.com',
      'date-time': () => new Date().toISOString(),
      'date': () => new Date().toISOString().split('T')[0],
      'time': () => '10:30:00',
      'uri': () => 'https://example.com/resource',
      'url': () => 'https://example.com/resource',
      'uuid': () => crypto.randomUUID(),
      'byte': () => 'SGVsbG8gV29ybGQ=',
      'binary': () => 'binary-data',
      'password': () => 'SecurePass123!',
      'hostname': () => 'example.com',
      'ipv4': () => '192.168.1.1',
      'ipv6': () => '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
    }

    const generator = formatGenerators[format.toLowerCase()]
    return generator ? generator() : 'example'
  }

  /**
   * 根据字段名生成语义化字符串
   */
  private generateStringByFieldName(fieldName: string): string | null {
    const name = fieldName.toLowerCase()

    const patterns: Record<string, string> = {
      'email': 'user@example.com',
      'mail': 'user@example.com',
      'name': 'John Doe',
      'username': 'johndoe',
      'password': 'SecurePass123!',
      'passwd': 'SecurePass123!',
      'phone': '+1-555-0123-4567',
      'mobile': '+1-555-0123-4567',
      'tel': '+1-555-0123-4567',
      'avatar': 'https://i.pravatar.cc/150?u=1',
      'image': 'https://picsum.photos/150/150',
      'photo': 'https://picsum.photos/150/150',
      'picture': 'https://picsum.photos/150/150',
      'address': '123 Main St, City, Country',
      'zip': '12345',
      'postal': '12345',
      'code': '12345',
      'company': 'Acme Corporation',
      'organization': 'Acme Corporation',
      'org': 'Acme Corporation',
      'title': 'Software Engineer',
      'role': 'Software Engineer',
      'position': 'Software Engineer',
      'job': 'Software Engineer',
      'description': 'Lorem ipsum dolor sit amet',
      'content': 'Lorem ipsum dolor sit amet',
      'body': 'Lorem ipsum dolor sit amet',
      'text': 'Lorem ipsum dolor sit amet',
      'url': 'https://example.com/resource',
      'link': 'https://example.com/page',
      'href': 'https://example.com/page',
      'website': 'https://example.com',
      'domain': 'example.com',
      'host': 'example.com',
      'token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      'key': 'key_' + crypto.randomUUID().slice(0, 8),
      'id': crypto.randomUUID(),
      'uuid': crypto.randomUUID(),
      'guid': crypto.randomUUID(),
      'created': new Date().toISOString(),
      'updated': new Date().toISOString(),
      'date': new Date().toISOString().split('T')[0],
      'time': '10:30:00',
      'datetime': new Date().toISOString(),
      'timestamp': Date.now().toString(),
      'status': 'active',
      'state': 'active',
      'type': 'standard',
      'category': 'general',
      'tag': 'sample',
      'label': 'Sample Label',
      'locale': 'en-US',
      'lang': 'en',
      'language': 'en',
      'currency': 'USD',
      'price': '99.99',
      'amount': '100.00',
      'color': '#3498db',
      'colour': '#3498db',
    }

    // 精确匹配
    if (patterns[name]) {
      return patterns[name]
    }

    // 模糊匹配
    for (const [key, value] of Object.entries(patterns)) {
      if (name.includes(key)) {
        return value
      }
    }

    return null
  }

  /**
   * 根据正则表达式生成字符串（简化版）
   */
  private generateStringByPattern(pattern: string): string {
    // 常见模式的简单处理
    if (pattern === '^[a-z]+$') {
      return 'example'
    }
    if (pattern === '^[A-Z]+$') {
      return 'EXAMPLE'
    }
    if (pattern.includes('\\d')) {
      return '123'
    }
    if (pattern.includes('@')) {
      return 'user@example.com'
    }
    if (pattern.includes('^\\d+$')) {
      return '123456'
    }

    return 'example'
  }

  /**
   * 生成数字
   */
  private generateNumber(schema: OpenAPISchema): number {
    const min = schema.minimum ?? 0
    const max = schema.maximum ?? 100

    if (schema.type === 'integer') {
      return Math.floor(Math.random() * (max - min + 1)) + min
    }

    // 浮点数保留2位小数
    return parseFloat((Math.random() * (max - min) + min).toFixed(2))
  }

  /**
   * 生成数组
   */
  private generateArray(schema: OpenAPISchema, context?: MockGenerationContext): any[] {
    const minItems = schema.minItems ?? 1
    const maxItems = schema.maxItems ?? 5
    const count = Math.floor(Math.random() * (maxItems - minItems + 1)) + minItems

    if (!schema.items) {
      return []
    }

    return Array.from({ length: count }, () =>
      this.generateValue(schema.items as OpenAPISchema, context)
    )
  }

  /**
   * 生成对象
   */
  private generateObject(schema: OpenAPISchema, context?: MockGenerationContext): any {
    const obj: any = {}
    const properties = schema.properties || {}

    for (const [name, propSchema] of Object.entries(properties)) {
      const isRequired = (schema.required || []).includes(name)

      // 必填字段总是生成，可选字段 70% 概率生成
      if (isRequired || Math.random() > 0.3) {
        obj[name] = this.generateValue(propSchema as OpenAPISchema, {
          ...context,
          fieldName: name,
        })
      }
    }

    return obj
  }

  /**
   * 合并 allOf schemas
   */
  private mergeSchemas(schemas: OpenAPISchema[], context?: MockGenerationContext): any {
    const merged: any = {}

    for (const schema of schemas) {
      const value = this.generateValue(schema, context)
      if (value && typeof value === 'object') {
        Object.assign(merged, value)
      }
    }

    return merged
  }

  /**
   * 生成回退值
   */
  private generateFallbackValue(type: string): any {
    const fallbacks: Record<string, any> = {
      'string': 'example',
      'number': 42,
      'integer': 42,
      'boolean': true,
      'array': [],
      'object': {},
    }

    return fallbacks[type] || null
  }
}
