# MSW Auto 项目功能对标分析

## 项目概述

**MSW Auto** 是一个 API 契约驱动的 Mock 服务器，以 OpenAPI/Swagger 规范作为唯一真实数据源。

## 核心功能模块

### 1. 契约管理层 (src/contract/)

| 功能 | 文件 | 描述 |
|------|------|------|
| 契约发现 | `discovery.ts` | 从后端或静态文件自动发现 OpenAPI 规范 |
| Mock 生成 | `mock-generator.ts` | 基于 Schema 生成 100% 符合规范的 Mock 数据 |
| 类型生成 | `type-generator.ts` | 从契约自动生成 TypeScript 接口定义 |
| 契约存储 | `manager.ts` | 契约的 CRUD 操作和版本管理 |

**技术亮点:**
- 支持 OpenAPI 3.x 和 Swagger 2.0
- 处理 allOf/oneOf/anyOf/$ref 等复杂类型
- 语义感知的 Mock 生成 (email, UUID, dates)

### 2. 服务器层 (src/server/)

| 模块 | 文件 | 描述 |
|------|------|------|
| 核心服务 | `index.ts` | Express 服务器主类 |
| Mock 管理 | `mock/manager.ts` | Mock 的创建、更新、删除、启用/禁用 |
| 契约管理 | `contract/manager.ts` | 契约的同步、版本跟踪、差异对比 |
| 数据存储 | `storage/database.ts` | SQLite + 内存双层存储 |
| 实时通信 | `websocket/index.ts` | WebSocket 推送更新 |
| AI 集成 | `llm/claude-client.ts` | Claude API 客户端 |

**技术亮点:**
- SQLite WAL 模式支持并发访问
- WebSocket 实时推送契约变更
- LLM 驱动的智能 Mock 生成

### 3. MCP 服务器 (src/mcp/)

| 工具 | 描述 |
|------|------|
| `analyze_project` | 分析前端项目发现 API 端点 |
| `generate_mock` | 使用 LLM 生成 Mock 数据 |
| `start_mock_server` | 启动 Mock 服务器 |
| `read_file` | 读取文件内容 |
| `write_file` | 写入文件内容 |
| `list_directory` | 列出目录内容 |
| `file_exists` | 检查文件是否存在 |

**技术亮点:**
- 基于 Model Context Protocol
- Zod schema 输入验证
- 支持流式 HTTP 和 stdio 传输

### 4. Web 前端 (web/src/)

| 页面 | 路由 | 描述 |
|------|------|------|
| Dashboard | `/dashboard` | 统计概览、请求日志、全局开关 |
| Explorer | `/explorer` | API 浏览、搜索过滤 |
| Mock Editor | `/mocks` | Mock CRUD、可视化编辑 |
| Documentation | `/docs` | AI 生成的 API 文档 |
| Settings | `/settings` | LLM 配置、主题、语言 |

**技术栈:**
- React 18 + TypeScript
- Vite 构建工具
- Ant Design UI 组件
- Zustand 状态管理
- React Router 路由

### 5. CLI 工具 (cli/)

| 命令 | 描述 |
|------|------|
| `msw-auto init` | 初始化 MSW 配置 |
| `msw-auto server` | 启动 Mock 服务器 |
| `msw-auto web` | 启动 Web UI |
| `msw-auto generate` | AI 生成 Mock |
| `msw-auto import` | 导入 API 定义 |
| `msw-auto mcp` | 启动 MCP 服务器 |
| `msw-auto config` | 查看配置 |
| `msw-auto setting` | 配置 LLM |

### 6. 配置层 (config/)

| 文件 | 描述 |
|------|------|
| `constants.js` | 共享常量 |
| `copyServiceWorker.ts` | Service Worker 复制 |
| `replaceCoreImports.js` | 核心模块导入替换 |
| `scripts/patch-ts.js` | TypeScript 补丁 |
| `scripts/postinstall.js` | 安装后脚本 |

## 功能对标表

| 大厂标准功能 | MSW Auto 实现 | 状态 |
|------------|--------------|------|
| API 契约管理 | OpenAPI/Swagger 支持 | ✅ |
| Mock 数据生成 | Schema 驱动的精确生成 | ✅ |
| 类型自动生成 | TypeScript 接口生成 | ✅ |
| 契约版本管理 | Hash-based 版本跟踪 | ✅ |
| 实时数据推送 | WebSocket 集成 | ✅ |
| AI 智能功能 | Claude SDK 集成 | ✅ |
| MCP 协议支持 | 完整的 MCP 服务器 | ✅ |
| 前端可视化 | React Web UI | ✅ |
| CLI 工具 | 完整的命令行界面 | ✅ |
| 数据库持久化 | SQLite 存储 | ✅ |

## 技术栈总结

| 层级 | 技术 | 用途 |
|------|------|------|
| 后端 runtime | Node.js | 服务器运行环境 |
| 后端框架 | Express | HTTP 服务器 |
| 数据库 | SQLite | 持久化存储 |
| 前端框架 | React 18 | Web UI |
| 构建工具 | Vite | 前端构建 |
| UI 库 | Ant Design | 界面组件 |
| 状态管理 | Zustand | 前端状态 |
| AI 集成 | Anthropic SDK | Claude API |
| 协议 | MCP | AI 工具协议 |
| 类型 | TypeScript | 类型安全 |

## 目录结构总结

```
msw-auto/
├── src/              # 核心业务逻辑
│   ├── server/       # Express 服务器 (后端核心)
│   ├── contract/     # 契约处理 (核心功能)
│   ├── mcp/          # MCP 服务器 (AI 集成)
│   └── types/        # 类型定义
├── web/              # React 前端
│   └── src/          # 前端源码
│       ├── pages/    # 页面组件
│       ├── stores/   # 状态管理
│       └── api/      # API 客户端
├── cli/              # 命令行工具
├── config/           # 配置文件
└── data/             # 数据存储
```

## AI 可控性分析

### 当前 AI 集成点

1. **LLM 客户端** (`src/server/llm/`) - Claude API 调用
2. **MCP 服务** (`src/mcp/`) - AI 工具接口
3. **智能生成** - 基于 LLM 的 Mock 生成

### 可控性改进建议

详见 `/plan-ceo-review` 的详细分析。
