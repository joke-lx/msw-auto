# MSW Auto - 产品愿景与重构方案

> **版本**: 3.0.0 - API 契约驱动开发平台
> **日期**: 2026-03-20
> **状态**: 待实施

---

## 📋 执行摘要

### 产品重新定位

**从**：Mock 服务器工具
**到**：API 契约驱动开发平台

### 核心价值主张

```
后端改代码 → 前端 IDE 立即反应
Mock 数据 100% 匹配 Production
零配置，自动发现一切
完整的 API 版本管理
```

### 关键决策

1. **删除所有 MSW 库复制代码** (~650K) - 改为依赖官方 `msw` npm 包
2. **删除冗余目录** - `src/native/`, `src/iife/`, `src/shims/`
3. **重构核心架构** - 从 "Mock 服务器" 转变为 "契约中心"
4. **保留 MCP 服务** - 这是核心竞争力
5. **简化 Web UI** - 专注于契约管理，移除冗余功能

---

## 🏗️ 新架构设计

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MSW Auto 3.0 - 系统架构                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌────────────────────┐
│   后端开发者        │
│                    │
│  写代码 + OpenAPI   │
└─────────┬──────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OpenAPI 文档 (单一真相来源)                    │
│                                                                  │
│  • NestJS/Swagger 自动生成                                       │
│  • 手动编写 swagger.yaml                                         │
│  • MSW Auto AST 推断                                             │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MSW Auto - 契约中心                            │
│                                                                  │
│  ┌─────────────────────────────────────────────────────┐        │
│  │         OpenAPI Discovery Engine                     │        │
│  │  • 自动发现运行中的 OpenAPI 端点                      │        │
│  │  • 支持静态文件 (JSON/YAML)                           │        │
│  │  • 文件变化监听和自动重载                             │        │
│  └─────────────────────────────────────────────────────┘        │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────┐        │
│  │       Schema-Based Mock Generator                    │        │
│  │  • 从 schema 生成精确 Mock 数据                      │        │
│  │  • 智能类型推断 (email, uuid, date...)               │        │
│  │  • 边界情况生成 (空数组、null、极大值)                │        │
│  │  • 100% schema 一致性保证                             │        │
│  └─────────────────────────────────────────────────────┘        │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────┐        │
│  │         TypeScript Types Generator                   │        │
│  │  • 从 schema 生成 TypeScript 接口                   │        │
│  │  • 支持联合类型、可选字段、枚举                       │        │
│  │  • 生成完整的请求/响应类型                            │        │
│  └─────────────────────────────────────────────────────┘        │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────┐        │
│  │           Frontend AST Validator                     │        │
│  │  • 分析前端代码中的 API 调用                         │        │
│  │  • 对比 OpenAPI 定义检测不一致                        │        │
│  │  • 实时报告：                                        │        │
│  │    - 使用了未定义的 API                               │        │
│  │    - 访问了不存在的字段                               │        │
│  │    - 类型不匹配                                       │        │
│  │    - 缺少必填参数                                     │        │
│  └─────────────────────────────────────────────────────┘        │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────┐        │
│  │              Version & Diff Manager                   │        │
│  │  • API 变更历史追踪                                   │        │
│  │  • Diff 工具（对比不同版本）                          │        │
│  │  • 不兼容变更警告                                     │        │
│  │  • 变更通知（WebSocket 推送）                         │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
┌────────────────────┐          ┌────────────────────┐
│   Mock Server      │          │   TypeScript       │
│   (依赖官方 msw)    │          │   类型文件          │
│                    │          │                    │
│  • MSW 拦截请求    │          │  • 自动生成         │
│  • 返回精确 Mock   │          │  • IDE 自动补全     │
│  • 支持边界情况    │          │  • 类型检查         │
└────────────────────┘          └────────────────────┘
          │
          ▼
┌────────────────────┐
│   前端开发者        │
│                    │
│  使用 TypeScript   │
│  类型进行开发      │
└────────────────────┘
```

---

## 📁 新目录结构

### 删除的目录

```
❌ src/core/      - MSW 库复制 (改用 npm 依赖)
❌ src/browser/   - MSW 浏览器代码复制
❌ src/node/      - MSW Node 代码复制
❌ src/native/    - 空目录
❌ src/iife/      - 空目录
❌ src/shims/     - 空目录
❌ web/node_modules/ - 不应在仓库中
```

### 新目录结构

```
msw-auto/
├── package.json
├── tsconfig.json
├── cli/                        # CLI 工具 (保留)
│   ├── index.js
│   ├── commands/
│   └── ...
│
├── src/
│   ├── contract/                # 🆕 契约中心核心
│   │   ├── discovery.ts         # OpenAPI 自动发现
│   │   ├── parser.ts            # OpenAPI 解析器
│   │   ├── mock-generator.ts    # Schema-Based Mock 生成
│   │   ├── type-generator.ts    # TypeScript 类型生成
│   │   ├── validator.ts         # 前端 AST 验证器
│   │   ├── version-manager.ts   # 版本管理
│   │   └── diff-engine.ts       # Diff 工具
│   │
│   ├── mcp/                      # MCP 服务 (保留并优化)
│   │   ├── server.ts
│   │   ├── tools/
│   │   ├── openapi/             # OpenAPI 解析 (已有)
│   │   ├── ast/                 # AST 引擎 (已有)
│   │   └── llm-service.ts
│   │
│   ├── server/                   # Express 服务器 (重构)
│   │   ├── index.ts
│   │   ├── routes/
│   │   │   ├── contract.ts      # 🆕 契约相关 API
│   │   │   ├── mock.ts          # Mock 管理 API
│   │   │   └── types.ts         # 🆕 类型文件 API
│   │   ├── websocket/
│   │   └── storage/
│   │
│   └── types/                    # 🆕 共享类型定义
│       ├── openapi.ts
│       ├── contract.ts
│       └── config.ts
│
├── web/                         # Web UI (简化)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx    # 🆕 契约概览
│   │   │   ├── Contracts.tsx    # 🆕 契约列表
│   │   │   ├── ContractDetail.tsx # 🆕 契约详情
│   │   │   ├── Diff.tsx         # 🆕 Diff 视图
│   │   │   └── Settings.tsx
│   │   └── components/
│   └── package.json
│
├── data/                        # 数据存储
│   ├── contracts.db             # 🆕 契约数据库
│   └── mocks.db
│
└── docs/                        # 🆕 文档
    ├── ARCHITECTURE.md
    ├── API.md
    └── MIGRATION.md
```

---

## 🎯 核心功能设计

### 1. OpenAPI 自动发现

**文件**: `src/contract/discovery.ts`

```typescript
export class OpenAPIDiscovery {
  /**
   * 自动发现项目中的 OpenAPI 文档
   */
  async discover(projectPath: string): Promise<OpenAPISource[]> {
    const sources: OpenAPISource[] = [];

    // 1. 检查运行中的 API 端点
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
    ];

    const packageJson = await this.readPackageJson(projectPath);
    const serverUrl = packageJson?.mswAuto?.backendUrl || 'http://localhost:3000';

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${serverUrl}${endpoint}`, {
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          const spec = await response.json();
          return [{
            type: this.detectVersion(spec),
            source: 'live',
            url: `${serverUrl}${endpoint}`,
            spec,
            timestamp: new Date().toISOString(),
          }];
        }
      } catch {
        continue;
      }
    }

    return [];
  }
}
```

### 2. Schema-Based Mock 生成器

**文件**: `src/contract/mock-generator.ts`

```typescript
export class SchemaBasedMockGenerator {
  /**
   * 从 OpenAPI schema 生成精确 Mock 数据
   */
  generateFromSchema(
    endpoint: string,
    method: string,
    schema: OpenAPISchema,
    context?: { fieldName?: string }
  ): any {
    return this.generateValue(schema, context);
  }

  private generateValue(schema: OpenAPISchema, context?: { fieldName?: string }): any {
    // 处理 $ref
    if (schema.$ref) {
      const resolved = this.resolveRef(schema.$ref);
      return this.generateValue(resolved, context);
    }

    // 处理 allOf/oneOf/anyOf
    if (schema.allOf) {
      return this.mergeSchemas(schema.allOf, context);
    }
    if (schema.oneOf) {
      const selected = schema.oneOf[Math.floor(Math.random() * schema.oneOf.length)];
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

  private generateString(schema: OpenAPISchema, fieldName?: string): string {
    // 1. 检查 format
    if (schema.format === 'email') return 'user@example.com';
    if (schema.format === 'date-time') return new Date().toISOString();
    if (schema.format === 'uuid') return crypto.randomUUID();

    // 2. 检查字段名（语义感知）
    if (fieldName) {
      const name = fieldName.toLowerCase();
      if (name.includes('email')) return 'user@example.com';
      if (name.includes('name')) return 'John Doe';
      if (name.includes('avatar')) return 'https://i.pravatar.cc/150?u=1';
    }

    // 3. 检查 enum
    if (schema.enum) {
      return schema.enum[Math.floor(Math.random() * schema.enum.length)];
    }

    // 4. 默认值
    const examples = ['example', 'sample', 'test'];
    return examples[Math.floor(Math.random() * examples.length)];
  }
}
```

### 3. TypeScript 类型生成器

**文件**: `src/contract/type-generator.ts`

```typescript
export class TypeScriptTypeGenerator {
  /**
   * 从 OpenAPI schema 生成 TypeScript 接口
   */
  generateTypes(openAPISpec: OpenAPISpec): string {
    let output = '// Auto-generated by MSW Auto\n';
    output += '// DO NOT EDIT MANUALLY\n\n';

    // 生成所有 schema 的类型
    if (openAPISpec.components?.schemas) {
      for (const [name, schema] of Object.entries(openAPISpec.components.schemas)) {
        output += this.generateInterface(name, schema as OpenAPISchema);
        output += '\n';
      }
    }

    return output;
  }

  private generateInterface(name: string, schema: OpenAPISchema): string {
    let output = `export interface ${this.toPascalCase(name)} {\n`;

    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const isRequired = (schema.required || []).includes(propName);
        const optional = isRequired ? '' : '?';
        const tsType = this.toTypeString(propSchema as OpenAPISchema);
        const comment = this.getComment(propSchema as OpenAPISchema);

        if (comment) {
          output += `  /** ${comment} */\n`;
        }
        output += `  ${propName}${optional}: ${tsType};\n`;
      }
    }

    output += '}\n';
    return output;
  }

  private toTypeString(schema: OpenAPISchema): string {
    if (schema.$ref) {
      return this.getRefTypeName(schema.$ref);
    }

    switch (schema.type) {
      case 'string':
        return 'string';
      case 'number':
      case 'integer':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'array':
        const itemType = schema.items ? this.toTypeString(schema.items as OpenAPISchema) : 'any';
        return `${itemType}[]`;
      case 'object':
        return 'Record<string, any>';
      default:
        return 'any';
    }
  }
}
```

### 4. 前端 AST 验证器

**文件**: `src/contract/validator.ts`

```typescript
export class FrontendASTValidator {
  /**
   * 验证前端代码是否正确使用 API
   */
  async validateFrontendCode(
    frontendPath: string,
    openAPISpec: OpenAPISpec
  ): Promise<ValidationReport> {
    const report: ValidationReport = {
      totalApis: 0,
      matchedFields: 0,
      totalFields: 0,
      issues: [],
    };

    // 1. 分析前端代码中的 API 调用
    const frontendUsage = await this.analyzeFrontend(frontendPath);

    // 2. 对比 OpenAPI 定义
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
      }
    }

    return report;
  }
}
```

---

## 🔌 API 接口设计

### 契约管理 API

```
GET    /api/contracts           - 获取所有契约
POST   /api/contracts/discover  - 发现契约
GET    /api/contracts/:id       - 获取契约详情
DELETE /api/contracts/:id       - 删除契约

POST   /api/contracts/:id/sync  - 同步契约（重新获取）

GET    /api/contracts/:id/types - 获取 TypeScript 类型
GET    /api/contracts/:id/mocks - 获取 Mock 数据

POST   /api/contracts/:id/validate - 验证前端代码
GET    /api/contracts/:id/diff  - 获取版本 diff

GET    /api/contracts/:id/history - 获取版本历史
POST   /api/contracts/:id/rollback/:version - 回滚版本
```

### WebSocket 事件

```
CONTRACT_UPDATED    - 契约更新通知
CONTRACT_DELETED    - 契约删除通知
VALIDATION_RESULT   - 验证结果通知
TYPE_GENERATED      - 类型生成通知
```

---

## 📊 数据库设计

### contracts 表

```sql
CREATE TABLE contracts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,  -- 'live' | 'file' | 'config'
  source_url TEXT,
  version TEXT NOT NULL,      -- 'openapi3' | 'swagger2'
  spec TEXT NOT NULL,         -- JSON string
  hash TEXT NOT NULL,         -- 内容哈希，用于检测变化
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_synced_at TEXT
);

CREATE TABLE contract_versions (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  spec TEXT NOT NULL,
  diff TEXT,                  -- JSON diff
  created_at TEXT NOT NULL,
  FOREIGN KEY (contract_id) REFERENCES contracts(id)
);

CREATE TABLE validation_issues (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  endpoint TEXT,
  field TEXT,
  location TEXT,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  FOREIGN KEY (contract_id) REFERENCES contracts(id)
);
```

---

## 🚀 实施计划

### Phase 1: 核心重构 (Week 1-2)

**目标**: 清理冗余代码，建立新架构基础

#### Day 1-2: 清理代码
- [ ] 删除 `src/core/` - 改为依赖 `msw` npm 包
- [ ] 删除 `src/browser/`
- [ ] 删除 `src/node/`
- [ ] 删除空目录 `src/native/`, `src/iife/`, `src/shims/`
- [ ] 配置 `.gitignore` 忽略 `web/node_modules/`
- [ ] 更新 `package.json` 依赖

#### Day 3-4: 新建契约中心
- [ ] 创建 `src/contract/` 目录
- [ ] 实现 `OpenAPIDiscovery` 类
- [ ] 实现 `SchemaBasedMockGenerator` 类
- [ ] 实现 `TypeScriptTypeGenerator` 类
- [ ] 实现 `FrontendASTValidator` 类
- [ ] 实现 `VersionManager` 类
- [ ] 实现 `DiffEngine` 类

#### Day 5: 集成测试
- [ ] 端到端测试
- [ ] 真实 OpenAPI spec 测试
- [ ] 边界情况处理

### Phase 2: 服务器重构 (Week 2-3)

#### Day 1-3: API 路由
- [ ] 实现契约管理 API
- [ ] 实现类型生成 API
- [ ] 实现验证 API
- [ ] 实现 Diff API

#### Day 4-5: WebSocket
- [ ] 实现契约更新通知
- [ ] 实现验证结果推送

### Phase 3: Web UI 重构 (Week 3-4)

#### Day 1-2: 新页面
- [ ] 契约列表页面
- [ ] 契约详情页面
- [ ] Diff 视图页面
- [ ] 验证结果页面

#### Day 3-4: 集成
- [ ] 集成新 API
- [ ] WebSocket 连接
- [ ] 实时更新

### Phase 4: 文档和发布 (Week 4)

#### Day 1-2: 文档
- [ ] 编写 `ARCHITECTURE.md`
- [ ] 编写 `API.md`
- [ ] 编写 `MIGRATION.md`
- [ ] 更新 `README.md`

#### Day 3-5: 测试和发布
- [ ] 完整测试
- [ ] 性能优化
- [ ] 发布 v3.0.0

---

## 📝 迁移指南

### 从 v2.x 迁移到 v3.0

**破坏性变更**：

1. **不再包含 MSW 库代码**
   ```bash
   # 旧版本
   import { setupWorker } from 'msw-auto/src/browser'

   # 新版本
   import { setupWorker } from 'msw'
   ```

2. **配置文件变更**
   ```json
   // 旧版本
   {
     "port": 3001,
     "mocks": [...]
   }

   // 新版本
   {
     "contracts": [
       {
         "source": "live",
         "url": "http://localhost:3000/api-docs"
       }
     ]
   }
   ```

3. **API 变更**
   ```typescript
   // 旧版本
   await fetch('/api/mocks')

   // 新版本
   await fetch('/api/contracts')
   ```

---

## 🎯 成功指标

- ✅ OpenAPI 自动发现成功率 > 95%
- ✅ Mock 数据与 schema 匹配率 = 100%
- ✅ TypeScript 类型生成覆盖率 = 100%
- ✅ 前端验证准确率 > 90%
- ✅ 代码体积减少 60%
- ✅ 启动时间 < 2 秒
- ✅ 用户满意度 > 4.5/5

---

**文档版本**: 1.0
**创建日期**: 2026-03-20
**作者**: MSW Auto Team
