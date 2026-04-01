# MSW Auto

<p align="center">
  <a href="README.md">中文</a> |
  <a href="README-en.md">English</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/msw-auto">
    <img src="https://img.shields.io/npm/v/msw-auto.svg" alt="npm version" />
  </a>
  <a href="https://nodejs.org/">
    <img src="https://img.shields.io/node/v/msw-auto.svg" alt="node" />
  </a>
  <a href="https://github.com/msw-auto/msw-auto/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/msw-auto/msw-auto.svg" alt="license" />
  </a>
</p>

> **API 契约驱动的智能 Mock 服务器** - 基于 OpenAPI/Swagger 规范自动生成 100% 符合约的 Mock 数据，配备 TypeScript 类型自动生成。

## 特性

### 核心功能
- **契约驱动** - OpenAPI/Swagger 作为 API 契约的唯一真实来源
- **自动发现** - 从运行中的后端 `/api-docs` 或项目中的静态文件自动发现契约
- **精确 Mock** - 基于 Schema 生成 100% 符合约的 Mock 数据
- **类型生成** - 自动生成 TypeScript 接口定义，支持前端自动补全
- **版本管理** - 契约版本跟踪，变更检测，差异对比

### Mock 能力
- **语义感知** - 根据 field name 智能生成数据 (email, uuid, dates 等)
- **复杂类型** - 支持 allOf/oneOf/anyOf, $ref, 嵌套对象
- **边界测试** - 自动生成空数组、null 值等边界情况
- **多格式** - 支持 OpenAPI 3.x 和 Swagger 2.0

### 用户体验
- **Web UI** - 直观的图形界面管理契约和 Mock
- **实时更新** - WebSocket 推送契约变更
- **国际化** - 中英文界面
- **主题切换** - 深色/浅色主题

### 开发者工具
- **MCP 集成** - Model Context Protocol 服务器，支持 AI 工具调用
- **API 接口** - RESTful API，易于集成

## 目录

- [快速开始](#快速开始)
- [开发环境运行](#开发环境运行)
- [Web UI 使用指南](#web-ui-使用指南)
- [AI 功能配置](#ai-功能配置)
- [MCP 服务](#mcp-服务)
- [API 接口](#api-接口)
- [配置说明](#配置说明)
- [架构说明](#架构说明)

---

## 快速开始

### 安装

```bash
npm install msw-auto
# 或
pnpm add msw-auto
```

### 启动服务

```bash
# 启动后端 Mock 服务器（端口 3001）
npx msw-auto server

# 在新终端启动前端 Web UI（端口 3000）
cd web && pnpm install && pnpm dev
```

然后访问 http://localhost:3000 使用 Web UI。

---

## 开发环境运行

如果你克隆了此仓库，可以这样运行：

```bash
# 1. 安装依赖
pnpm install

# 2. 安装 web 前端依赖
cd web && pnpm install && cd ..

# 3. 启动后端服务器
pnpm dev:server   # 端口 3001

# 4. 在新终端启动前端
cd web && pnpm dev   # 端口 3000
```

### 服务地址

| 服务 | 地址 | 说明 |
|------|------|------|
| Web UI | http://localhost:3000 | React 前端界面 |
| Mock Server | http://localhost:3001 | Express 后端服务 |
| WebSocket | ws://localhost:3001/ws | 实时更新 |

---

## Web UI 使用指南

### 1. 仪表盘 (Dashboard)

访问 http://localhost:3000/dashboard

**功能**：
- 查看 Mock 统计概览（总数、启用数、今日请求数）
- 查看最近请求日志
- 全局开关控制（一键启用/禁用所有 Mock）
- 快速创建新 Mock

**操作**：
- 点击全局开关按钮切换所有 Mock 状态
- 点击"创建 Mock"按钮添加新 Mock
- 请求日志实时更新，显示最近的 API 调用

### 2. API 浏览器 (Explorer)

访问 http://localhost:3000/explorer

**功能**：
- 浏览所有已配置的 Mock API
- 按方法、路径搜索过滤
- 查看每个 Mock 的详细信息
- 从实际请求创建 Mock

**操作**：
- 使用搜索框快速查找 API
- 点击 API 卡片查看详情
- 点击"启用/禁用"切换单个 Mock
- 点击"编辑"修改 Mock 配置

### 3. Mock 编辑器 (Mock Editor)

访问 http://localhost:3000/mocks

**功能**：
- 可视化创建和编辑 Mock
- JSON 编辑器支持
- 请求/响应配置
- 延迟模拟设置

**配置项**：
- **名称**: Mock 显示名称
- **方法**: HTTP 方法（GET/POST/PUT/DELETE 等）
- **路径**: 请求路径，支持参数（如 `/api/users/:id`）
- **状态码**: 响应状态码（默认 200）
- **响应头**: 自定义响应头
- **响应体**: JSON 响应数据
- **延迟**: 模拟网络延迟（毫秒）
- **标签**: 分类标签
- **描述**: 详细说明

### 4. 文档生成 (Documentation)

访问 http://localhost:3000/docs

**功能**：
- AI 自动生成 API 文档
- 一键复制文档内容
- Markdown 格式导出

**操作**：
- 选择 Mock 点击"生成文档"
- AI 自动分析并生成文档
- 点击"复制"按钮复制文档

### 5. 设置 (Settings)

访问 http://localhost:3000/settings

**功能**：
- LLM 配置管理
- 主题切换（深色/浅色）
- 语言切换（中文/英文）
- 服务器连接设置

**LLM 配置**：
- 选择提供商（Anthropic/OpenAI/自定义）
- 输入 API Key
- 配置 Base URL（自定义提供商）
- 选择模型

---

## AI 功能配置

### 支持的提供商

| 提供商 | 默认模型 | Base URL |
|--------|----------|----------|
| Anthropic | claude-3-5-sonnet-20241022 | https://api.anthropic.com |
| OpenAI | gpt-4o | https://api.openai.com/v1 |
| 自定义 | - | 用户指定 |

### 配置步骤

#### 使用 Web UI 配置（推荐）

1. 访问 http://localhost:3000/settings
2. 在 LLM 配置区域：
   - 选择提供商
   - 输入 API Key
   - 配置 Base URL（如需要）
   - 点击"保存配置"

### AI 功能使用

#### 生成 Mock

1. 在 Web UI 中点击"创建 Mock"
2. 输入 API 描述，如："用户列表 API，返回分页用户数据"
3. 点击"AI 生成"按钮
4. AI 自动生成响应数据和配置

#### 改进 Mock

1. 打开现有 Mock 编辑页面
2. 点击"AI 改进"按钮
3. 输入改进要求，如："添加更多字段和更真实的数据"
4. AI 自动优化 Mock 配置

#### 生成文档

1. 在 Mock 列表中选择一个 Mock
2. 点击"生成文档"按钮
3. AI 自动生成 API 文档
4. 复制或导出文档

---

## MCP 服务

MCP (Model Context Protocol) 服务器允许任何支持 MCP 的 LLM 工具直接调用 MSW Auto 的功能。

### MCP 工具列表

#### 文件操作工具

| 工具 | 描述 |
|------|------|
| `read_file` | 读取文件内容 |
| `write_file` | 写入文件内容 |
| `list_directory` | 列出目录内容 |
| `create_directory` | 创建目录 |
| `file_exists` | 检查文件/目录是否存在 |

#### 项目操作工具

| 工具 | 描述 |
|------|------|
| `analyze_project` | 分析项目发现 API 端点 |
| `generate_mock` | 使用 LLM 生成 Mock 数据 |
| `start_mock_server` | 启动 Mock 服务器 |
| `list_projects` | 列出所有项目 |
| `get_llm_config` | 获取 LLM 配置 |
| `reload_llm_config` | 重新加载 LLM 配置 |

### 配置 MCP

在 Claude Desktop 或其他支持 MCP 的应用中配置：

```json
{
  "mcpServers": {
    "msw-auto": {
      "command": "npx",
      "args": ["msw-auto", "mcp"]
    }
  }
}
```

### 使用示例

在 Claude Desktop 中：
```
请分析我的前端项目并生成所有 API 的 Mock
```

Claude 会自动调用 MCP 工具来：
1. 分析项目结构
2. 识别所有 API 调用
3. 生成对应的 Mock 数据
4. 启动 Mock 服务器

---

## API 接口

### 基础 URL

```
http://localhost:3001/api
```

### 全局控制

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/global-toggle` | GET | 获取全局开关状态 |
| `/api/global-toggle` | POST | 设置全局开关 `{enabled: boolean}` |
| `/api/stats` | GET | 获取统计信息 |

### Mock 管理

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/mocks` | GET | 获取所有 Mock |
| `/api/mocks` | POST | 创建 Mock |
| `/api/mocks/:id` | GET | 获取单个 Mock |
| `/api/mocks/:id` | PUT | 更新 Mock |
| `/api/mocks/:id` | DELETE | 删除 Mock |
| `/api/mocks/:id/toggle` | POST | 切换单个 Mock 状态 |
| `/api/mocks/:id/duplicate` | POST | 复制 Mock |

### 版本管理

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/mocks/:id/versions` | GET | 获取版本历史 |
| `/api/mocks/:id/versions` | POST | 创建版本快照 |
| `/api/mocks/:id/versions/:version/rollback` | POST | 回滚到指定版本 |
| `/api/mocks/:id/versions/compare` | GET | 对比两个版本 |

### AI 功能

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/ai/generate` | POST | AI 生成 Mock |
| `/api/ai/improve/:id` | POST | AI 改进 Mock |
| `/api/ai/docs/:id` | POST | AI 生成文档 |
| `/api/ai/chat` | POST | AI 对话 |
| `/api/ai/status` | GET | AI 服务状态 |

### 导入导出

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/import/openapi` | POST | 导入 OpenAPI |
| `/api/import/postman` | POST | 导入 Postman |
| `/api/export/openapi` | GET | 导出 OpenAPI |
| `/api/export/postman` | GET | 导出 Postman |
| `/api/export/json` | GET | 导出 JSON |

### 请求监控

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/requests` | GET | 获取请求日志 |

---

## 配置说明

### 环境变量

创建 `.env` 文件或设置环境变量：

```bash
# 服务器配置
PORT=3001                    # Mock 服务器端口
WEB_PORT=3000                # Web UI 端口

# LLM 配置
ANTHROPIC_API_KEY=sk-ant-xxx # Claude API 密钥
OPENAI_API_KEY=sk-xxx        # OpenAI API 密钥

# 数据库配置
DB_PATH=./data/mocks.db      # SQLite 数据库路径

# 代理配置
BACKEND_URL=https://api.example.com  # 后端 API 地址（用于代理）
```

### 配置文件

配置保存在 `data/config.json`：

```json
{
  "port": 3001,
  "webPort": 3000,
  "provider": "anthropic",
  "apiKey": "sk-ant-xxx",
  "baseUrl": "https://api.anthropic.com",
  "model": "claude-3-5-sonnet-20241022",
  "dbPath": "./data/mocks.db"
}
```

### 数据库

使用 SQLite 存储 Mock 数据，文件位置：`data/mocks.db`

**数据表**：
- `mocks` - Mock 配置
- `request_logs` - 请求日志
- `mock_versions` - 版本历史

---

## 架构说明

### 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MSW Auto                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │   MCP Server │    │   Web UI     │    │   REST API   │                  │
│  │  (src/mcp/)  │    │  (web/src/)  │    │  /api/*      │                  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                  │
│         │                   │                    │                            │
│         └───────────────────┼────────────────────┘                        │
│                             ▼                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Express Server                                │   │
│  │                      (src/server/index.ts)                           │   │
│  │                                                                     │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐          │   │
│  │  │ Mock Manager  │  │Contract Mgr   │  │ Claude Client │          │   │
│  │  │ (mock/manager)│  │(contract/     │  │  (llm/claude) │          │   │
│  │  │               │  │   manager)    │  │               │          │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘          │   │
│  │                                                                     │   │
│  │  ┌─────────────────────────────────────────────────────────────┐  │   │
│  │  │                    Database (SQLite)                        │  │   │
│  │  │                   (storage/database)                        │  │   │
│  │  └─────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 目录结构

```
src/
├── server/                    # Express 服务器
│   ├── index.ts              # MockServer 主类
│   ├── routes/               # API 路由定义
│   │   ├── index.ts          # 路由聚合
│   │   └── contracts.ts      # 契约相关路由
│   ├── mock/                 # Mock 管理
│   │   └── manager.ts        # MockManager 类
│   ├── contract/             # 契约管理
│   │   └── manager.ts        # ContractManager 类
│   ├── storage/              # 数据存储
│   │   └── database.ts       # Database 类（SQLite + 内存）
│   ├── websocket/            # 实时通信
│   │   └── index.ts          # WebSocket 设置
│   └── llm/                  # AI 集成
│       └── claude-client.ts  # Claude API 客户端
│
├── contract/                 # 契约处理核心
│   ├── discovery.ts          # OpenAPI 自动发现
│   ├── mock-generator.ts     # Schema 驱动的 Mock 生成
│   ├── type-generator.ts     # TypeScript 类型生成
│   └── index.ts              # 模块导出
│
├── mcp/                      # MCP 服务器
│   ├── server.ts             # MCP 主服务器
│   ├── analyzer.ts            # 项目分析器
│   ├── llm-service.ts         # LLM 服务
│   ├── ast/                   # AST 分析引擎
│   └── openapi/               # OpenAPI 解析器
│
├── types/                    # 类型定义
│   ├── config.ts
│   ├── contract.ts
│   └── index.ts
│
web/src/                      # React 前端
│   ├── pages/
│   │   ├── Dashboard/         # 仪表盘
│   │   ├── APIExplorer/      # API 浏览器
│   │   ├── MockEditor/        # Mock 编辑器
│   │   ├── Documentation/     # 文档生成
│   │   └── Settings/          # 设置
│   ├── components/            # 通用组件
│   ├── stores/                # 状态管理
│   ├── api/                   # API 客户端
│   └── i18n/                  # 国际化
```

### 技术栈

- **后端**: Node.js + Express + TypeScript
- **前端**: React + TypeScript + Ant Design + Vite
- **数据库**: SQLite (better-sqlite3)
- **实时通信**: WebSocket (ws)
- **AI 集成**: Anthropic Claude SDK
- **构建**: tsup + esbuild

---

## 常见问题

### Q: 如何重置配置？

在 Web UI 设置页面重新配置 LLM，或删除 `data/config.json` 后重启服务器。

### Q: 数据存储在哪里？

所有数据存储在 `data/` 目录：
- `mocks.db` - SQLite 数据库
- `config.json` - 配置文件

### Q: 如何备份 Mock 数据？

```bash
# 方法1：导出 JSON
curl http://localhost:3001/api/export/json > mocks-backup.json

# 方法2：复制数据库
cp data/mocks.db data/mocks-backup.db
```

### Q: 端口被占用怎么办？

设置环境变量使用不同端口：

```bash
PORT=8080 WEB_PORT=8081 npx msw-auto server
```

---

## 贡献

欢迎提交 Pull Request！请先阅读 [贡献指南](CONTRIBUTING.md)。

## 许可证

MIT License - 查看 [LICENSE](LICENSE.md) 了解更多。

## 致谢

- [MSW](https://mswjs.io/) - 核心 Mock 库
- [Ant Design](https://ant.design/) - UI 组件库
- [Vite](https://vitejs.dev/) - 构建工具
- [Anthropic](https://www.anthropic.com/) - Claude AI
