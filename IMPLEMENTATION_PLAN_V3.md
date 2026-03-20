# MSW Auto 3.0 - 实施计划

> **从 Mock 服务器到 API 契约驱动开发平台**
> **预计工期**: 4 周
> **团队规模**: 1-2 人

---

## 📅 总体时间表

```
Week 1: 清理代码 + 契约中心基础
Week 2: 服务器重构 + API 实现
Week 3: Web UI 重构
Week 4: 测试 + 文档 + 发布
```

---

## Week 1: 清理代码 + 契约中心基础

### Day 1-2: 代码清理

**负责人**: Backend Dev

#### 任务清单

- [ ] **删除冗余代码** (2h)
  - [ ] 删除 `src/core/` 目录
  - [ ] 删除 `src/browser/` 目录
  - [ ] 删除 `src/node/` 目录
  - [ ] 删除 `src/native/`, `src/iife/`, `src/shims/`
  - [ ] 更新 `.gitignore`

- [ ] **更新依赖** (1h)
  - [ ] 添加 `msw` npm 依赖
  - [ ] 移除不再需要的依赖
  - [ ] 更新 `package.json`
  - [ ] 运行 `pnpm install`

- [ ] **代码迁移** (4h)
  - [ ] 更新 CLI 代码导入
  - [ ] 更新 Server 代码导入
  - [ ] 更新 MCP 代码导入
  - [ ] 修复编译错误

#### 验收标准

```bash
# 编译成功
pnpm build

# 测试通过
pnpm test

# CLI 启动正常
pnpm cli

# MCP 服务正常
pnpm mcp
```

---

### Day 3-4: 契约中心核心

**负责人**: Backend Dev

#### 任务清单

- [ ] **创建目录结构** (0.5h)
  ```bash
  mkdir -p src/contract
  mkdir -p src/types
  ```

- [ ] **OpenAPIDiscovery 类** (4h)
  - [ ] 实现 `checkLiveEndpoints()`
  - [ ] 实现 `checkStaticFiles()`
  - [ ] 实现 `checkConfigFiles()`
  - [ ] 版本检测逻辑
  - [ ] 单元测试

- [ ] **SchemaBasedMockGenerator 类** (6h)
  - [ ] 实现 `generateFromSchema()`
  - [ ] 实现 `generateValue()` (递归)
  - [ ] 实现 `generateString()` (智能类型)
  - [ ] 实现 `generateNumber()`
  - [ ] 实现 `generateArray()`
  - [ ] 实现 `generateObject()`
  - [ ] $ref 解析
  - [ ] allOf/oneOf/anyOf 处理
  - [ ] 单元测试

- [ ] **TypeScriptTypeGenerator 类** (4h)
  - [ ] 实现 `generateTypes()`
  - [ ] 实现 `generateInterface()`
  - [ ] 实现 `toTypeString()`
  - [ ] 支持嵌套类型
  - [ ] 支持联合类型
  - [ ] 单元测试

#### 验收标准

```typescript
// 测试用例
const discovery = new OpenAPIDiscovery()
const sources = await discovery.discover('/path/to/project')
assert(sources.length > 0)

const generator = new SchemaBasedMockGenerator()
const mock = generator.generateFromSchema('/users', 'GET', userSchema)
assert(mock.email.includes('@'))

const typeGen = new TypeScriptTypeGenerator()
const types = typeGen.generateTypes(openAPISpec)
assert(types.includes('export interface User'))
```

---

### Day 5: 验证器和版本管理

**负责人**: Backend Dev

#### 任务清单

- [ ] **FrontendASTValidator 类** (6h)
  - [ ] 实现 `analyzeFrontend()`
  - [ ] 实现 `validateFrontendCode()`
  - [ ] 实现 `extractFieldsFromSchema()`
  - [ ] 报告生成
  - [ ] 单元测试

- [ ] **VersionManager 类** (3h)
  - [ ] 版本存储
  - [ ] 版本对比
  - [ ] 回滚功能
  - [ ] 单元测试

- [ ] **DiffEngine 类** (3h)
  - [ ] OpenAPI diff 算法
  - [ ] 变更检测
  - [ ] 不兼容警告
  - [ ] 单元测试

#### 验收标准

```typescript
// 测试用例
const validator = new FrontendASTValidator()
const report = await validator.validateFrontendCode('/path/to/frontend', spec)
assert(report.issues.length >= 0)

const versionManager = new VersionManager(db)
await versionManager.saveVersion(contractId, spec)
const history = await versionManager.getHistory(contractId)
assert(history.length > 0)
```

---

## Week 2: 服务器重构 + API 实现

### Day 1-3: API 路由

**负责人**: Backend Dev

#### 任务清单

- [ ] **ContractManager 类** (4h)
  - [ ] CRUD 操作
  - [ ] 存储集成
  - [ ] 缓存策略

- [ ] **契约管理 API** (4h)
  - [ ] `GET /api/contracts` - 列表
  - [ ] `POST /api/contracts/discover` - 发现
  - [ ] `GET /api/contracts/:id` - 详情
  - [ ] `DELETE /api/contracts/:id` - 删除
  - [ ] `POST /api/contracts/:id/sync` - 同步

- [ ] **类型和 Mock API** (3h)
  - [ ] `GET /api/contracts/:id/types` - 获取类型
  - [ ] `GET /api/contracts/:id/mocks` - 获取 Mock
  - [ ] `POST /api/contracts/:id/validate` - 验证

- [ ] **版本管理 API** (3h)
  - [ ] `GET /api/contracts/:id/history` - 历史
  - [ ] `GET /api/contracts/:id/diff` - Diff
  - [ ] `POST /api/contracts/:id/rollback/:version` - 回滚

#### 验收标准

```bash
# API 测试
curl http://localhost:3001/api/contracts
curl http://localhost:3001/api/contracts/discover -X POST
curl http://localhost:3001/api/contracts/:id/types
```

---

### Day 4-5: WebSocket 和集成

**负责人**: Backend Dev

#### 任务清单

- [ ] **WebSocket 服务** (4h)
  - [ ] 契约更新通知
  - [ ] 验证结果推送
  - [ ] 连接管理

- [ ] **数据库迁移** (3h)
  - [ ] contracts 表
  - [ ] contract_versions 表
  - [ ] validation_issues 表

- [ ] **集成测试** (3h)
  - [ ] 端到端流程
  - [ ] 错误处理
  - [ ] 性能测试

#### 验收标准

```typescript
// WebSocket 测试
const ws = new WebSocket('ws://localhost:3001/ws')
ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  assert(data.type === 'CONTRACT_UPDATED')
}
```

---

## Week 3: Web UI 重构

### Day 1-2: 新页面开发

**负责人**: Frontend Dev

#### 任务清单

- [ ] **ContractList 页面** (4h)
  - [ ] 契约列表展示
  - [ ] 搜索和过滤
  - [ ] 状态指示

- [ ] **ContractDetail 页面** (6h)
  - [ ] 契约详情展示
  - [ ] Schema 可视化
  - [ ] 端点列表

- [ ] **DiffViewer 页面** (4h)
  - [ ] 版本对比
  - [ ] 高亮显示
  - [ ] 变更统计

- [ ] **ValidationReport 页面** (4h)
  - [ ] 问题列表
  - [ ] 严重程度标识
  - [ ] 修复建议

#### 验收标准

```bash
# 页面可访问
http://localhost:3000/contracts
http://localhost:3000/contracts/:id
http://localhost:3000/contracts/:id/diff
http://localhost:3000/contracts/:id/validation
```

---

### Day 3-4: 集成和优化

**负责人**: Frontend Dev

#### 任务清单

- [ ] **API 集成** (4h)
  - [ ] API 客户端封装
  - [ ] 错误处理
  - [ ] 加载状态

- [ ] **WebSocket 集成** (3h)
  - [ ] 实时更新
  - [ ] 重连机制
  - [ ] 通知提示

- [ ] **UI 优化** (3h)
  - [ ] 响应式设计
  - [ ] 加载动画
  - [ ] 错误提示

#### 验收标准

- 所有页面功能正常
- WebSocket 实时更新工作
- UI 响应式设计

---

### Day 5: CLI 更新

**负责人**: Backend Dev

#### 任务清单

- [ ] **CLI 命令重构** (4h)
  - [ ] `msw-auto discover` - 发现契约
  - [ ] `msw-auto types` - 生成类型
  - [ ] `msw-auto validate` - 验证前端
  - [ ] `msw-auto diff` - 查看变更

- [ ] **交互式菜单更新** (2h)
  - [ ] 契约管理选项
  - [ ] 状态显示

#### 验收标准

```bash
# CLI 测试
npx msw-auto discover
npx msw-auto types
npx msw-auto validate
```

---

## Week 4: 测试 + 文档 + 发布

### Day 1-2: 测试

**负责人**: 全员

#### 任务清单

- [ ] **单元测试** (4h)
  - [ ] 核心类覆盖
  - [ ] 边界情况
  - [ ] 错误处理

- [ ] **集成测试** (4h)
  - [ ] API 测试
  - [ ] WebSocket 测试
  - [ ] 端到端流程

- [ ] **性能测试** (2h)
  - [ ] 大型 OpenAPI 文档
  - [ ] 并发请求
  - [ ] 内存使用

#### 验收标准

```bash
# 测试覆盖率 > 80%
pnpm test --coverage

# 性能基准
pnpm benchmark
```

---

### Day 3-4: 文档

**负责人**: Technical Writer

#### 任务清单

- [ ] **ARCHITECTURE.md** (3h)
  - [ ] 系统架构图
  - [ ] 核心组件说明
  - [ ] 数据流图

- [ ] **API.md** (2h)
  - [ ] API 端点文档
  - [ ] 请求/响应示例
  - [ ] 错误码说明

- [ ] **MIGRATION.md** (2h)
  - [ ] 从 v2.x 迁移指南
  - [ ] 破坏性变更
  - [ ] 迁移脚本

- [ ] **README.md 更新** (1h)
  - [ ] 新功能介绍
  - [ ] 快速开始
  - [ ] 配置说明

#### 验收标准

- 文档完整
- 示例可运行
- 格式统一

---

### Day 5: 发布

**负责人**: Release Manager

#### 任务清单

- [ ] **版本准备** (2h)
  - [ ] 更新版本号
  - [ ] 生成 CHANGELOG
  - [ ] 创建 Git tag

- [ ] **发布测试** (2h)
  - [ ] npm 包测试
  - [ ] 安装测试
  - [ ] 功能验证

- [ ] **正式发布** (1h)
  - [ ] 发布到 npm
  - [ ] 创建 GitHub Release
  - [ ] 更新网站

#### 验收标准

```bash
# 发布验证
npm install -g msw-auto
msw-auto --version  # 应显示 3.0.0
```

---

## 📊 里程碑

| 里程碑 | 日期 | 交付物 |
|--------|------|--------|
| M1: 代码清理完成 | Day 2 | 冗余代码删除，依赖更新 |
| M2: 契约中心完成 | Day 5 | 核心类实现并通过测试 |
| M3: API 完成 | Day 10 | 所有 API 可用 |
| M4: Web UI 完成 | Day 15 | 所有页面可访问 |
| M5: 测试完成 | Day 18 | 测试覆盖率 > 80% |
| M6: 发布完成 | Day 20 | v3.0.0 正式发布 |

---

## 🎯 成功指标

### 技术指标

- [ ] 代码体积减少 > 60%
- [ ] 测试覆盖率 > 80%
- [ ] API 响应时间 < 100ms (p95)
- [ ] WebSocket 延迟 < 50ms
- [ ] 内存使用 < 200MB

### 功能指标

- [ ] OpenAPI 自动发现成功率 > 95%
- [ ] Mock 数据与 schema 匹配率 = 100%
- [ ] TypeScript 类型生成覆盖率 = 100%
- [ ] 前端验证准确率 > 90%

### 用户体验指标

- [ ] 启动时间 < 2 秒
- [ ] CLI 响应时间 < 1 秒
- [ ] Web UI 加载时间 < 3 秒
- [ ] 文档完整性 = 100%

---

## ⚠️ 风险和缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| MSW npm 包兼容性问题 | 高 | 中 | 提前测试，准备降级方案 |
| 性能问题 | 中 | 中 | 性能测试，优化关键路径 |
| 文档不完整 | 中 | 低 | 提前开始编写，持续更新 |
| 测试覆盖不足 | 高 | 中 | TDD 开发，持续集成 |
| 发布延期 | 中 | 低 | 缓冲时间，关键路径管理 |

---

## 📝 每日站会问题

1. 昨天完成了什么？
2. 今天计划做什么？
3. 有什么阻塞？
4. 需要什么帮助？

---

**创建日期**: 2026-03-20
**计划版本**: 1.0
**状态**: 待执行
