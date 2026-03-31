# MSW Auto — Feature Completion + DB Isolation Plan

## 决策记录
- **验证入口**：契约详情页 → 「验证前端」按钮 → `/validate?contractId=xxx`
- **AST 粒度**：目录递归扫描（用户输入项目根目录路径）
- **框架支持**：保持现有支持（Express/NestJS/Next.js/Fastify/Koa），未知框架文件跳过
- **数据库**：单用户本地工具，仅修复 `.gitignore`

---

## 功能一：AST 前端验证 UI + 后端实现

### 系统架构（新增后）

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
│                                                                 │
│  /contracts/:id (契约详情页)                                     │
│       │                                                         │
│       └── [验证前端] ──→ /validate?contractId=xxx               │
│                              │                                   │
│         ┌────────────────────┴────────────────────┐             │
│         │         ValidationPage                  │             │
│         │  ┌─────────────────────────────────┐   │             │
│         │  │ 前端路径输入框                     │   │             │
│         │  │ /path/to/frontend/project        │   │             │
│         │  └─────────────────────────────────┘   │             │
│         │         [开始验证]                       │             │
│         │                                          │             │
│         │  验证结果 Table                          │             │
│         │  ┌──────────────────────────────────┐  │             │
│         │  │ API 调用    │ 契约状态 │ 说明     │  │             │
│         │  │ GET /users  │    ✅    │ 匹配     │  │             │
│         │  │ POST /admin │    ❌    │ 路径缺失 │  │             │
│         │  └──────────────────────────────────┘  │             │
│         └─────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                    POST /api/contracts/:id/validate
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (Express)                            │
│                                                                 │
│  POST /api/contracts/:id/validate                               │
│       │                                                         │
│       ├── 获取 contract（从 DB）                                 │
│       ├── ASTEngine.analyzeDirectory(frontendPath)              │
│       │       └── 递归扫描 .ts/.tsx 文件                        │
│       │       └── 提取 API 调用（route + method + path）         │
│       │       └── 框架检测（Express/NestJS/Next.js/Fastify/Koa）│
│       │       └── 未知框架文件 → 记录到 warnings[]               │
│       │                                                         │
│       └── 对比 OpenAPI spec                                     │
│              ├── spec 有此 path+method → matched                │
│              ├── spec 无此 path → missing                       │
│              └── 类型不匹配 → typeMismatch                      │
│                                                                 │
│  返回：                                                          │
│  {                                                              │
│    contractId, status: 'done',                                 │
│    results: [{ method, path, status, detail }],               │
│    summary: { total, matched, missing, typeMismatch },        │
│    warnings: [{ file, message }]                               │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

### 文件变更清单

#### 后端（3 个文件）

**1. `src/mcp/ast/engine.ts`** — 新增 `analyzeDirectory()`
```
analyzeDirectory(dirPath: string, options?: { extensions?: string[] })
  → Promise<AnalysisResult>
  └── 递归扫描目录，返回所有文件分析结果汇总
```

**2. `src/server/routes/contracts.ts`** — 实现验证端点
```
POST /api/contracts/:id/validate
  Body: { frontendPath: string }
  Response 200: {
    contractId, status: 'done' | 'error',
    results: [{ method, path, matched, detail }],
    summary: { total, matched, missing, typeMismatch },
    warnings: [{ file, framework, message }]
  }
  400: { error: 'frontendPath is required' }
  400: { error: 'Contract has no OpenAPI spec' }
  404: { error: 'Contract not found' }
  500: { error: error.message }
```

**3. `src/server/contract/manager.ts`** — 新增 `validate()` 方法
```
validate(contractId: string, analysisResult: AnalysisResult)
  → { matched, missing, typeMismatch }
  └── 对比 AST 提取的 API 调用和 OpenAPI spec
```

#### 前端（4 个文件）

**4. `web/src/pages/Validation/index.tsx`** — 新增验证页面
```
URL: /validate?contractId=xxx
状态：
  - idle: 输入路径，准备开始
  - loading: 分析中（显示进度）
  - done: 显示结果表格
  - error: 显示错误信息

结果 Table 列：
  | API 调用 | 契约状态 | 说明 |
  | GET /users  | ✅ 匹配   | 响应 200 |
  | POST /admin | ❌ 路径缺失 | spec 中无此路径 |
  | PUT /items  | ⚠️ 类型不匹配 | expected string, got number |
```

**5. `web/src/router/index.tsx`** — 新增路由
```tsx
{ path: '/validate', element: <ValidationPage /> }
```

**6. `web/src/stores/contractStore.ts`** — 新增 store 方法
```ts
validateContract: (contractId: string, frontendPath: string) => Promise<ValidationResult>
```

**7. `web/src/pages/Contracts/detail.tsx`** — 契约详情页新增按钮
```
在现有操作栏添加：
<Button icon={<CheckOutlined />} onClick={() => navigate(`/validate?contractId=${id}`)}>
  验证前端
</Button>
```

#### 配置（1 个文件）

**8. `.gitignore`** — 数据库隔离
```
data/*.db-wal    ← 新增
data/*.db-shm    ← 新增
```

### 实施顺序

```
Step 1: 后端 validate 端点
  - ASTEngine.analyzeDirectory()  [1h]
  - contractManager.validate()     [1h]
  - POST /api/contracts/:id/validate [1h]
  - 用 curl 测试验证流程           [30min]

Step 2: 前端验证页面
  - ValidationPage 组件          [1h]
  - 路由 + 入口按钮               [30min]
  - store 方法                   [30min]
  - 联调前后端                   [1h]

Step 3: .gitignore 修复             [5min]
```

### Error & Rescue Registry

| 代码路径 | 失败场景 | 异常 | 用户看到 |
|----------|----------|------|----------|
| `POST /validate` | `frontendPath` 缺失 | 400 | "frontendPath is required" |
| `POST /validate` | 目录不存在 | ENOENT → 400 | "路径不存在" |
| `ASTEngine.analyzeFile` | 文件语法错误 | SyntaxError → 记录到 warnings[] | "N 个文件解析失败" |
| `POST /validate` | 契约不存在 | 404 | "Contract not found" |
| `POST /validate` | 契约无 spec | 400 | "Contract has no OpenAPI spec" |
| `analyzeDirectory` | 目录无权限 | EACCES → 400 | "无法读取目录" |
| `analyzeDirectory` | 超大目录（>10000 文件）| 限制扫描深度/数量 | 显示警告继续 |

### 验证结果状态枚举

```ts
type VerificationStatus =
  | 'matched'       // path + method 存在于 spec，类型匹配
  | 'missing'       // path + method 在 spec 中不存在
  | 'typeMismatch'  // path + method 存在但字段类型不匹配
  | 'methodMismatch'// path 存在但 method 不匹配
  | 'noContract'    // 契约本身无 spec（单独处理）
```

---

## 功能二：数据库隔离

### 修复内容

`.gitignore` 第 37-39 行改为：
```
# Data
data/*.db
data/*.db-journal
data/*.db-wal     ← 新增
data/*.db-shm     ← 新增
```

### 理由

SQLite WAL 模式会在 `data/` 目录生成：
- `mocks.db-wal` — Write-Ahead Log，包含未合并的写操作
- `mocks.db-shm` — 共享内存文件，用于 WAL 并发控制

这些文件是**运行时状态**，每次数据库写入都会变化，不应进入版本控制。

---

## NOT IN SCOPE

- 多用户/多租户数据库隔离（确认：单用户本地工具）
- YAML 格式的 OpenAPI spec 支持（`src/contract/discovery.ts:653` TODO）
- `$ref` 引用解析（`src/contract/mock-generator.ts:43` TODO）
- 契约版本历史功能（`src/server/routes/contracts.ts:249` TODO）
- 验证结果的持久化（验证结果仅返回给前端，不存储到 DB）
- AST 分析的进度实时推送（WebSocket/SSE）
- 非 TypeScript 语言（JavaScript、Python等）的 API 调用分析
