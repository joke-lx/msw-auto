/**
 * 前端 API 调用类型定义
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'ALL'

export type DetectedLibrary =
  | 'fetch'
  | 'axios'
  | 'ky'
  | 'react-query'
  | 'swr'
  | 'tanstack-query'
  | 'vueuse'
  | 'umi-request'
  | 'taro-request'
  | 'node-fetch'
  | 'undici'
  | 'alova'
  | 'upper-ui'
  | 'unknown'

export interface ApiCallLocation {
  file: string
  line: number
  column?: number
}

export interface QueryParam {
  name: string
  value?: any
  type: 'static' | 'dynamic' | 'template'
}

export interface RequestBody {
  type: 'json' | 'form-data' | 'x-www-form-urlencoded' | 'binary' | 'unknown'
  schema?: Record<string, any>
  properties?: RequestBodyProperty[]
  raw?: string
}

export interface RequestBodyProperty {
  name: string
  value?: any
  type: 'static' | 'dynamic' | 'template'
  required: boolean
}

export interface ApiCall {
  id: string
  method: HttpMethod
  /** 原始路径，可能是静态字符串、模板字符串或变量 */
  rawPath: string
  /** 转换为 OpenAPI 模板格式的路径，如 /users/{id} */
  normalizedPath: string
  /** 路径是否包含动态变量 */
  hasDynamicSegments: boolean
  /** 动态路径段，如 {id} */
  pathVariables: string[]
  /** query 参数 */
  queryParams: QueryParam[]
  /** 请求体 */
  requestBody?: RequestBody
  /** 所属文件 */
  location: ApiCallLocation
  /** 检测到的 HTTP 库 */
  library: DetectedLibrary
  /** 库版本（如果能检测到） */
  libraryVersion?: string
  /** 是否能静态完全解析 */
  staticallyResolved: boolean
  /** 不可静态解析的原因（如果有） */
  unresolvedReason?: string
}

export interface FrontendApiExtractorResult {
  calls: ApiCall[]
  errors: ExtractorError[]
  warnings: ExtractorWarning[]
  meta: ExtractorMeta
}

export interface ExtractorError {
  file: string
  message: string
  line?: number
}

export interface ExtractorWarning {
  file: string
  library: DetectedLibrary
  message: string
}

export interface ExtractorMeta {
  filesScanned: number
  duration: number
  detectedLibraries: DetectedLibrary[]
  unsupportedFiles: string[]
  /** 是否为 monorepo */
  monorepoType?: 'pnpm' | 'yarn' | 'lerna' | null
  /** monorepo 包数量 */
  packagesScanned?: number
}
