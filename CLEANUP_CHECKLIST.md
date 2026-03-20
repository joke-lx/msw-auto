# MSW Auto - 代码清理清单

> **版本**: 3.0.0 迁移
> **日期**: 2026-03-20
> **目的**: 删除冗余代码，精简项目

---

## 📋 清理概览

| 目录/文件 | 大小 | 操作 | 原因 |
|----------|------|------|------|
| `src/core/` | 520K | ❌ 删除 | MSW 库复制，应使用 npm 包 |
| `src/browser/` | 132K | ❌ 删除 | MSW 浏览器代码复制 |
| `src/node/` | 22K | ❌ 删除 | MSW Node 代码复制 |
| `src/native/` | 4K | ❌ 删除 | 空目录 |
| `src/iife/` | 1K | ❌ 删除 | 空目录 |
| `src/shims/` | 2K | ❌ 删除 | 空目录 |
| `web/node_modules/` | 200M+ | ⚠️ 忽略 | 不应在仓库中 |

**预计清理**: ~650K 源码 + 200M+ node_modules

---

## 🗑️ 详细删除清单

### 1. 删除 MSW Core 复制

**目录**: `src/core/`

**原因**: 这是 MSW (mswjs.io) 库的完整复制。应该使用官方 npm 包。

**删除命令**:
```bash
rm -rf src/core/
```

**替代方案**:
```json
// package.json
{
  "dependencies": {
    "msw": "^2.0.0"  // 使用官方包
  }
}
```

**代码迁移**:
```typescript
// 旧代码
import { http } from '../core/http'

// 新代码
import { http } from 'msw'
```

---

### 2. 删除 Browser 复制

**目录**: `src/browser/`

**原因**: MSW 浏览器端代码复制，应使用官方包。

**删除命令**:
```bash
rm -rf src/browser/
```

**替代方案**:
```typescript
// 旧代码
import { setupWorker } from '../browser'

// 新代码
import { setupWorker } from 'msw/browser'
```

---

### 3. 删除 Node 复制

**目录**: `src/node/`

**原因**: MSW Node 端代码复制，应使用官方包。

**删除命令**:
```bash
rm -rf src/node/
```

**替代方案**:
```typescript
// 旧代码
import { setupServer } from '../node'

// 新代码
import { setupServer } from 'msw/node'
```

---

### 4. 删除空目录

**目录**: `src/native/`, `src/iife/`, `src/shims/`

**原因**: 这些目录几乎为空，没有实际用途。

**删除命令**:
```bash
rm -rf src/native/
rm -rf src/iife/
rm -rf src/shims/
```

---

### 5. 配置 .gitignore

**文件**: `.gitignore`

**添加**:
```gitignore
# Dependencies
node_modules/
web/node_modules/
**/node_modules/

# Build outputs
dist/
build/
*.tsbuildinfo

# Data
data/*.db
data/*.db-journal

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Testing
coverage/
.nyc_output/
```

---

## 📝 package.json 更新

### 新的依赖结构

```json
{
  "name": "msw-auto",
  "version": "3.0.0",
  "description": "API Contract-Driven Development Platform",
  "type": "module",
  "bin": {
    "msw-auto": "dist/cli/index.js"
  },
  "files": [
    "dist"
  ],
  "engines": {
    "node": ">=18"
  },
  "scripts": {
    "dev": "tsx watch src/server/index.ts",
    "build": "tsup",
    "test": "vitest",
    "cli": "node cli/index.js",
    "mcp": "tsx src/mcp/server.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.37.0",
    "@inquirer/confirm": "^5.0.0",
    "@inquirer/input": "^5.0.0",
    "@inquirer/select": "^5.0.0",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@babel/parser": "^7.26.0",
    "@babel/traverse": "^7.26.0",
    "better-sqlite3": "11.8.1",
    "chalk": "^5.3.0",
    "cors": "^2.8.5",
    "express": "4.21.0",
    "ora": "^6.3.1",
    "picocolors": "^1.1.1",
    "ws": "^8.18.0",
    "yargs": "^17.7.2",
    "msw": "^2.0.0"
  },
  "devDependencies": {
    "@types/babel__traverse": "^7.20.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/cors": "^2.8.0",
    "@types/express": "^5.0.0",
    "@types/node": "~20.19.0",
    "@types/ws": "^8.18.0",
    "@types/yargs": "^17.0.0",
    "esbuild": "^0.27.0",
    "rimraf": "^6.1.0",
    "tsup": "^8.5.0",
    "tsx": "^4.20.0",
    "typescript": "^5.9.0",
    "vitest": "^4.0.0"
  }
}
```

---

## 🔄 代码迁移示例

### CLI 代码迁移

**旧代码** (`cli/commands/generate.js`):
```javascript
import { generateMockData } from '../src/mcp/mock-generator.js'
```

**新代码**:
```javascript
import { SchemaBasedMockGenerator } from '../src/contract/mock-generator.js'
import { OpenAPIDiscovery } from '../src/contract/discovery.js'

// 使用新的契约系统
const discovery = new OpenAPIDiscovery()
const contracts = await discovery.discover(process.cwd())
const generator = new SchemaBasedMockGenerator()
const mocks = generator.generateFromContract(contracts[0])
```

### Server 代码迁移

**旧代码** (`src/server/routes/index.ts`):
```typescript
import { MockManager } from '../mock/manager.js'
```

**新代码**:
```typescript
import { ContractManager } from '../contract/manager.js'
import { SchemaBasedMockGenerator } from '../contract/mock-generator.js'
```

---

## ✅ 验证清单

删除后，确保以下功能正常：

- [ ] CLI 启动正常
- [ ] MCP 服务运行正常
- [ ] Web UI 可以访问
- [ ] OpenAPI 解析功能正常
- [ ] AST 分析功能正常
- [ ] Mock 生成功能正常
- [ ] 所有测试通过

---

## 🚀 执行步骤

```bash
# 1. 备份当前代码
git add -A
git commit -m "backup: before cleanup"

# 2. 创建清理分支
git checkout -b cleanup/redundant-code

# 3. 执行删除
rm -rf src/core/
rm -rf src/browser/
rm -rf src/node/
rm -rf src/native/
rm -rf src/iife/
rm -rf src/shims/

# 4. 更新 .gitignore
cat > .gitignore << 'EOF'
node_modules/
web/node_modules/
dist/
data/*.db
.env
.vscode/
.DS_Store
EOF

# 5. 更新 package.json
# (手动编辑，添加 msw 依赖)

# 6. 安装新依赖
pnpm install

# 7. 运行测试
pnpm test

# 8. 提交更改
git add -A
git commit -m "refactor: remove redundant MSW code, use npm package"
```

---

**清理后预期结果**:
- 代码体积减少 ~60%
- 仓库大小减少 ~200M
- 依赖更清晰，维护更简单
- 与上游 MSW 库保持同步

---

**执行日期**: ____________________
**执行人**: ____________________
**验证人**: ____________________
