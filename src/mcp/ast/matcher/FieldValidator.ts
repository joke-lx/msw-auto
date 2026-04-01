/**
 * 字段级校验器
 * 对比前端请求体/Query参数与 OpenAPI spec 中的 schema 定义
 */

import type { ApiCall, RequestBody, RequestBodyProperty } from '../types/frontendApiCall'

export interface FieldValidationResult {
  valid: boolean
  missingFields: FieldIssue[]
  extraFields: FieldIssue[]
  typeMismatch: FieldIssue[]
  totalRequiredFields: number
  totalMatchedFields: number
}

export interface FieldIssue {
  name: string
  expectedType?: string
  actualType?: string
  location: 'body' | 'query' | 'path'
  required?: boolean
}

/**
 * OpenAPI Schema 定义
 */
export interface OpenAPISchema {
  type?: string
  properties?: Record<string, OpenAPISchema>
  required?: string[]
  items?: OpenAPISchema
  $ref?: string
  enum?: any[]
  format?: string
  additionalProperties?: boolean | OpenAPISchema
}

/**
 * 字段级校验器
 */
export class FieldValidator {
  /**
   * 校验请求体字段
   */
  validateRequestBody(
    requestBody: RequestBody | undefined,
    specSchema: OpenAPISchema | undefined
  ): FieldValidationResult {
    const result: FieldValidationResult = {
      valid: true,
      missingFields: [],
      extraFields: [],
      typeMismatch: [],
      totalRequiredFields: 0,
      totalMatchedFields: 0,
    }

    if (!specSchema) {
      // spec 没有定义 schema，任何 body 都算合法
      return result
    }

    if (!requestBody) {
      // 前端没有 body，但 spec 要求了
      if (this.isRequiredBody(specSchema)) {
        result.valid = false
        result.missingFields.push({
          name: '[request body]',
          location: 'body',
          required: true,
        })
        result.totalRequiredFields = this.countRequiredFields(specSchema)
      }
      return result
    }

    // 获取 body 中的 properties
    const bodyProperties = requestBody.properties || []
    const bodyFields = this.extractFieldMap(bodyProperties)

    // 解析 spec schema
    const specProperties = this.resolveSchemaProperties(specSchema)
    const requiredFields = specSchema.required || []

    result.totalRequiredFields = requiredFields.length

    // 检查必填字段
    for (const fieldName of requiredFields) {
      const specField = specProperties[fieldName]
      const bodyField = bodyFields[fieldName]

      if (!bodyField) {
        result.missingFields.push({
          name: fieldName,
          expectedType: specField?.type,
          location: 'body',
          required: true,
        })
        result.valid = false
      } else {
        result.totalMatchedFields++
        // 类型检查
        if (specField?.type && bodyField.type !== 'dynamic' && bodyField.type !== 'template') {
          const actualType = this.inferJSType(bodyField.value)
          if (actualType && !this.isTypeCompatible(actualType, specField.type)) {
            result.typeMismatch.push({
              name: fieldName,
              expectedType: specField.type,
              actualType,
              location: 'body',
            })
          }
        }
      }
    }

    // 检查多余字段
    for (const fieldName of Object.keys(bodyFields)) {
      if (!specProperties[fieldName]) {
        result.extraFields.push({
          name: fieldName,
          location: 'body',
        })
      }
    }

    return result
  }

  /**
   * 校验 Query 参数
   */
  validateQueryParams(
    queryParams: { name: string; value?: any }[],
    specParams: Record<string, any>[]
  ): FieldValidationResult {
    const result: FieldValidationResult = {
      valid: true,
      missingFields: [],
      extraFields: [],
      typeMismatch: [],
      totalRequiredFields: 0,
      totalMatchedFields: 0,
    }

    if (!specParams || specParams.length === 0) {
      return result
    }

    // 构建 spec param map
    const specParamMap = new Map<string, any>()
    for (const param of specParams) {
      if (param.name) {
        specParamMap.set(param.name, param)
      }
    }

    // 提取 spec 定义的必填参数
    const requiredParams = specParams.filter((p) => p.required)
    result.totalRequiredFields = requiredParams.length

    // 检查前端 query params
    const frontendParams = new Map<string, any>()
    for (const qp of queryParams) {
      frontendParams.set(qp.name, qp)
    }

    // 检查必填
    for (const specParam of requiredParams) {
      if (!frontendParams.has(specParam.name)) {
        result.missingFields.push({
          name: specParam.name,
          expectedType: specParam.type || 'string',
          location: 'query',
          required: true,
        })
        result.valid = false
      } else {
        result.totalMatchedFields++
      }
    }

    // 检查多余
    for (const qp of queryParams) {
      if (!specParamMap.has(qp.name)) {
        result.extraFields.push({
          name: qp.name,
          location: 'query',
        })
      }
    }

    return result
  }

  /**
   * 解析 schema 中的 properties（支持 $ref）
   */
  private resolveSchemaProperties(schema: OpenAPISchema): Record<string, OpenAPISchema> {
    if (schema.properties) {
      return schema.properties
    }

    if (schema.$ref) {
      // 解析 $ref（简化版，实际需要解析完整 OpenAPI spec）
      // 格式: #/components/schemas/User
      const refPath = schema.$ref.split('/')
      if (refPath[0] === '#' && refPath[1] === 'components' && refPath[2] === 'schemas') {
        // 需要外部传入完整 schema 来解析
        return {}
      }
    }

    return {}
  }

  /**
   * 统计必填字段数量
   */
  private countRequiredFields(schema: OpenAPISchema): number {
    return schema.required?.length || 0
  }

  /**
   * 判断 body 是否必填
   */
  private isRequiredBody(schema: OpenAPISchema): boolean {
    // 如果 schema type 是 object，通常 body 是必填的
    return schema.type === 'object' || (schema.required && schema.required.length > 0)
  }

  /**
   * 从 property 数组提取 field map
   */
  private extractFieldMap(properties: RequestBodyProperty[]): Record<string, RequestBodyProperty> {
    const map: Record<string, RequestBodyProperty> = {}
    for (const prop of properties) {
      map[prop.name] = prop
    }
    return map
  }

  /**
   * 从 JS 值推断类型
   */
  private inferJSType(value: any): string {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'
    if (Array.isArray(value)) return 'array'
    return typeof value
  }

  /**
   * 判断 JS 类型是否兼容 OpenAPI 类型
   */
  private isTypeCompatible(jsType: string, openapiType: string): boolean {
    const typeMap: Record<string, string[]> = {
      string: ['string', 'date', 'date-time', 'password', 'email', 'uuid', 'uri', 'hostname', 'ipv4', 'ipv6', 'byte', 'binary'],
      number: ['number', 'float', 'double', 'integer'],
      boolean: ['boolean'],
      array: ['array'],
      object: ['object'],
    }

    const compatible = typeMap[jsType]
    if (!compatible) return true // 无法判断时保守通过

    return compatible.includes(openapiType)
  }

  /**
   * 批量校验（用于 manager.ts 中的对比）
   */
  validateApiCall(
    call: ApiCall,
    specEndpoint: { requestBody?: any; parameters?: any }
  ): FieldValidationResult {
    const result: FieldValidationResult = {
      valid: true,
      missingFields: [],
      extraFields: [],
      typeMismatch: [],
      totalRequiredFields: 0,
      totalMatchedFields: 0,
    }

    // 校验 request body
    if (call.requestBody || (specEndpoint.requestBody?.content?.['application/json']?.schema)) {
      const specSchema = specEndpoint.requestBody?.content?.['application/json']?.schema
      const bodyResult = this.validateRequestBody(call.requestBody, specSchema)

      result.missingFields.push(...bodyResult.missingFields)
      result.extraFields.push(...bodyResult.extraFields)
      result.typeMismatch.push(...bodyResult.typeMismatch)
      result.totalRequiredFields += bodyResult.totalRequiredFields
      result.totalMatchedFields += bodyResult.totalMatchedFields
      result.valid = result.valid && bodyResult.valid
    }

    // 校验 query params
    if (call.queryParams.length > 0 || specEndpoint.parameters?.query) {
      const specQueryParams = specEndpoint.parameters?.query || []
      const queryResult = this.validateQueryParams(
        call.queryParams.map((q) => ({ name: q.name, value: q.value })),
        specQueryParams
      )

      result.missingFields.push(...queryResult.missingFields)
      result.extraFields.push(...queryResult.extraFields)
      result.typeMismatch.push(...queryResult.typeMismatch)
      result.totalRequiredFields += queryResult.totalRequiredFields
      result.totalMatchedFields += queryResult.totalMatchedFields
      result.valid = result.valid && queryResult.valid
    }

    return result
  }
}
