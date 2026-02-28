# MSW Auto

<p align="center">
  <img src="media/msw-logo.svg" alt="MSW Auto Logo" width="200" />
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
- **AI 生成** - 使用 AI 自动生成 Mock 数据
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

### 初始化

```bash
npx msw-auto init
```

### 启动 Web UI

```bash
npx msw-auto web
```

在浏览器中打开 http://localhost:3000 访问 Web UI。

### 创建 Mock

通过 Web UI 或代码创建 Mock：

```typescript
import { http, HttpResponse } from 'msw-auto'

export const handlers = [
  http.get('/api/users', () => {
    return HttpResponse.json([
      { id: 1, name: 'John Doe' },
      { id: 2, name: 'Jane Doe' }
    ])
  })
]
```

## 使用命令

| 命令 | 描述 |
|------|------|
| `msw-auto init` | 初始化 MSW |
| `msw-auto server` | 启动 Mock 服务器 |
| `msw-auto web` | 启动 Web UI |
| `msw-auto generate` | AI 生成 Mock |
| `msw-auto import` | 导入 Postman/Swagger |

## Web UI 功能

- **仪表盘** - 查看请求统计和最近请求
- **API 浏览器** - 浏览和搜索所有 Mock API
- **Mock 管理** - 创建、编辑、删除和启用/禁用 Mock
- **设置** - 主题、语言和 API 配置

## 配置

### 主题

Web UI 支持三种主题模式：
- 浅色模式
- 深色模式
- 跟随系统

### 语言

支持中英文界面切换。

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
