# Vite/Webpack 代理冲突处理方案

## 一、问题分析

### 1.1 代理冲突场景

```
┌─────────────────────────────────────────────────────────┐
│                    前端应用                          │
│  ┌──────────────────────────────────────────────┐  │
│  │  Vite/Webpack 开发服务器                 │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │  Proxy 配置                      │  │  │
│  │  │  /api -> http://localhost:3000   │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  └────────────────┬───────────────────────┘  │
└───────────────────┼───────────────────────────┘
                    │
                    ↓
          ┌─────────┴─────────┐
          │   API 请求         │
          └─────────┬─────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
        ↓           ↓           ↓
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Vite Proxy │ │ Mock Server  │ │ Real Backend │
│  (配置的）   │ │ (4000 端口）  │ │ (3000 端口）  │
└──────────────┘ └──────────────┘ └──────────────┘

冲突点：
- Vite Proxy 可能拦截请求
- Mock Server 也想拦截请求
- 可能产生代理链
- 配置复杂
```

### 1.2 常见问题

| 问题             | 原因                    | 影响                 |
| ---------------- | ----------------------- | -------------------- |
| 请求被 Vite 拦截 | Vite Proxy 优先级高     | Mock Server 无法工作 |
| 代理链问题       | Vite -> Mock -> Backend | 请求失败或混乱       |
| CORS 问题        | 多层代理导致 CORS       | 跨域请求失败         |
| 调试困难         | 多层代理难以追踪        | 难以定位问题         |

---

## 二、解决方案

### 2.1 方案一：修改前端 API Base URL（推荐）

#### 2.1.1 原理

直接修改前端的 API Base URL，使其指向 Mock Server，绕过 Vite/Webpack Proxy。

```
前端应用
    │
    │ API Base URL: http://localhost:4000
    │
    ↓
┌──────────────────┐
│  Mock Server     │  ← 直接连接
│  (4000 端口）      │
└──────────────────┘
```

#### 2.1.2 实现方式

**Vite 项目：**

```typescript
// vite.config.ts - 环境变量配置
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    server: {
      port: 3000,
      // 可以保留 proxy 配置（用于其他目的）
      proxy: {
        // 但不会被使用，因为 API Base URL 改了
      },
    },
    define: {
      // 使用环境变量控制
      __API_BASE_URL__: JSON.stringify(
        env.VITE_API_URL || 'https://api.example.com',
      ),
    },
  }
})
```

```typescript
// src/config/api.ts
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.example.com'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})

// 使用
export const fetchUsers = async () => {
  const response = await apiClient.get('/api/users')
  return response.data
}
```

```bash
# .env.development
VITE_API_URL=http://localhost:4000

# .env.production
VITE_API_URL=https://api.example.com
```

**Webpack 项目：**

```javascript
// webpack.config.js
const { definePlugin } = require('@webpack-js/core')
const webpack = require('webpack')

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production'
  const apiUrl = isProduction
    ? 'https://api.example.com'
    : 'http://localhost:4000'

  return {
    plugins: [
      new webpack.DefinePlugin({
        'process.env.API_URL': JSON.stringify(apiUrl),
      }),
    ],
    devServer: {
      port: 3000,
      proxy: {
        // 保留 proxy 配置但不使用
      },
    },
  }
}
```

```javascript
// src/config/api.js
const API_URL = process.env.API_URL || 'https://api.example.com'

export const apiClient = axios.create({
  baseURL: API_URL,
})
```

#### 2.1.3 优缺点

**优点：**

- ✅ 简单直接，无需复杂配置
- ✅ 完全控制 API 路由
- ✅ 避免 Vite/Webpack 代理冲突
- ✅ 易于理解和调试

**缺点：**

- ❌ 需要修改前端代码（环境变量）
- ❌ 需要重启开发服务器

---

### 2.2 方案二：禁用 Vite/Webpack Proxy

#### 2.2.1 原理

在开发环境中禁用 Vite/Webpack 的 Proxy 配置，让 Mock Server 直接接管所有请求。

```typescript
// vite.config.ts
export default defineConfig(({ mode }) => {
  return {
    server: {
      port: 3000,
      // 完全禁用 proxy
      proxy: undefined,
    },
  }
})
```

#### 2.2.2 优缺点

**优点：**

- ✅ 无需修改 API Base URL
- ✅ 避免代理冲突

**缺点：**

- ❌ 如果有其他代理需求会被影响
- ❌ 需要手动管理 proxy 配置

---

### 2.3 方案三：Mock Server 作为反向代理

#### 2.3.1 原理

Mock Server 不仅提供 Mock 数据，还作为反向代理，将未 Mock 的请求转发到真实后端。

```
前端应用 (3000 端口)
    │ API Base URL: http://localhost:3000/api
    │ (保留 Vite Proxy)
    ↓
┌──────────────────┐
│  Vite Proxy      │  ← /api -> http://localhost:4000
└──────────────────┘
    │
    ↓
┌──────────────────┐
│  Mock Server     │  ← 智能决策：Mock 或转发
│  (4000 端口）      │
└────────┬─────────┘
         │
         ↓
┌──────────────────┐
│  Real Backend    │  ← 如果没有匹配的 Mock
│  (3000 端口）      │
└──────────────────┘
```

#### 2.3.2 实现方式

**Vite 配置：**

```typescript
// vite.config.ts
export default defineConfig(() => {
  return {
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
          secure: false,
          configure: (proxy, options) => {
            // 可以添加额外的代理配置
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log(`[Vite Proxy] ${req.method} ${req.url}`)
            })
          },
        },
      },
    },
  }
})
```

**前端 API 配置：**

```typescript
// src/config/api.ts
// 不需要修改，仍然使用相对路径
const API_BASE_URL = '/api'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
})
```

**Mock Server 代理配置：**

```typescript
// src/server/proxy-handler.ts
import httpProxy from 'http-proxy'
import { Request, Response } from 'express'

export class ProxyHandler {
  private proxy: any
  private backendUrl: string

  constructor(backendUrl: string) {
    this.backendUrl = backendUrl

    this.proxy = httpProxy.createProxyServer({
      target: this.backendUrl,
      changeOrigin: true,
      secure: false,
    })

    this.setupProxyEvents()
  }

  private setupProxyEvents(): void {
    this.proxy.on('proxyReq', (proxyReq, req, res) => {
      console.log(
        `[Proxy] ${req.method} ${req.url} -> ${this.backendUrl}${req.url}`,
      )
    })

    this.proxy.on('proxyRes', (proxyRes, req, res) => {
      console.log(
        `[Proxy Response] ${req.method} ${req.url} - ${proxyRes.statusCode}`,
      )
    })

    this.proxy.on('error', (err, req, res) => {
      console.error(`[Proxy Error] ${req.method} ${req.url}:`, err)
      res.status(500).json({ error: 'Proxy error' })
    })
  }

  async handleRequest(req: Request, res: Response): Promise<void> {
    // 1. 检查是否有匹配的 Mock
    const mock = await this.mockManager.findMatchingMock(req)

    if (mock) {
      console.log(`[Mock] Using mock for ${req.method} ${req.url}`)
      const mockResponse = await this.mockManager.executeMock(mock, req)
      return res.status(mockResponse.status || 200).json(mockResponse.data)
    }

    // 2. 没有匹配的 Mock，代理到真实后端
    console.log(`[Proxy] Forwarding to backend: ${req.method} ${req.url}`)
    this.proxy.web(req, res)
  }
}
```

#### 2.3.3 优缺点

**优点：**

- ✅ 前端代码无需修改
- ✅ 保留 Vite/Webpack Proxy
- ✅ Mock Server 智能决策
- ✅ 透明转发到后端

**缺点：**

- ❌ 需要配置两层代理
- ❌ 可能产生代理链
- ❌ 调试稍复杂

---

### 2.4 方案四：环境变量动态切换（推荐）

#### 2.4.1 原理

使用环境变量动态控制是否启用 Mock Server 或使用真实后端，同时处理代理配置。

```typescript
// vite.config.ts
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const useMock = env.VITE_USE_MOCK === 'true'

  return {
    server: {
      port: 3000,
      proxy: useMock
        ? {
            // Mock Server 模式：代理到 Mock Server
            '/api': {
              target: 'http://localhost:4000',
              changeOrigin: true,
              secure: false,
            },
          }
        : {
            // 真实后端模式：代理到真实后端
            '/api': {
              target: env.VITE_BACKEND_URL || 'http://localhost:3001',
              changeOrigin: true,
              secure: false,
            },
          },
    },
    define: {
      __USE_MOCK__: useMock,
      __API_BASE_URL__: JSON.stringify(
        useMock ? 'http://localhost:4000' : '/api',
      ),
    },
  }
})
```

```typescript
// src/config/api.ts
const USE_MOCK = import.meta.env.__USE_MOCK__ || false
const API_BASE_URL = import.meta.env.__API_BASE_URL__ || '/api'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})

export const isUsingMock = () => USE_MOCK
```

```bash
# .env.development.mock
VITE_USE_MOCK=true
VITE_API_URL=http://localhost:4000

# .env.development.real
VITE_USE_MOCK=false
VITE_BACKEND_URL=http://localhost:3001

# .env.production
VITE_USE_MOCK=false
VITE_BACKEND_URL=https://api.example.com
```

```bash
# package.json
{
  "scripts": {
    "dev": "vite",
    "dev:mock": "vite --mode development --env .env.development.mock",
    "dev:real": "vite --mode development --env .env.development.real",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

#### 2.4.2 使用方式

```bash
# 使用 Mock
npm run dev:mock

# 使用真实后端
npm run dev:real
```

#### 2.4.3 优缺点

**优点：**

- ✅ 灵活切换
- ✅ 配置清晰
- ✅ 支持多种环境
- ✅ 无需修改代码

**缺点：**

- ❌ 需要配置多个环境文件

---

## 三、推荐方案组合

### 3.1 开发环境

**方案：环境变量动态切换**

```bash
# 1. 启动 Mock Server
smart-mock

# 2. 启动前端（使用 Mock）
npm run dev:mock
```

**配置：**

```typescript
// vite.config.ts
export default defineConfig(({ mode }) => {
  return {
    server: {
      proxy: {
        '/api': 'http://localhost:4000',
      },
    },
  }
})
```

```typescript
// src/config/api.ts
const API_BASE_URL = '/api' // 使用相对路径，通过 Vite Proxy
```

### 3.2 生产环境

**方案：直接连接真实后端**

```typescript
// vite.config.ts
export default defineConfig(({ mode }) => {
  return {
    // 生产环境不需要 proxy
    build: {
      // 构建优化
    },
  }
})
```

```typescript
// src/config/api.ts
const API_BASE_URL = 'https://api.example.com' // 直接使用真实后端 URL
```

---

## 四、冲突检测和处理

### 4.1 配置检测

```typescript
// src/utils/proxy-conflict-detector.ts
export class ProxyConflictDetector {
  detect(
    viteConfig: any,
    mockServerConfig: any,
  ): {
    hasConflict: boolean
    warnings: string[]
    suggestions: string[]
  } {
    const warnings: string[] = []
    const suggestions: string[] = []

    // 检查 1: API Base URL 和 Proxy 都指向 Mock Server
    const hasApiBaseToMock =
      viteConfig.define?.__API_BASE_URL__?.includes('4000')
    const hasProxyToMock =
      viteConfig.server?.proxy?.['/api']?.target?.includes('4000')

    if (hasApiBaseToMock && hasProxyToMock) {
      warnings.push(
        'Both API Base URL and Proxy point to Mock Server. Consider removing one.',
      )
      suggestions.push(
        'Option 1: Remove Proxy configuration and use API Base URL only',
      )
      suggestions.push('Option 2: Remove API Base URL and use Proxy only')
    }

    // 检查 2: Proxy 配置可能拦截所有请求
    if (viteConfig.server?.proxy?.['/']) {
      warnings.push(
        'Catch-all proxy configuration found. This may interfere with Mock Server.',
      )
      suggestions.push(
        'Consider using specific path proxies like `/api` instead of `/`',
      )
    }

    // 检查 3: Mock Server 也配置了代理
    if (mockServerConfig.proxy?.enabled && viteConfig.server?.proxy) {
      warnings.push(
        'Both Vite and Mock Server have proxy configurations. This may cause a proxy chain.',
      )
      suggestions.push('Recommended: Disable one of the proxy configurations')
    }

    // 检查 4: 端口冲突
    if (viteConfig.server?.port === mockServerConfig.port) {
      warnings.push(
        'Vite and Mock Server are using the same port. This will cause a conflict.',
      )
      suggestions.push(
        `Change Mock Server port to ${viteConfig.server.port + 1}`,
      )
    }

    return {
      hasConflict: warnings.length > 0,
      warnings,
      suggestions,
    }
  }
}
```

### 4.2 自动修复建议

```typescript
// src/utils/proxy-conflict-fixer.ts
export class ProxyConflictFixer {
  generateFixConfig(conflicts: string[]): {
    viteConfig: any
    envFile: string
  } {
    const fixes: any[] = []

    // 修复 1：移除重复的代理配置
    if (conflicts.some((c) => c.includes('Both API Base URL and Proxy'))) {
      fixes.push({
        type: 'remove-proxy',
        description: 'Remove Vite Proxy configuration',
        config: {
          server: {
            proxy: undefined,
          },
        },
      })
    }

    // 修复 2：更改 Mock Server 端口
    if (conflicts.some((c) => c.includes('using the same port'))) {
      fixes.push({
        type: 'change-mock-port',
        description: 'Change Mock Server port to avoid conflict',
        config: {
          port: 4001,
        },
      })
    }

    return this.selectBestFix(fixes)
  }

  private selectBestFix(fixes: any[]): any {
    // 选择最安全的修复方案
    return fixes[0] || {}
  }
}
```

---

## 五、最佳实践

### 5.1 推荐配置

```typescript
// vite.config.ts - 开发环境推荐配置
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const useMock = env.VITE_USE_MOCK === 'true'

  return {
    server: {
      port: 3000,
      strictPort: false, // 如果端口被占用，自动尝试下一个
      // Mock 模式：使用代理到 Mock Server
      // 真实模式：代理到真实后端
      ...(useMock
        ? {
            proxy: {
              '/api': {
                target: 'http://localhost:4000',
                changeOrigin: true,
                secure: false,
                ws: true, // 支持 WebSocket
              },
              '/ws': {
                target: 'ws://localhost:4000',
                ws: true,
              },
            },
          }
        : {
            proxy: {
              '/api': {
                target: env.VITE_BACKEND_URL || 'http://localhost:3001',
                changeOrigin: true,
                secure: false,
              },
            },
          }),
    },
    // 环境变量
    define: {
      __USE_MOCK__: useMock,
      __API_VERSION__: JSON.stringify(env.VITE_API_VERSION || 'v1'),
    },
  }
})
```

### 5.2 环境变量配置

```bash
# .env.development.mock
# 使用 Mock Server
VITE_USE_MOCK=true
VITE_API_VERSION=v1
# Mock Server 配置
VITE_MOCK_SERVER_URL=http://localhost:4000

# .env.development.real
# 使用真实后端
VITE_USE_MOCK=false
VITE_API_VERSION=v1
VITE_BACKEND_URL=http://localhost:3001

# .env.production
# 生产环境
VITE_USE_MOCK=false
VITE_API_VERSION=v1
VITE_BACKEND_URL=https://api.example.com
```

### 5.3 启动脚本

```json
{
  "scripts": {
    "dev": "vite",
    "dev:mock": "vite --mode development --env .env.development.mock",
    "dev:real": "vite --mode development --env .env.development.real",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "mock-server": "smart-mock"
  }
}
```

---

## 六、调试技巧

### 6.1 检查代理链

```typescript
// 添加调试日志
// vite.config.ts
export default defineConfig(() => {
  return {
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log(`[Vite Proxy] ${req.method} ${req.url}`)
              console.log('Target:', options.target)
            })
            proxy.on('proxyRes', (proxyRes, req, res) => {
              console.log(`[Vite Proxy Response] ${proxyRes.statusCode}`)
            })
            proxy.on('error', (err, req, res) => {
              console.error('[Vite Proxy Error]', err)
            })
          },
        },
      },
    },
  }
})
```

### 6.2 测试代理

```typescript
// 添加测试接口
// src/api/test.ts
export const testProxyConnection = async () => {
  try {
    const response = await fetch('/api/health')
    const data = await response.json()
    return {
      success: true,
      source: data.source || 'unknown',
      data,
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
    }
  }
}

// 在浏览器控制台测试
console.log(await testProxyConnection())
```

---

## 七、总结

### 7.1 方案对比

| 方案                     | 优点     | 缺点         | 推荐度     |
| ------------------------ | -------- | ------------ | ---------- |
| 修改 API Base URL        | 简单直接 | 需要修改配置 | ⭐⭐⭐⭐⭐ |
| 禁用 Proxy               | 无冲突   | 影响其他代理 | ⭐⭐⭐     |
| Mock Server 作为反向代理 | 灵活     | 配置复杂     | ⭐⭐⭐⭐   |
| 环境变量动态切换         | 灵活     | 需要多配置   | ⭐⭐⭐⭐⭐ |

### 7.2 推荐实践

1. **开发环境（使用 Mock）**：
   - 使用环境变量动态切换
   - Vite Proxy 指向 Mock Server
   - 相对路径的 API Base URL

2. **开发环境（使用真实后端）**：
   - 切换环境变量
   - Vite Proxy 指向真实后端
   - 相对路径的 API Base URL

3. **生产环境**：
   - 直接使用真实后端 URL
   - 禁用所有代理
   - 使用 CDN 或反向代理

### 7.3 核心要点

✅ **避免代理链**：不要让 Vite -> Mock -> Backend 形成链
✅ **端口隔离**：确保 Mock Server 和前端使用不同端口
✅ **环境隔离**：使用环境变量区分不同模式
✅ **冲突检测**：启动时检测并提示潜在冲突
✅ **调试日志**：添加代理日志便于追踪请求
✅ **测试验证**：确保代理配置正确工作

通过以上方案，可以完美解决 Vite/Webpack 代理与 Mock Server 的冲突问题！
