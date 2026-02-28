# LLM 智能生成方案

## 一、Claude API 集成架构

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    LLM 集成层                            │
│                                                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Claude Client                          │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────┐│  │
│  │  │ Prompt       │  │ Response     │  │ Code    ││  │
│  │  │ Builder      │  │ Parser       │  │ Generator││  │
│  │  └──────────────┘  └──────────────┘  └─────────┘│  │
│  └────────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Anthropic API                        │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────┐│  │
│  │  │ Messages API │  │ Streaming   │  │ Cache   ││  │
│  │  │             │  │ API         │  │ Manager ││  │
│  │  └──────────────┘  └──────────────┘  └─────────┘│  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 核心组件

#### 1.2.1 Claude Client

```typescript
// src/llm/claude-client.ts
import Anthropic, { Message, MessageParam } from '@anthropic-ai/sdk'
import {
  ClaudeConfig,
  ClaudeMessage,
  ClaudeContext,
  MockGenerationRequest,
  DocumentationRequest,
} from '../types'
import { PromptBuilder } from './prompt-builder'
import { ResponseParser } from './response-parser'
import { CodeGenerator } from './code-generator'
import { logger } from '../utils'
import { CacheManager } from '../cache'

export class ClaudeClient {
  private client: Anthropic
  private promptBuilder: PromptBuilder
  private responseParser: ResponseParser
  private codeGenerator: CodeGenerator

  constructor(
    private config: ClaudeConfig,
    private cache: CacheManager,
  ) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout,
      maxRetries: 3,
    })

    this.promptBuilder = new PromptBuilder()
    this.responseParser = new ResponseParser()
    this.codeGenerator = new CodeGenerator()
  }

  /**
   * 生成 Mock 数据
   */
  async generateMock(request: MockGenerationRequest): Promise<any> {
    try {
      // 1. 检查缓存
      const cacheKey = `mock:${JSON.stringify(request)}`
      const cached = await this.cache.get(cacheKey)
      if (cached) {
        logger.info('[Claude] Mock loaded from cache')
        return cached
      }

      // 2. 构建提示词
      const prompt = this.promptBuilder.buildMockPrompt(request)

      // 3. 调用 Claude API
      const response = await this.callClaude(prompt, request.context || {})

      // 4. 解析响应
      const mockData = this.responseParser.parseMockResponse(response)

      // 5. 缓存结果
      await this.cache.set(cacheKey, mockData)

      logger.info('[Claude] Mock generated successfully')
      return mockData
    } catch (error) {
      logger.error('[Claude] Error generating mock:', error)
      throw new Error(
        `Failed to generate mock: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 聊天交互
   */
  async chat(
    messages: ClaudeMessage[],
    context: ClaudeContext = {},
  ): Promise<string> {
    try {
      const systemPrompt = this.promptBuilder.buildSystemPrompt(context)

      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        system: systemPrompt,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      })

      const content = response.content[0] as any
      return content.text
    } catch (error) {
      logger.error('[Claude] Error in chat:', error)
      throw error
    }
  }

  /**
   * 生成文档
   */
  async generateDocumentation(request: DocumentationRequest): Promise<string> {
    try {
      const prompt = this.promptBuilder.buildDocumentationPrompt(request)

      const response = await this.callClaude(prompt, request.context || {})

      return response
    } catch (error) {
      logger.error('[Claude] Error generating documentation:', error)
      throw error
    }
  }

  /**
   * 改进 Mock
   */
  async improveMock(mock: any, instruction: string): Promise<any> {
    try {
      const prompt = this.promptBuilder.buildImprovePrompt(mock, instruction)

      const response = await this.callClaude(prompt, { existingMock: mock })

      const improvedMock = this.responseParser.parseMockResponse(response)

      logger.info('[Claude] Mock improved successfully')
      return improvedMock
    } catch (error) {
      logger.error('[Claude] Error improving mock:', error)
      throw error
    }
  }

  /**
   * 批量生成 Mock（从 OpenAPI 规范）
   */
  async generateFromOpenAPISpec(openApiSpec: any): Promise<any[]> {
    try {
      const prompt = this.promptBuilder.buildOpenAPIPrompt(openApiSpec)

      const response = await this.callClaude(prompt, {})

      const mocks = this.responseParser.parseMultipleMocks(response)

      logger.info(`[Claude] Generated ${mocks.length} mocks from OpenAPI spec`)
      return mocks
    } catch (error) {
      logger.error('[Claude] Error generating from OpenAPI:', error)
      throw error
    }
  }

  /**
   * 生成代码示例
   */
  async generateCodeExamples(
    api: any,
    languages: string[],
  ): Promise<Record<string, string>> {
    try {
      const prompt = this.promptBuilder.buildCodeExamplesPrompt(api, languages)

      const response = await this.callClaude(prompt, {})

      return this.responseParser.parseCodeExamples(response, languages)
    } catch (error) {
      logger.error('[Claude] Error generating code examples:', error)
      throw error
    }
  }

  /**
   * 流式生成
   */
  async *streamMock(request: MockGenerationRequest): AsyncGenerator<string> {
    try {
      const prompt = this.promptBuilder.buildMockPrompt(request)
      const systemPrompt = this.promptBuilder.buildSystemPrompt(
        request.context || {},
      )

      const stream = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        stream: true,
      })

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          const delta = event.delta as any
          if (delta.text) {
            yield delta.text
          }
        }
      }
    } catch (error) {
      logger.error('[Claude] Error in stream:', error)
      throw error
    }
  }

  /**
   * 私有方法：调用 Claude API
   */
  private async callClaude(prompt: string, context: any): Promise<string> {
    const systemPrompt = this.promptBuilder.buildSystemPrompt(context)

    try {
      const message = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      })

      const content = message.content[0] as any
      return content.text
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        logger.error('[Claude] API Error:', {
          message: error.message,
          type: error.type,
          status: error.status,
        })
        throw error
      } else {
        throw error
      }
    }
  }

  /**
   * 测试连接
   */
  async ping(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: this.config.model,
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'ping',
          },
        ],
      })
      return true
    } catch (error) {
      logger.error('[Claude] Ping failed:', error)
      return false
    }
  }

  /**
   * 获取使用统计
   */
  getUsageStats() {
    // 返回 Token 使用统计（如果 API 支持）
    return {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
    }
  }
}
```

#### 1.2.2 Prompt Builder

````typescript
// src/llm/prompt-builder.ts
import { PromptBuilderConfig } from '../types'
import { logger } from '../utils'

export class PromptBuilder {
  private config: PromptBuilderConfig

  constructor(config?: Partial<PromptBuilderConfig>) {
    this.config = {
      includeExamples: true,
      includeContext: true,
      maxContextLength: 10000,
      ...config,
    }
  }

  /**
   * 构建 Mock 生成提示词
   */
  buildMockPrompt(request: any): string {
    const { method, url, headers, query, body, context } = request

    let prompt = `
Generate a realistic mock response for the following API request:

${this.formatRequestInfo(request)}

Requirements:
1. Generate realistic mock data that matches typical API responses
2. Include all necessary fields for a complete response
3. Use appropriate data types (strings, numbers, booleans, arrays, objects)
4. Provide realistic example values
5. Include status code and response structure
6. Add optional fields with null values where appropriate

Response format:
${this.getMockResponseFormat()}

${this.getAdditionalInstructions()}
`.trim()

    // 添加上下文
    if (context?.existingMocks && context.existingMocks.length > 0) {
      prompt += `\n\nExisting Mocks:\n${JSON.stringify(context.existingMocks.slice(0, 3), null, 2)}`
    }

    return prompt
  }

  /**
   * 构建系统提示词
   */
  buildSystemPrompt(context: any = {}): string {
    let prompt = `
You are an expert API mock generator with deep knowledge of:

- RESTful API design principles
- GraphQL specifications
- HTTP protocols and status codes
- JSON Schema and data modeling
- Various programming languages and frameworks

Your core responsibilities:
1. Generate realistic, well-structured mock data
2. Ensure data consistency across related endpoints
3. Follow industry best practices for API design
4. Handle edge cases and error scenarios appropriately
5. Provide clear documentation for generated mocks

Guidelines:
- Always return valid JSON
- Use appropriate HTTP status codes
- Include proper response headers
- Generate realistic example values
- Maintain consistency in naming conventions
- Handle optional fields correctly
- Include error responses when appropriate
- Consider pagination, filtering, and sorting for list endpoints

When generating mock data:
- Use realistic names, emails, phone numbers, etc.
- Include appropriate timestamps (ISO 8601 format)
- Generate realistic IDs (UUIDs or integers)
- Include relationship fields (foreign keys)
- Add metadata fields (created_at, updated_at, etc.)
`.trim()

    // 添加项目特定上下文
    if (context.projectInfo) {
      prompt += `\n\nProject Context:\n${JSON.stringify(context.projectInfo, null, 2)}`
    }

    // 添加 API 规范
    if (context.apiSpec) {
      prompt += `\n\nAPI Specification:\n${JSON.stringify(context.apiSpec, null, 2)}`
    }

    return prompt
  }

  /**
   * 构建文档生成提示词
   */
  buildDocumentationPrompt(request: DocumentationRequest): string {
    const { mock, context } = request

    return `
Generate comprehensive API documentation in Markdown format for the following mock:

${JSON.stringify(mock, null, 2)}

Requirements:
1. Include API overview and description
2. Document all endpoints (method, path, parameters)
3. Provide request/response examples
4. Document all response fields with types and descriptions
5. Include error codes and their meanings
6. Add usage examples in multiple languages (JavaScript, Python, curl)
7. Include authentication and authorization information
8. Document rate limits (if any)
9. Add notes on edge cases and special behaviors

Markdown Structure:
\`\`\`markdown
# API Name

## Overview
[Brief description]

## Authentication
[Authentication details]

## Endpoints

### Endpoint Name
**Method**: GET | POST | PUT | DELETE
**Path**: /path/to/endpoint
**Description**: [Description]

#### Request
\`\`\`json
{
  "field": "value"
}
\`\`\`

#### Response
\`\`\`json
{
  "data": { ... }
}
\`\`\`

#### Fields
| Field | Type | Description |
|-------|------|-------------|
| name | string | Field description |

## Error Codes
| Code | Description |
|------|-------------|
| 400 | Bad Request |

## Examples

### JavaScript
\`\`\`javascript
fetch('/api/endpoint', {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' }
}).then(res => res.json())
\`\`\`
\`\`\`

${this.getAdditionalInstructions()}
`.trim()
  }

  /**
   * 构建改进提示词
   */
  buildImprovePrompt(mock: any, instruction: string): string {
    return `
You have the following existing mock:

${JSON.stringify(mock, null, 2)}

User wants to improve it with the following instruction:
"${instruction}"

Please improve the mock according to the instruction while:
1. Maintaining the existing structure
2. Enhancing data quality and realism
3. Adding any missing fields
4. Improving edge case handling
5. Keeping response format consistent

Return the improved mock in JSON format.
`.trim()
  }

  /**
   * 构建 OpenAPI 提示词
   */
  buildOpenAPIPrompt(openApiSpec: any): string {
    return `
Analyze the following OpenAPI specification and generate mock data for all endpoints:

${JSON.stringify(openApiSpec, null, 2)}

For each endpoint, generate:
1. A successful response (200, 201, etc.)
2. An error response (400, 404, 500, etc.)
3. Additional response variants if applicable

Requirements:
1. Follow the schema definitions exactly
2. Use realistic example values
3. Handle all required fields
4. Include optional fields with null values where appropriate
5. Generate array responses with multiple items
6. Maintain consistency across related endpoints

Return the result in the following format:
\`\`\`json
{
  "mocks": [
    {
      "method": "GET",
      "path": "/api/users",
      "status": 200,
      "response": { ... },
      "description": "...",
      "tags": ["users", "list"]
    }
  ]
}
\`\`\`
`.trim()
  }

  /**
   * 构建代码示例提示词
   */
  buildCodeExamplesPrompt(api: any, languages: string[]): string {
    return `
Generate code examples for the following API in these languages: ${languages.join(', ')}

API Details:
${JSON.stringify(api, null, 2)}

Requirements:
1. Generate a complete, working example for each language
2. Include proper error handling
3. Add comments explaining the code
4. Use popular libraries for each language
5. Include authentication if required

Return the examples in JSON format:
\`\`\`json
{
  "javascript": "// JavaScript code here",
  "python": "# Python code here",
  "curl": "# curl command here"
}
\`\`\`
`.trim()
  }

  /**
   * 格式化请求信息
   */
  private formatRequestInfo(request: any): string {
    const lines = []

    lines.push('**Method:**', request.method)
    lines.push('**URL:**', request.url)
    lines.push('**Path:**', request.path)

    if (request.headers && Object.keys(request.headers).length > 0) {
      lines.push('')
      lines.push('**Headers:**')
      Object.entries(request.headers).forEach(([key, value]) => {
        if (
          !['host', 'content-length', 'connection'].includes(key.toLowerCase())
        ) {
          lines.push(`  ${key}: ${value}`)
        }
      })
    }

    if (request.query && Object.keys(request.query).length > 0) {
      lines.push('')
      lines.push('**Query Parameters:**')
      Object.entries(request.query).forEach(([key, value]) => {
        lines.push(`  ${key}: ${value}`)
      })
    }

    if (request.body) {
      lines.push('')
      lines.push('**Request Body:**')
      lines.push('```json')
      lines.push(JSON.stringify(request.body, null, 2))
      lines.push('```')
    }

    return lines.join('\n')
  }

  /**
   * 获取 Mock 响应格式
   */
  private getMockResponseFormat(): string {
    return `
\`\`\`json
{
  "method": "GET | POST | PUT | DELETE",
  "path": "/api/endpoint",
  "status": 200,
  "response": {
    "data": { ... },
    "message": "Success message"
  },
  "headers": {
    "Content-Type": "application/json"
  },
  "description": "Description of what this mock represents",
  "tags": ["users", "list", "rest"]
}
\`\`\`
`
  }

  /**
   * 获取额外指令
   */
  private getAdditionalInstructions(): string {
    return `
Additional Instructions:
- Ensure all timestamps are in ISO 8601 format
- Use UUID format for ID fields
- Generate realistic email addresses and phone numbers
- Include pagination metadata for list endpoints
- Add appropriate HTTP status codes
- Handle optional fields with null values
- Consider internationalization (i18n) where applicable
`
  }
}
````

#### 1.2.3 Response Parser

````typescript
// src/llm/response-parser.ts
import { logger } from '../utils'

export class ResponseParser {
  /**
   * 解析 Mock 响应
   */
  parseMockResponse(response: string): any {
    try {
      // 1. 尝试提取 JSON 代码块
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/)

      if (jsonMatch) {
        return JSON.parse(jsonMatch[1])
      }

      // 2. 尝试提取通用代码块
      const codeMatch = response.match(/```\n([\s\S]*?)\n```/)

      if (codeMatch) {
        return JSON.parse(codeMatch[1])
      }

      // 3. 尝试直接解析整个响应
      return JSON.parse(response)
    } catch (error) {
      logger.error('[ResponseParser] Failed to parse mock response:', error)
      logger.debug('Response content:', response)

      // 尝试从响应中提取 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0])
        } catch {
          throw new Error('Failed to parse mock response')
        }
      }

      throw new Error('Invalid mock response format')
    }
  }

  /**
   * 解析多个 Mock
   */
  parseMultipleMocks(response: string): any[] {
    try {
      const data = this.parseMockResponse(response)

      if (Array.isArray(data)) {
        return data
      }

      if (data.mocks && Array.isArray(data.mocks)) {
        return data.mocks
      }

      throw new Error('Invalid multiple mocks response format')
    } catch (error) {
      logger.error('[ResponseParser] Failed to parse multiple mocks:', error)
      throw error
    }
  }

  /**
   * 解析代码示例
   */
  parseCodeExamples(
    response: string,
    languages: string[],
  ): Record<string, string> {
    try {
      const data = this.parseMockResponse(response)

      const examples: Record<string, string> = {}

      for (const lang of languages) {
        if (data[lang]) {
          examples[lang] = data[lang]
        }
      }

      if (Object.keys(examples).length === 0) {
        // 尝试从代码块中提取
        languages.forEach((lang) => {
          const regex = new RegExp(`\`\`\`${lang}\n([\s\S]*?)\n\`\`\``, 'i')
          const match = response.match(regex)
          if (match) {
            examples[lang] = match[1]
          }
        })
      }

      return examples
    } catch (error) {
      logger.error('[ResponseParser] Failed to parse code examples:', error)
      throw error
    }
  }

  /**
   * 清理响应文本
   */
  private cleanResponse(response: string): string {
    return (
      response
        .trim()
        // 移除 Markdown 代码块标记
        .replace(/```[a-z]*\n?/gi, '')
        // 移除多余的空行
        .replace(/\n{3,}/g, '\n\n')
    )
  }
}
````

---

## 二、提示词工程

### 2.1 系统提示词模板

```typescript
// src/llm/prompts/system-prompts.ts
export const SYSTEM_PROMPTS = {
  mockGenerator: `
You are an expert API mock generator with deep knowledge of RESTful APIs, GraphQL, and HTTP protocols.

Core Responsibilities:
1. Generate realistic, well-structured mock data
2. Ensure data consistency across related endpoints
3. Follow industry best practices for API design
4. Handle edge cases and error scenarios appropriately

Guidelines:
- Always return valid JSON
- Use appropriate HTTP status codes
- Include proper response headers
- Generate realistic example values
- Maintain consistency in naming conventions
- Handle optional fields correctly
- Include error responses when appropriate
- Consider pagination, filtering, and sorting for list endpoints

Data Quality Standards:
- Use realistic names, emails, phone numbers
- Include appropriate timestamps (ISO 8601)
- Generate realistic IDs (UUIDs or integers)
- Include relationship fields (foreign keys)
- Add metadata fields (created_at, updated_at)
- Validate data types match schema definitions
`,

  documentationGenerator: `
You are an expert API documentation generator with deep knowledge of:
- RESTful API documentation standards
- Markdown formatting
- Multiple programming languages
- API design best practices

Documentation Requirements:
1. Comprehensive and clear descriptions
2. Accurate request/response examples
3. Field-by-field documentation with types
4. Error code documentation
5. Usage examples in multiple languages
6. Authentication and authorization details
7. Rate limiting information
8. Edge cases and special behaviors

Documentation Structure:
- API Overview
- Authentication
- Endpoints (method, path, description)
- Request/Response examples
- Field documentation
- Error codes
- Code examples
`,

  codeGenerator: `
You are an expert code generator with deep knowledge of:
- Multiple programming languages (JavaScript, Python, Java, etc.)
- HTTP client libraries in each language
- Best practices for API integration
- Error handling patterns

Code Generation Requirements:
1. Complete, working code
2. Proper error handling
3. Clear comments and documentation
4. Use popular, well-maintained libraries
5. Follow language-specific conventions
6. Include authentication if needed
7. Handle edge cases appropriately
`,
}
```

### 2.2 上下文管理

```typescript
// src/llm/context-manager.ts
export interface ClaudeContext {
  projectInfo?: {
    name: string
    description: string
    version: string
    baseUrl: string
  }

  apiSpec?: any
  existingMocks?: any[]
  recentRequests?: any[]
  userPreferences?: {
    dataStyle?: 'realistic' | 'minimal' | 'detailed'
    locale?: string
    timezone?: string
    dateFormat?: string
  }

  conversationHistory?: ClaudeMessage[]
  currentRequest?: any
}

export class ContextManager {
  private maxHistoryLength = 10
  private contextTimeout = 3600000 // 1 hour

  private contexts: Map<string, { data: ClaudeContext; timestamp: number }> =
    new Map()

  create(
    sessionId: string,
    baseContext: Partial<ClaudeContext> = {},
  ): ClaudeContext {
    const context: ClaudeContext = {
      ...baseContext,
      conversationHistory: [],
    }

    this.contexts.set(sessionId, {
      data: context,
      timestamp: Date.now(),
    })

    return context
  }

  get(sessionId: string): ClaudeContext | null {
    const entry = this.contexts.get(sessionId)

    if (!entry) {
      return null
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > this.contextTimeout) {
      this.contexts.delete(sessionId)
      return null
    }

    return entry.data
  }

  update(sessionId: string, updates: Partial<ClaudeContext>): void {
    const entry = this.contexts.get(sessionId)

    if (!entry) {
      return
    }

    entry.data = { ...entry.data, ...updates }
    entry.timestamp = Date.now()
  }

  addMessage(sessionId: string, message: ClaudeMessage): void {
    const context = this.get(sessionId)

    if (!context) {
      return
    }

    if (!context.conversationHistory) {
      context.conversationHistory = []
    }

    context.conversationHistory.push(message)

    // 保持历史记录长度
    if (context.conversationHistory.length > this.maxHistoryLength) {
      context.conversationHistory = context.conversationHistory.slice(
        -this.maxHistoryLength,
      )
    }

    this.update(sessionId, { conversationHistory: context.conversationHistory })
  }

  getRecentContext(sessionId: string): any {
    const context = this.get(sessionId)

    if (!context) {
      return {}
    }

    return {
      existingMocks: context.existingMocks?.slice(-5),
      recentRequests: context.recentRequests?.slice(-10),
      userPreferences: context.userPreferences,
    }
  }

  clear(sessionId: string): void {
    this.contexts.delete(sessionId)
  }

  cleanup(): void {
    const now = Date.now()

    for (const [sessionId, entry] of this.contexts.entries()) {
      if (now - entry.timestamp > this.contextTimeout) {
        this.contexts.delete(sessionId)
      }
    }
  }
}
```

---

## 三、智能功能

### 3.1 自适应 Mock 生成

```typescript
// src/llm/adaptive-generator.ts
export class AdaptiveMockGenerator {
  private usagePatterns: Map<string, number> = new Map()
  private successRates: Map<string, number> = new Map()

  trackUsage(mockId: string, success: boolean): void {
    const currentUsage = this.usagePatterns.get(mockId) || 0
    this.usagePatterns.set(mockId, currentUsage + 1)

    const currentSuccess = this.successRates.get(mockId) || 0
    const newSuccessRate =
      (currentSuccess * (currentUsage - 1) + (success ? 1 : 0)) / currentUsage
    this.successRates.set(mockId, newSuccessRate)
  }

  getUsageStats(mockId: string): { usage: number; successRate: number } {
    return {
      usage: this.usagePatterns.get(mockId) || 0,
      successRate: this.successRates.get(mockId) || 0,
    }
  }

  shouldOptimize(mockId: string): boolean {
    const stats = this.getUsageStats(mockId)
    return stats.usage > 100 && stats.successRate < 0.8
  }

  async optimizeMock(mockId: string, feedback: string): Promise<any> {
    // 根据使用反馈优化 Mock
    // ...
  }
}
```

### 3.2 智能建议

```typescript
// src/llm/suggestion-engine.ts
export class SuggestionEngine {
  async analyzePatterns(requests: any[]): Promise<string[]> {
    const suggestions: string[] = []

    // 分析请求模式
    const patterns = this.detectPatterns(requests)

    // 生成改进建议
    for (const pattern of patterns) {
      suggestions.push(...this.generateSuggestions(pattern))
    }

    return suggestions
  }

  private detectPatterns(requests: any[]): any[] {
    // 检测常见模式
    // - 高频 404 错误
    // - 不一致的响应结构
    // - 缺少字段
    // - 数据类型不匹配
    return []
  }

  private generateSuggestions(pattern: any): string[] {
    // 根据模式生成建议
    return []
  }
}
```

---

## 四、错误处理和重试

### 4.1 重试策略

```typescript
// src/llm/retry-handler.ts
export class RetryHandler {
  private maxRetries = 3
  private baseDelay = 1000
  private maxDelay = 10000

  async execute<T>(
    operation: () => Promise<T>,
    options?: {
      maxRetries?: number
      onRetry?: (attempt: number, error: Error) => void
    },
  ): Promise<T> {
    const maxRetries = options?.maxRetries ?? this.maxRetries
    let lastError: Error

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error

        if (attempt === maxRetries) {
          break
        }

        // 计算退避延迟
        const delay = this.calculateDelay(attempt)

        // 调用回调
        options?.onRetry?.(attempt + 1, lastError)

        // 等待
        await this.sleep(delay)
      }
    }

    throw lastError
  }

  private calculateDelay(attempt: number): number {
    // 指数退避
    return Math.min(this.baseDelay * Math.pow(2, attempt), this.maxDelay)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
```

---

## 五、总结

LLM 智能生成方案提供了：

✅ **完整的 Claude 集成**：支持多种 API 调用方式
✅ **智能提示词工程**：优化的提示词模板
✅ **上下文管理**：保持对话历史和项目上下文
✅ **响应解析**：健壮的解析器处理各种响应格式
✅ **错误处理**：自动重试和错误恢复
✅ **流式生成**：支持实时流式响应
✅ **缓存优化**：减少 API 调用成本
✅ **自适应学习**：根据使用模式优化 Mock

核心优势：

- **自动化**：无需手动编写 Mock 数据
- **智能化**：AI 理解上下文生成高质量数据
- **灵活性**：支持多种生成场景
- **可扩展**：易于添加新的功能
