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

> 基于 MSW (Mock Service Worker) 的智能自动化 Mock 服务器，配备 Web UI 管理和 AI 生成能力。

## 特性

- **强大的 Mock 能力** - 基于 MSW，支持 REST、GraphQL 和 WebSocket
- **Web UI 管理** - 直观的图形界面管理 Mock 配置
- **AI 生成** - 使用 LLM 自动生成 Mock 数据
- **MCP 工具服务** - 提供 MCP 协议工具，支持 AI 集成
- **多 LLM 支持** - 支持 Anthropic、OpenAI 等
- **导入支持** - 支持从 Postman 和 Swagger 导入 API 定义
- **主题切换** - 支持浅色/深色主题，一键切换
- **国际化** - 支持中英文界面

## 快速开始

### 安装

```bash
npm install msw-auto
# 或
pnpm add msw-auto
```

### 配置 LLM

```bash
# 设置 API Key
npx msw-auto setting --apikey YOUR_API_KEY

# 选择提供商 (anthropic, openai, custom)
npx msw-auto setting --provider anthropic

# 切换模型
npx msw-auto model claude-3-5-sonnet-20241022
```

### 启动服务

```bash
# 启动 Mock 服务器
npx msw-auto server --port 3001

# 启动 Web UI (另一个终端)
npx msw-auto web --port 3000
```

或使用交互式菜单：

```bash
npx msw-auto interactive
```

在浏览器中打开 http://localhost:3000 访问 Web UI。

## 使用命令

| 命令 | 描述 |
|------|------|
| `msw-auto init` | 初始化 MSW |
| `msw-auto server` | 启动 Mock 服务器 |
| `msw-auto web` | 启动 Web UI |
| `msw-auto generate` | AI 生成 Mock |
| `msw-auto import` | 导入 Postman/Swagger |
| `msw-auto config` | 查看 LLM 配置 |
| `msw-auto setting` | 配置 LLM (--provider, --apikey, --baseurl) |
| `msw-auto model` | 切换 LLM 模型 |
| `msw-auto interactive` | 启动交互式菜单 |

## LLM 配置

### 支持的提供商

| 提供商 | 默认模型 | Base URL |
|--------|----------|----------|
| Anthropic | claude-3-5-sonnet-20241022 | https://api.anthropic.com |
| OpenAI | gpt-4o | https://api.openai.com/v1 |
| 自定义 | - | 用户指定 |

### 配置示例

```bash
# Anthropic (Claude)
npx msw-auto setting --provider anthropic --apikey sk-ant-xxx

# OpenAI
npx msw-auto setting --provider openai --apikey sk-xxx

# 自定义 API
npx msw-auto setting --provider custom --baseurl https://api.example.com/v1 --apikey xxx
```

## MCP 服务

MCP Server 提供以下工具，可供 Claude Code 等 AI 工具集成：

| 工具 | 描述 |
|------|------|
| `analyze_project` | 分析项目发现 API 端点 |
| `generate_mock` | 使用 LLM 生成 Mock 数据 |
| `start_mock_server` | 启动 Mock 服务器 |
| `list_projects` | 列出所有项目 |
| `get_llm_config` | 获取 LLM 配置 |
| `reload_llm_config` | 重新加载 LLM 配置 |

### MCP 配置

在 Claude Code 中配置 `mcp.json`：

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

## Web UI 功能

- **仪表盘** - 查看请求统计和最近请求
- **API 浏览器** - 浏览和搜索所有 Mock API
- **Mock 管理** - 创建、编辑、删除和启用/禁用 Mock
- **设置** - 主题、语言和 API 配置

## 架构

```
CLI / Web UI
    │
    ├── setting --provider openai   → 配置 LLM
    ├── model gpt-4o               → 切换模型
    └── interactive                → 交互式菜单
            │
            ▼
    MCP Server (工具服务)
            │
            ├── analyze_project    → 分析代码
            ├── generate_mock     → 生成 Mock ──► LLM API
            └── start_mock_server → 启动服务
                    │
                    ▼
            LLM Service (多提供商)
                    ├── Anthropic (Claude)
                    ├── OpenAI (GPT-4)
                    └── 自定义 API
```

## 文档

详细文档请访问 [文档页面](https://msw-auto.dev/docs)。

## 贡献

欢迎提交 Pull Request！请先阅读 [贡献指南](CONTRIBUTING.md)。

## 许可证

MIT License - 查看 [LICENSE](LICENSE.md) 了解更多。

## 致谢

- [MSW](https://mswjs.io/) - 核心 Mock 库
- [Ant Design](https://ant.design/) - UI 组件库
- [Vite](https://vitejs.dev/) - 构建工具
- [Anthropic](https://www.anthropic.com/) - Claude AI
