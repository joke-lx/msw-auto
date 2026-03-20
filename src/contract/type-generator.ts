/**
 * TypeScript 类型生成器
 * 从 OpenAPI schema 生成 TypeScript 接口定义
 */

import { pascalCase } from 'pascal-case'
import type { OpenAPISchema, OpenAPISpec } from '../types/index.js'

export interface TypeGenerationOptions {
  prefix?: string
  suffix?: string
  exportType?: 'interface' | 'type' | 'both'
  includeComments?: boolean
  semicolons?: boolean
}

export class TypeScriptTypeGenerator {
  private readonly defaultOptions: TypeGenerationOptions = {
    exportType: 'interface',
    includeComments: true,
    semicolons: true,
  }

  /**
   * 从 OpenAPI spec 生成 TypeScript 类型
   */
  generateTypes(openAPISpec: OpenAPISpec, options?: TypeGenerationOptions): string {
    const opts = { ...this.defaultOptions, ...options }

    let output = this.generateHeader()
    output += '\n'

    // 生成所有 schema 的类型
    if (openAPISpec.components?.schemas) {
      for (const [name, schema] of Object.entries(openAPISpec.components.schemas)) {
        output += this.generateSchemaType(name, schema as OpenAPISchema, opts)
        output += '\n'
      }
    }

    // 生成所有定义的类型（Swagger 2.0）
    if (openAPISpec.definitions) {
      for (const [name, schema] of Object.entries(openAPISpec.definitions)) {
        output += this.generateSchemaType(name, schema as OpenAPISchema, opts)
        output += '\n'
      }
    }

    return output
  }

  /**
   * 生成单个 schema 的类型
   */
  generateSchemaType(name: string, schema: OpenAPISchema, options: TypeGenerationOptions): string {
    const comment = this.generateComment(schema)
    const typeName = this.getTypeName(name, options)

    if (schema.type === 'object' || schema.properties) {
      return this.generateInterface(typeName, schema as OpenAPISchema, options, comment)
    }

    if (schema.enum) {
      return this.generateEnum(typeName, schema.enum, options, comment)
    }

    // 其他类型作为 type alias 生成
    const tsType = this.toTypeString(schema, options)
    return `${comment}${this.exportKeyword(options)} ${typeName} = ${tsType}${options.semicolons ? ';' : ''}\n`
  }

  /**
   * 生成接口
   */
  private generateInterface(
    name: string,
    schema: OpenAPISchema,
    options: TypeGenerationOptions,
    comment: string
  ): string {
    let output = `${comment}${this.exportKeyword(options)} ${name} {\n`

    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const isRequired = (schema.required || []).includes(propName)
        const optional = isRequired ? '' : '?'
        const propComment = this.generateComment(propSchema as OpenAPISchema, '  ')
        const tsType = this.toTypeString(propSchema as OpenAPISchema, options)

        output += `${propComment}  ${propName}${optional}: ${tsType}${options.semicolons ? ';' : ''}\n`
      }
    }

    output += '}'

    if (options.exportType === 'both') {
      // 同时生成 type alias
      return output + `\n\n${this.exportKeyword(options)} type ${name}Type = ${name}\n`
    }

    return output + '\n'
  }

  /**
   * 生成枚举
   */
  private generateEnum(
    name: string,
    enumValues: any[],
    options: TypeGenerationOptions,
    comment: string
  ): string {
    let output = `${comment}${this.exportKeyword(options)} enum ${name} {\n`

    for (const value of enumValues) {
      const enumKey = this.toEnumKey(value)
      const enumValue = typeof value === 'string' ? `"${value}"` : value
      output += `  ${enumKey} = ${enumValue},\n`
    }

    output += '}\n'
    return output
  }

  /**
   * 转换为 TypeScript 类型字符串
   */
  private toTypeString(schema: OpenAPISchema, options: TypeGenerationOptions): string {
    // 处理 $ref
    if (schema.$ref) {
      const refName = this.getRefTypeName(schema.$ref, options)
      return refName
    }

    // 处理数组
    if (schema.type === 'array') {
      const itemType = schema.items
        ? this.toTypeString(schema.items as OpenAPISchema, options)
        : 'any'
      return `${itemType}[]`
    }

    // 处理对象
    if (schema.type === 'object') {
      if (schema.additionalProperties) {
        const valueType = this.toTypeString(schema.additionalProperties as OpenAPISchema, options)
        return `Record<string, ${valueType}>`
      }
      return 'Record<string, any>'
    }

    // 基础类型
    switch (schema.type) {
      case 'string':
        return 'string'
      case 'number':
      case 'integer':
        return 'number'
      case 'boolean':
        return 'boolean'
      default:
        return 'any'
    }
  }

  /**
   * 从 $ref 获取类型名
   */
  private getRefTypeName(ref: string, options: TypeGenerationOptions): string {
    // #/components/schemas/User -> User
    // #/definitions/User -> User
    const parts = ref.split('/')
    const name = parts[parts.length - 1]

    // 清理特殊字符
    return this.getTypeName(name, options)
  }

  /**
   * 获取类型名
   */
  private getTypeName(name: string, options: TypeGenerationOptions): string {
    let typeName = pascalCase(name)

    if (options.prefix) {
      typeName = options.prefix + typeName
    }

    if (options.suffix) {
      typeName = typeName + options.suffix
    }

    return typeName
  }

  /**
   * 转换为枚举键名
   */
  private toEnumKey(value: any): string {
    if (typeof value === 'string') {
      // 移除特殊字符，转为大写
      return value
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/^[0-9]/, '_$&') // 数字开头加下划线
        .toUpperCase()
    }

    return `VALUE_${value}`
  }

  /**
   * 生成注释
   */
  private generateComment(schema: OpenAPISchema, indent = ''): string {
    if (!schema.description && !schema.title) {
      return ''
    }

    const lines: string[] = []
    if (schema.title) {
      lines.push(schema.title)
    }
    if (schema.description) {
      lines.push(schema.description)
    }

    if (lines.length === 0) {
      return ''
    }

    const comment = lines.join('\n * ')
    return `${indent}/**\n${indent} * ${comment}\n${indent} */\n`
  }

  /**
   * 生成文件头
   */
  private generateHeader(): string {
    return `/**
 * Auto-generated by MSW Auto
 * DO NOT EDIT MANUALLY
 */
`
  }

  /**
   * 获取导出关键字
   */
  private exportKeyword(options: TypeGenerationOptions): string {
    return options.exportType === 'type' ? 'export type' : 'export interface'
  }
}

// 简单的 pascalCase 实现（避免额外依赖）
function pascalCase(str: string): string {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\s/g, '')
}
