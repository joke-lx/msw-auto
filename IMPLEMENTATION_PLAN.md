# MSW Auto - OpenAPI标准方案实施计划

## 📋 项目概述

**目标**: 基于OpenAPI/Swagger标准，构建精确的API契约系统和Mock数据生成器

**核心原则**:
- ✅ 后端OpenAPI文档是唯一真实数据源
- ✅ Mock数据100%匹配schema定义
- ✅ 利用现有标准，不重新发明轮子
- ✅ 前端验证是可选的增强功能

---

## 🎯 问题定义

### 当前问题
- ❌ Mock数据盲目生成，基于路径猜测而非真实schema
- ❌ 前后端字段不匹配
- ❌ 无法获取前端所需的准确字段结构
- ❌ README承诺的"前端代码分析"功能未实现

### 解决方案
- ✅ 从后端OpenAPI/Swagger文档提取完整的API契约
- ✅ 基于schema生成精确的Mock数据
- ✅ 集成Swagger UI提供可视化文档
- ✅ 可选的前端代码验证功能

---

## 🏗️ 系统架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    单一数据源：OpenAPI/Swagger                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   后端框架                标准文档               Mock生成       │
│  ─────────              ─────────             ─────────         │
│  Express/Swagger  ───▶  OpenAPI 3.x   ───▶   精确Mock          │
│  NestJS/Swagger   ───▶  (或Swagger 2.0)     (基于schema)       │
│  Springdoc        ───▶       │               │                  │
│                        │       │               │                  │
│                        ▼       ▼               ▼                  │
│                    [解析器]  [验证器]      [生成器]              │
│                        │       │               │                  │
│                        └───────┴───────────────┘                  │
│                                  │                               │
│                                  ▼                               │
│                          ┌───────────────┐                       │
│                          │ Swagger UI    │  ← 用户查看           │
│                          │ (内置/托管)    │                       │
│                          └───────────────┘                       │
│                                                                  │
│   前端代码（可选验证）                                            │
│  ─────────────────                                              │
│  React/Vue组件  ───▶  验证前端使用  ───▶  报告不匹配             │
│                     vs OpenAPI定义                               │
└─────────────────────────────────────────────────────────────────┘
```

### 核心组件

| 组件 | 职责 | 优先级 |
|------|------|--------|
| OpenAPI Finder | 自动发现和获取OpenAPI文档 | P0 |
| Schema Parser | 解析OpenAPI schema，处理$ref | P0 |
| Schema-Based Generator | 基于schema生成精确Mock | P0 |
| Swagger UI Integration | 提供可视化API文档 | P0 |
| Frontend Validator | 验证前端API使用（可选） | P1 |
| File Watcher | 监听OpenAPI变化并更新Mock | P1 |

---

## 📂 文件结构

```
src/
├── mcp/
│   ├── openapi/
│   │   ├── finder.ts              🆕 自动发现OpenAPI文档
│   │   ├── schema-parser.ts       🔄 增强schema解析
│   │   ├── detector.ts            ✅ 已存在（版本检测）
│   │   ├── resolver.ts            ✅ 已存在（$ref解析）
│   │   ├── openapi3-parser.ts     ✅ 已存在
│   │   ├── swagger2-parser.ts     ✅ 已存在
│   │   └── index.ts               🔄 更新导出
│   ├── mock/
│   │   ├── schema-based-generator.ts  🆕 基于schema生成
│   │   ├── generator.ts           🔄 重构为适配器模式
│   │   └── ai-enhancer.ts         🆕 AI增强Mock数据
│   ├── frontend/
│   │   ├── validator.ts           🆕 前端验证器（可选）
│   │   ├── ast-analyzer.ts        🆕 前端AST分析
│   │   └── index.ts
│   └── server.ts                  🔄 集成Swagger UI
├── server/
│   ├── routes/
│   │   └── index.ts               🔄 添加OpenAPI相关路由
│   └── swagger-ui.ts              🆕 Swagger UI中间件
└── cli/
    └── commands/
        ├── discover.ts            🆕 发现OpenAPI命令
        ├── validate.ts            🆕 验证前端命令
        └── watch.ts               🆕 监听变化命令
```

---

## 🔧 核心实现

### 1. OpenAPI自动发现

**文件**: `src/mcp/openapi/finder.ts`

```typescript
/**
 * OpenAPI文档自动发现器
 */
export class OpenAPIFinder {
  /**
   * 自动发现项目中的OpenAPI/Swagger文档
   */
  async findOpenAPISpec(projectPath: string): Promise<OpenAPISource[]> {
    const sources: OpenAPISource[] = [];

    // 1. 检查运行中的API端点
    sources.push(...await this.checkLiveEndpoints(projectPath));

    // 2. 检查静态文件
    sources.push(...await this.checkStaticFiles(projectPath));

    // 3. 检查配置文件
    sources.push(...await this.checkConfigFiles(projectPath));

    return sources;
  }

  /**
   * 检查运行中的后端服务
   */
  private async checkLiveEndpoints(projectPath: string): Promise<OpenAPISource[]> {
    const endpoints = [
      '/api-docs',
      '/swagger.json',
      '/swagger/v1/swagger.json',
      '/openapi.json',
      '/api/openapi.json',
      '/v3/api-docs',
      '/v2/api-docs',
      '/docs/swagger.json',
    ];

    const sources: OpenAPISource[] = [];
    const packageJson = await this.readPackageJson(projectPath);
    const serverUrl = packageJson?.mswAuto?.backendUrl || 'http://localhost:3000';

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${serverUrl}${endpoint}`);
        if (response.ok) {
          const spec = await response.json();
          sources.push({
            type: this.detectVersion(spec),
            source: 'live',
            url: `${serverUrl}${endpoint}`,
            spec,
          });
          console.log(`✅ Found OpenAPI spec at: ${serverUrl}${endpoint}`);
          break;
        }
      } catch {
        continue;
      }
    }

    return sources;
  }

  private detectVersion(spec: any): 'openapi3' | 'swagger2' {
    if (spec.openapi) return 'openapi3';
    if (spec.swagger) return 'swagger2';
    throw new Error('Unknown OpenAPI version');
  }
}

export interface OpenAPISource {
  type: 'openapi3' | 'swagger2';
  source: 'live' | 'file' | 'config';
  url?: string;
  path?: string;
  spec: any;
}
```

### 2. Schema-Based Mock生成器

**文件**: `src/mcp/mock/schema-based-generator.ts`

```typescript
/**
 * 基于OpenAPI Schema的精确Mock生成器
 */
export class SchemaBasedMockGenerator {
  /**
   * 从OpenAPI schema生成精确Mock数据
   */
  generateFromSchema(
    endpoint: string,
    method: string,
    schema: OpenAPISchema,
    context?: { fieldName?: string }
  ): any {
    return this.generateValue(schema, context);
  }

  /**
   * 递归生成值
   */
  private generateValue(schema: OpenAPISchema, context?: { fieldName?: string }): any {
    // 处理$ref
    if (schema.$ref) {
      const resolved = this.resolveRef(schema.$ref);
      return this.generateValue(resolved, context);
    }

    // 处理allOf/oneOf/anyOf
    if (schema.allOf) {
      return this.mergeSchemas(schema.allOf, context);
    }
    if (schema.oneOf) {
      const selected = schema.oneOf[Math.floor(Math.random() * schema.oneOf.length)];
      return this.generateValue(selected, context);
    }
    if (schema.anyOf) {
      const selected = schema.anyOf[Math.floor(Math.random() * schema.anyOf.length)];
      return this.generateValue(selected, context);
    }

    // 基础类型
    switch (schema.type) {
      case 'string':
        return this.generateString(schema, context?.fieldName);
      case 'number':
      case 'integer':
        return this.generateNumber(schema);
      case 'boolean':
        return Math.random() > 0.5;
      case 'array':
        return this.generateArray(schema, context);
      case 'object':
        return this.generateObject(schema, context);
      default:
        return null;
    }
  }

  /**
   * 智能字符串生成
   */
  private generateString(schema: OpenAPISchema, fieldName?: string): string {
    // 1. 检查format
    if (schema.format === 'email') return 'user@example.com';
    if (schema.format === 'date-time') return new Date().toISOString();
    if (schema.format === 'date') return '2024-03-20';
    if (schema.format === 'uri' || schema.format === 'url') return 'https://example.com/resource';
    if (schema.format === 'uuid') return crypto.randomUUID();
    if (schema.format === 'byte') return 'SGVsbG8gV29ybGQ=';
    if (schema.format === 'binary') return 'binary-data';

    // 2. 检查字段名（语义感知）
    if (fieldName) {
      const name = fieldName.toLowerCase();
      if (name.includes('email')) return 'user@example.com';
      if (name.includes('name')) return 'John Doe';
      if (name.includes('username')) return 'johndoe';
      if (name.includes('password')) return 'SecurePass123!';
      if (name.includes('phone')) return '+1-555-0123-4567';
      if (name.includes('avatar') || name.includes('image') || name.includes('photo')) {
        return 'https://i.pravatar.cc/150?u=1';
      }
      if (name.includes('address')) return '123 Main St, City, Country';
      if (name.includes('zip') || name.includes('postal')) return '12345';
      if (name.includes('company')) return 'Acme Corporation';
      if (name.includes('title') || name.includes('role')) return 'Software Engineer';
      if (name.includes('description')) return 'Lorem ipsum dolor sit amet';
      if (name.includes('token') || name.includes('key')) return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
      if (name.includes('url') && !name.includes('avatar')) return 'https://example.com/resource/1';
    }

    // 3. 检查enum
    if (schema.enum) {
      return schema.enum[Math.floor(Math.random() * schema.enum.length)];
    }

    // 4. 检查pattern
    if (schema.pattern) {
      return this.generateFromPattern(schema.pattern);
    }

    // 5. 根据minLength/maxLength生成
    const minLength = schema.minLength || 1;
    const maxLength = schema.maxLength || 20;
    const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;

    // 默认示例值
    const examples = ['example', 'sample', 'test', 'value'];
    return examples[Math.floor(Math.random() * examples.length)].substring(0, length);
  }

  /**
   * 数字生成
   */
  private generateNumber(schema: OpenAPISchema): number {
    const min = schema.minimum ?? 0;
    const max = schema.maximum ?? 100;

    if (schema.type === 'integer') {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    return parseFloat((Math.random() * (max - min) + min).toFixed(2));
  }

  /**
   * 数组生成
   */
  private generateArray(schema: OpenAPISchema, context?: { fieldName?: string }): any[] {
    const minItems = schema.minItems ?? 1;
    const maxItems = schema.maxItems ?? 10;
    const count = Math.floor(Math.random() * (maxItems - minItems + 1)) + minItems;

    return Array.from({ length: count }, () =>
      this.generateValue(schema.items as OpenAPISchema, context)
    );
  }

  /**
   * 对象生成
   */
  private generateObject(schema: OpenAPISchema, context?: { fieldName?: string }): any {
    const obj: any = {};
    const properties = schema.properties || {};

    for (const [name, propSchema] of Object.entries(properties)) {
      const isRequired = (schema.required || []).includes(name);

      // 必填字段总是生成，可选字段70%概率生成
      if (isRequired || Math.random() > 0.3) {
        obj[name] = this.generateValue(propSchema as OpenAPISchema, {
          fieldName: name,
          parent: context,
        });
      }
    }

    return obj;
  }

  /**
   * 合并allOf schemas
   */
  private mergeSchemas(schemas: OpenAPISchema[], context?: { fieldName?: string }): any {
    const merged: any = {};

    for (const schema of schemas) {
      const value = this.generateValue(schema, context);
      Object.assign(merged, value);
    }

    return merged;
  }

  /**
   * 解析$ref引用
   */
  private resolveRef(ref: string): OpenAPISchema {
    // 从已解析的schemas中查找
    // 例如: #/components/schemas/User
    const parts = ref.split('/').slice(1);
    // 实现引用解析逻辑
    return {} as OpenAPISchema;
  }

  /**
   * 从正则表达式生成
   */
  private generateFromPattern(pattern: string): string {
    // 简单实现
    return 'example-value';
  }
}

export interface OpenAPISchema {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  format?: string;
  enum?: any[];
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  required?: string[];
  properties?: Record<string, OpenAPISchema>;
  items?: OpenAPISchema;
  allOf?: OpenAPISchema[];
  oneOf?: OpenAPISchema[];
  anyOf?: OpenAPISchema[];
  $ref?: string;
  description?: string;
  example?: any;
}
```

### 3. Swagger UI集成

**文件**: `src/server/swagger-ui.ts`

```typescript
/**
 * Swagger UI集成
 */
import express from 'express';
import { createRequire } from 'module';
import type { OpenAPISpec } from '../mcp/openapi/types.js';

const require = createRequire(import.meta.url);
const swaggerUiAssetPath = require('swagger-ui-dist').absolutePath();

export function setupSwaggerUI(
  app: express.Application,
  openAPISpec: OpenAPISpec,
  options: {
    path?: string;
    customCss?: string;
    customSiteTitle?: string;
  } = {}
) {
  const {
    path = '/api-docs',
    customCss = '',
    customSiteTitle = 'API Documentation'
  } = options;

  // 提供OpenAPI spec JSON
  app.get(`${path}/swagger.json`, (req, res) => {
    res.json(openAPISpec);
  });

  // 注入Swagger UI HTML
  app.get(path, (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${customSiteTitle}</title>
        <link rel="stylesheet" type="text/css" href="${path}/swagger-ui.css">
        ${customCss ? `<style>${customCss}</style>` : ''}
      </head>
      <body>
        <div id="swagger-ui"></div>
        <script src="${path}/swagger-ui-bundle.js" charset="UTF-8"></script>
        <script src="${path}/swagger-ui-standalone-preset.js" charset="UTF-8"></script>
        <script>
          window.onload = function() {
            const ui = SwaggerUIBundle({
              url: '${path}/swagger.json',
              dom_id: '#swagger-ui',
              deepLinking: true,
              presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIStandalonePreset
              ],
              plugins: [
                SwaggerUIBundle.plugins.DownloadUrl
              ],
              layout: "BaseLayout",
              defaultModelsExpandDepth: 1,
              defaultModelExpandDepth: 1,
              tryItOutEnabled: true,
              persistAuthorization: true,
              displayRequestDuration: true,
              displayOperationId: false,
              filter: true,
              showRequestHeaders: true,
              showCommonExtensions: true,
              syntaxHighlight: {
                activate: true,
                theme: 'monokai'
              }
            });

            window.ui = ui;
          }
        </script>
      </body>
      </html>
    `);
  });

  // 托管Swagger UI静态资源
  app.use(path, express.static(swaggerUiAssetPath));

  console.log(`📚 Swagger UI available at: http://localhost:3001${path}`);
}
```

### 4. 前端验证器（可选）

**文件**: `src/mcp/frontend/validator.ts`

```typescript
/**
 * 前端API使用验证器
 */
export class FrontendValidator {
  /**
   * 验证前端代码是否正确使用API
   */
  async validateFrontendUsage(
    frontendPath: string,
    openAPISpec: OpenAPISpec
  ): Promise<ValidationReport> {
    const report: ValidationReport = {
      totalApis: 0,
      matchedFields: 0,
      totalFields: 0,
      issues: [],
    };

    // 1. 分析前端代码中的API调用
    const frontendUsage = await this.analyzeFrontend(frontendPath);

    // 2. 对比OpenAPI定义
    for (const [endpoint, methods] of Object.entries(openAPISpec.paths)) {
      for (const [method, definition] of Object.entries(methods)) {
        const key = `${method.toUpperCase()} ${endpoint}`;
        const openAPIFields = this.extractFieldsFromSchema(
          definition.responses?.['200']?.content?.['application/json']?.schema
        );
        const frontendFields = frontendUsage[key] || [];

        report.totalApis++;
        report.totalFields += openAPIFields.length;

        // 检查缺失字段
        for (const field of frontendFields) {
          if (!this.hasField(openAPIFields, field.path)) {
            report.issues.push({
              type: 'missing-in-openapi',
              severity: 'error',
              endpoint: key,
              field: field.path,
              location: field.location,
              message: `Field '${field.path}' used in frontend but not defined in OpenAPI`,
            });
          } else {
            report.matchedFields++;
          }
        }

        // 检查类型不匹配
        for (const field of frontendFields) {
          const openAPIType = this.getFieldType(openAPIFields, field.path);
          if (openAPIType && openAPIType !== field.type) {
            report.issues.push({
              type: 'type-mismatch',
              severity: 'warning',
              endpoint: key,
              field: field.path,
              expected: openAPIType,
              actual: field.type,
              message: `Type mismatch for '${field.path}': expected ${openAPIType}, got ${field.type}`,
            });
          }
        }
      }
    }

    return report;
  }

  private async analyzeFrontend(frontendPath: string): Promise<FrontendUsage> {
    // 使用AST分析前端代码
    // 提取API调用和字段使用
    return {} as FrontendUsage;
  }

  private extractFieldsFromSchema(schema: any): FieldInfo[] {
    // 递归提取schema中的所有字段
    return [];
  }

  private hasField(fields: FieldInfo[], path: string): boolean {
    return fields.some(f => f.path === path);
  }

  private getFieldType(fields: FieldInfo[], path: string): string | undefined {
    return fields.find(f => f.path === path)?.type;
  }
}

export interface ValidationReport {
  totalApis: number;
  matchedFields: number;
  totalFields: number;
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  type: 'missing-in-openapi' | 'extra-in-openapi' | 'type-mismatch';
  severity: 'error' | 'warning' | 'info';
  endpoint: string;
  field: string;
  location?: string;
  expected?: string;
  actual?: string;
  message: string;
}

export interface FrontendUsage {
  [key: string]: FieldUsage[];
}

export interface FieldUsage {
  path: string;
  type: string;
  location: string;
}

export interface FieldInfo {
  path: string;
  type: string;
  required: boolean;
}
```

---

## 📦 依赖添加

### package.json更新

```json
{
  "dependencies": {
    "swagger-ui-dist": "^5.10.0",
    "json-schema-ref-parser": "^11.0.0",
    "swagger-parser": "^10.0.0",
    "chokidar": "^3.5.3"
  }
}
```

### 安装命令

```bash
pnpm add swagger-ui-dist json-schema-ref-parser swagger-parser chokidar
```

---

## 🚀 实施步骤

### Phase 1: 核心功能 (Week 1)

**目标**: 实现OpenAPI自动发现和Schema-Based Mock生成

#### Day 1-2: OpenAPI Finder
- [ ] 实现`OpenAPIFinder`类
- [ ] 支持从运行中的后端获取spec
- [ ] 支持从本地文件读取spec
- [ ] 单元测试

#### Day 3-4: Schema-Based Generator
- [ ] 实现`SchemaBasedMockGenerator`类
- [ ] 支持所有基础类型
- [ ] 支持嵌套对象和数组
- [ ] 智能字符串生成（语义感知）
- [ ] 单元测试

#### Day 5: 集成测试
- [ ] 端到端测试
- [ ] 真实OpenAPI spec测试
- [ ] 边界情况处理

### Phase 2: Swagger UI集成 (Week 2)

#### Day 1-2: Swagger UI服务器
- [ ] 实现`setupSwaggerUI`函数
- [ ] 自定义主题和样式
- [ ] 集成到Express服务器

#### Day 3-4: CLI命令
- [ ] `msw-auto discover` - 发现OpenAPI
- [ ] `msw-auto docs` - 启动Swagger UI
- [ ] 配置文件支持

#### Day 5: 测试和文档
- [ ] 集成测试
- [ ] 用户文档

### Phase 3: 可选增强 (Week 3+)

#### 前端验证器
- [ ] 前端AST分析
- [ ] 字段使用提取
- [ ] OpenAPI对比
- [ ] 报告生成

#### 文件监听
- [ ] OpenAPI变化监听
- [ ] 增量Mock更新
- [ ] WebSocket通知

#### AI增强
- [ ] Claude API集成
- [ ] 真实数据生成
- [ ] 业务逻辑推断

---

## 📊 预期效果

### 使用流程

```bash
# 1. 后端开发者启动服务器
cd backend && npm start
# ✅ Backend running at http://localhost:3000
# ✅ OpenAPI available at /api-docs

# 2. 前端开发者初始化MSW Auto
cd frontend
npx msw-auto init

# 输出:
# ✅ Auto-detected backend: http://localhost:3000
# ✅ Found OpenAPI 3.0 spec
# ✅ Parsed 47 endpoints
# ✅ Generated 47 precise mocks
#
# 📝 Mock server ready at http://localhost:3001
# 📚 Swagger UI at http://localhost:3001/api-docs

# 3. 前端直接使用
npm run dev
# ✅ 前端调用API → Mock服务器响应精确数据

# 4. 查看文档
open http://localhost:3001/api-docs
```

### 用户体验

访问 `http://localhost:3001/api-docs`：
- ✅ 完整的Swagger UI
- ✅ 所有API定义
- ✅ 可以直接测试Mock
- ✅ Schema可视化
- ✅ Try It Out功能

---

## ✅ 方案优势

| 优势 | 说明 |
|------|------|
| **标准化** | 使用OpenAPI/Swagger标准，业界通用 |
| **准确性** | Mock数据100%匹配schema定义 |
| **简单性** | 无需复杂的AST解析，利用现有文档 |
| **可维护性** | 后端更新文档，Mock自动更新 |
| **用户体验** | Swagger UI是业界标准，开发者熟悉 |
| **框架无关** | 适用于任何生成OpenAPI文档的后端框架 |
| **可选增强** | 前端验证是可选的，不是核心依赖 |

---

## 📝 配置示例

```json
// .msw-auto/config.json
{
  "openapi": {
    "source": "live",
    "url": "http://localhost:3000/api-docs",
    "refreshInterval": 60000,
    "autoUpdate": true
  },
  "mock": {
    "aiEnhanced": true,
    "defaultDelay": 0,
    "generateExamples": true
  },
  "swagger": {
    "enabled": true,
    "path": "/api-docs",
    "customSiteTitle": "My API Documentation"
  },
  "frontend": {
    "enabled": false,
    "path": "./src",
    "framework": "react"
  },
  "watch": {
    "enabled": true,
    "debounce": 1000
  }
}
```

---

## 🧪 测试策略

### 单元测试

```typescript
// src/mcp/openapi/finder.test.ts
describe('OpenAPIFinder', () => {
  it('should discover OpenAPI from live endpoint', async () => {
    const finder = new OpenAPIFinder();
    const sources = await finder.findOpenAPISpec('./test-project');
    expect(sources).toHaveLength(1);
    expect(sources[0].source).toBe('live');
  });
});

// src/mcp/mock/schema-based-generator.test.ts
describe('SchemaBasedMockGenerator', () => {
  it('should generate string with format email', () => {
    const generator = new SchemaBasedMockGenerator();
    const result = generator.generateFromSchema('/users', 'GET', {
      type: 'string',
      format: 'email'
    });
    expect(result).toMatch(/^[^@]+@[^@]+\.[^@]+$/);
  });

  it('should generate nested object', () => {
    const generator = new SchemaBasedMockGenerator();
    const result = generator.generateFromSchema('/users', 'GET', {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' }
          }
        }
      }
    });
    expect(result.user).toBeDefined();
    expect(result.user.id).toBeDefined();
    expect(result.user.name).toBeDefined();
  });
});
```

### 集成测试

```bash
# 使用真实的OpenAPI spec测试
npx msw-auto test --openapi ./test-fixtures/petstore.json

# 预期输出:
# ✅ Loaded OpenAPI spec: petstore.json
# ✅ Parsed 20 endpoints
# ✅ Generated 20 mocks
# ✅ All mocks validated successfully
```

---

## 📚 参考资料

- [OpenAPI 3.0 Specification](https://swagger.io/specification/)
- [Swagger 2.0 Specification](https://github.com/swagger-api/swagger-spec/blob/master/versions/2.0.md)
- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)
- [json-schema-ref-parser](https://apitools.dev/json-schema-ref-parser/)

---

## 🎯 成功指标

- ✅ OpenAPI自动发现成功率 > 95%
- ✅ Mock数据与schema匹配率 = 100%
- ✅ Swagger UI响应时间 < 100ms
- ✅ 端到端测试覆盖率 > 80%
- ✅ 用户满意度 > 4.5/5

---

**文档版本**: 1.0
**创建日期**: 2024-03-20
**最后更新**: 2024-03-20
**状态**: 待实施
