# MSW Auto AI 可控性增强方案

## CEO Review - SCOPE EXPANSION Mode

---

## 1. 问题陈述

MSW Auto 目前存在以下AI可控性问题：

| 问题 | 当前状态 | 影响 |
|------|----------|------|
| 多LLM支持 | 仅支持 Anthropic | 供应商锁定，无竞争 |
| 工具调用控制 | 无限制 | 成本失控风险 |
| 内容审核 | 无（仅regex解析） | 可能生成不合规内容 |
| 成本控制 | 无追踪 | 无法按项目/团队分摊成本 |
| 契约验证 | 无 | AI生成内容可能不符合API契约 |
| 审计日志 | 无 | 无法回溯AI决策 |

---

## 2. 目标架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      TARGET ARCHITECTURE (AI Gateway)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User ──► AIGateway ──► LLMRouter ──► [Anthropic | OpenAI | Custom]       │
│              │              │                                               │
│              │              └──► CostTracker                                │
│              │              └──► UsageRecorder                              │
│              │                                                               │
│              ├──► ContractGuardian ──► OpenAPI Validator                    │
│              │         (pre/post validation)                                │
│              │                                                               │
│              ├──► AuditLogger ──► [SQLite | File | Cloud]                  │
│              │                                                               │
│              └──► RateLimiter ──► Per-user/per-project limits               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 核心组件设计

### 3.1 AIGateway (统一入口)

```typescript
// src/server/ai/gateway.ts
interface AIGatewayConfig {
  providers: LLMProvider[]
  defaultProvider: string
  enableCostTracking: boolean
  enableAuditLogging: boolean
  enableContractValidation: boolean
  rateLimits: RateLimitConfig
}

class AIGateway {
  async generateMock(request: GenerateMockRequest): Promise<MockResponse>
  async chat(messages: ChatMessage[], context: any): Promise<string>
  async improveMock(mock: Mock, instruction: string): Promise<Partial<Mock>>
  async generateDocumentation(mock: Mock): Promise<string>

  // 审计追踪
  getAuditTrail(projectId: string): AuditLog[]
  getCostSummary(projectId: string): CostSummary
}
```

### 3.2 LLMRouter (智能路由)

```typescript
// 路由策略
interface RoutingStrategy {
  // 基于成本的路由
  routeByCost(endpoints: { method: string; path: string }): string

  // 基于质量的路由
  routeByQuality(task: string): string

  // 基于速度的路由
  routeByLatency(): string

  // 混合策略
  routeHybrid(task: string, context: any): string
}

// 支持的提供商
type LLMProvider = 'anthropic' | 'openai' | 'openrouter' | 'custom'

interface ProviderConfig {
  name: LLMProvider
  baseURL: string
  apiKey: string
  model: string
  costPer1KTokens: { input: number; output: number }
  rateLimit: { rpm: number; tpm: number }
  capabilities: ('chat' | 'mock' | 'doc' | 'improve')[]
}
```

### 3.3 CostTracker (成本追踪)

```typescript
// src/server/ai/cost-tracker.ts
interface TokenUsage {
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  cost: number
  timestamp: Date
}

interface ProjectBudget {
  projectId: string
  monthlyBudget: number
  currentSpend: number
  alertThreshold: number // 0.8 = 80%
}

// 功能
class CostTracker {
  recordUsage(projectId: string, usage: TokenUsage): void
  getProjectSpend(projectId: string, period: DateRange): CostSummary
  checkBudget(projectId: string): { underBudget: boolean; percentUsed: number }
  alertBudgetExceeded(projectId: string): void
}
```

### 3.4 ContractGuardian (契约守护)

```typescript
// src/server/ai/guardian.ts
interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

class ContractGuardian {
  // 生成前验证prompt
  validatePrompt(prompt: string, schema: OpenAPISchema): ValidationResult

  // 生成后验证响应
  validateResponse(response: any, schema: OpenAPISchema): ValidationResult

  // 自动修复不合规内容
  autoFix(response: any, schema: OpenAPISchema): any
}

// 内置验证规则
const validationRules = {
  requiredFields: true,
  typeCoercion: false,  // 严格类型
  additionalProperties: false,  // 禁止多余字段
  enumValues: true,  // 验证枚举
  formatValidation: true  // email, uuid, date-time等
}
```

### 3.5 AuditLogger (审计日志)

```typescript
// src/server/ai/audit-logger.ts
interface AuditLog {
  id: string
  timestamp: Date
  projectId: string
  userId: string
  action: 'generate_mock' | 'improve_mock' | 'chat' | 'generate_doc'
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  cost: number
  request: any  // 脱敏后的请求
  response: any // 脱敏后的响应
  validationResult: ValidationResult
  duration: number // ms
}

// 功能
class AuditLogger {
  log(entry: Omit<AuditLog, 'id' | 'timestamp'>): void
  query(filters: AuditFilters): AuditLog[]
  export(format: 'json' | 'csv'): string
  replay(auditId: string): Promise<any>  // 重放历史请求
}
```

### 3.6 RateLimiter (频率限制)

```typescript
// src/server/ai/rate-limiter.ts
interface RateLimitConfig {
  global: { rpm: number; tpm: number }
  perUser: { rpm: number; tpm: number }
  perProject: { rpm: number; tpm: number }
  perProvider: { [provider: string]: { rpm: number; tpm: number } }
}

class RateLimiter {
  async checkLimit(identifier: string, operation: string): Promise<boolean>
  async acquire(identifier: string, operation: string): Promise<void>
  getWaitTime(identifier: string, operation: string): number
}
```

---

## 4. 数据库扩展

```sql
-- Token使用记录
CREATE TABLE ai_usage_logs (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  user_id TEXT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  operation TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost REAL NOT NULL,
  duration_ms INTEGER,
  validation_passed INTEGER,
  created_at TEXT NOT NULL
);

-- 项目预算
CREATE TABLE project_budgets (
  project_id TEXT PRIMARY KEY,
  monthly_limit REAL DEFAULT 0,
  current_spend REAL DEFAULT 0,
  alert_threshold REAL DEFAULT 0.8,
  updated_at TEXT NOT NULL
);

-- AI审计日志
CREATE TABLE ai_audit_logs (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  user_id TEXT,
  action TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost REAL,
  request_preview TEXT,
  response_preview TEXT,
  validation_errors TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL
);
```

---

## 5. API 扩展

| 方法 | 路由 | 描述 |
|------|------|------|
| GET | `/api/ai/costs` | 获取当前成本汇总 |
| GET | `/api/ai/costs/:projectId` | 获取项目成本明细 |
| GET | `/api/ai/usage` | 获取Token使用记录 |
| GET | `/api/ai/audit` | 获取审计日志 |
| GET | `/api/ai/audit/:id` | 获取单条审计详情 |
| POST | `/api/ai/budgets` | 设置项目预算 |
| PUT | `/api/ai/budgets/:projectId` | 更新项目预算 |
| POST | `/api/ai/audit/:id/replay` | 重放历史请求 |
| GET | `/api/ai/providers` | 获取支持的LLM提供商 |

---

## 6. MCP工具扩展

新增AI控制相关工具：

| 工具名 | 描述 |
|--------|------|
| `get_ai_cost_summary` | 获取AI使用成本汇总 |
| `get_ai_audit_trail` | 获取审计日志 |
| `replay_ai_request` | 重放历史AI请求 |
| `set_project_budget` | 设置项目预算 |
| `validate_contract` | 验证内容是否符合契约 |
| `switch_llm_provider` | 切换LLM提供商 |
| `get_cost_breakdown` | 获取成本分解 |

---

## 7. 实施计划

### Phase 1: 基础架构 (2周)
- [ ] 创建 `src/server/ai/` 目录结构
- [ ] 实现 `AIGateway` 核心类
- [ ] 迁移现有 `ClaudeClient` 到 `AIGateway`
- [ ] 基础CostTracker实现
- [ ] 数据库迁移脚本

### Phase 2: 多提供商支持 (1周)
- [ ] 实现 `LLMRouter` 路由逻辑
- [ ] 添加OpenAI provider adapter
- [ ] 添加OpenRouter provider adapter
- [ ] 动态provider配置

### Phase 3: 审计与验证 (2周)
- [ ] 实现 `AuditLogger`
- [ ] 实现 `ContractGuardian`
- [ ] OpenAPI schema验证集成
- [ ] 审计日志API

### Phase 4: 高级控制 (1周)
- [ ] 实现 `RateLimiter`
- [ ] 成本告警机制
- [ ] 预算管理UI
- [ ] 成本仪表板

---

## 8. Error & Rescue Map

| 方法/代码路径 | 可能出错 | 异常类型 | 恢复策略 |
|---------------|----------|----------|----------|
| AIGateway.generateMock() | LLM API超时 | TimeoutError | 重试3次，指数退避 |
| AIGateway.generateMock() | Rate Limit | 429 | 等待后重试，切换provider |
| AIGateway.generateMock() | Provider故障 | 5xx | 自动切换备用provider |
| AIGateway.generateMock() | 无效响应格式 | ParseError | 回退到schema生成 |
| CostTracker.recordUsage() | DB写入失败 | DBError | 降级到内存缓冲 |
| ContractGuardian.validate() | Schema不匹配 | ValidationError | 返回详细错误列表 |
| RateLimiter.checkLimit() | 超过限制 | RateLimitError | 返回等待时间 |
| AuditLogger.log() | 日志写入失败 | IOError | 降级到控制台输出 |

---

## 9. Security & Threat Model

| 威胁 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| API Key泄露 | 中 | 高 | 环境变量存储，不写入DB |
| 成本超支 | 高 | 中 | 多层预算告警，自动熔断 |
| Prompt注入 | 低 | 高 | 输入验证，prompt隔离 |
| 数据外泄 | 低 | 高 | 本地验证，审计日志脱敏 |
| Provider锁定 | 中 | 低 | 抽象接口，支持动态切换 |

---

## 10. 性能考量

| 组件 | 性能影响 | 优化措施 |
|------|----------|----------|
| CostTracker | 低 (同步记录) | 异步写入，批量处理 |
| AuditLogger | 中 (大量日志) | 异步缓冲，批量写入 |
| ContractGuardian | 中 (Schema验证) | 缓存热点schema |
| RateLimiter | 低 (内存检查) | 滑动窗口算法 |

---

## 11. 预期收益

| 维度 | 当前 | 目标 | 提升 |
|------|------|------|------|
| LLM提供商支持 | 1 | 4+ | 400%+ |
| 成本可见性 | 无 | 实时追踪 | ∞ |
| 内容合规性 | 无验证 | 100%验证 | ∞ |
| 审计能力 | 无 | 完整追溯 | ∞ |
| 调用控制 | 无限制 | 多层限制 | ∞ |

---

## 12. 风险与缓解

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| 重构破坏现有功能 | 高 | 渐进式迁移，保持向后兼容 |
| 多提供商复杂性 | 中 | 统一抽象层，adapter模式 |
| 性能下降 | 低 | 异步处理，缓存热点数据 |
| 成本超支 | 中 | 多层预算告警，自动熔断 |

---

## 13. 非本次范围 (Deferred)

- 云端审计日志存储 (S3/GCS)
- AI模型微调集成
- 团队权限管理
- AI生成内容版权追踪
- 多语言prompt优化

---

## 14. 已决策事项

| 决策项 | 选择 | 理由 |
|--------|------|------|
| LLM Client合并 | 方案A - 合并统一 | DRY原则，长期维护成本更低 |
| 错误恢复策略 | 方案A - 分层恢复 | 生产环境需要更智能的错误恢复 |
| 内容审核 | 方案A - 本地验证 | 保证隐私，审计日志脱敏处理 |

---

## 15. 后续步骤

1. 确认方案后开始Phase 1实施
2. 每两周进行一次代码review
3. 每月评估功能完整性

---

*文档版本: 1.0*
*创建日期: 2026-03-25*
*作者: AI Controllability Review*
