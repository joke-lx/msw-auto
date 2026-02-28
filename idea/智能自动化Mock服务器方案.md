# 智能自动化 Mock 服务器 - 完整技术方案

## 项目概述

基于 MSW 核心思想的改进版本，实现：

1. **零侵入性**：完全独立于前端代码，无需修改任何前端代码
2. **全自动化**：利用 LLM 自动生成和管理 Mock 数据
3. **可视化界面**：Web UI 展示接口信息 + Claude Code 集成
4. **智能代理**：自动代理真实后端请求，无缝切换 Mock/真实数据

---

## 一、技术架构

### 1.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    项目结构（独立文件夹）                       │
│                                                              │
│  ├── mock-server/              # Mock 服务器核心              │
│  │   ├── src/                 │                             │
│  │   │   ├── server/          # 服务器核心                  │
│  │   │   ├── proxy/           # 代理层                      │
│  │   │   ├── mock/            # Mock 管理                   │
│  │   │   ├── llm/             # LLM 集成                   │
│  │   │   └── storage/         # 数据存储                    │
│  │   ├── web-ui/              # Web 界面                    │
│  │   └── database/            # 数据库                      │
│  │                                                             │
│  └── config/                   # 配置文件                     │
│      ├── server.config.js      # 服务器配置                   │
│      └── proxy.config.js       # 代理配置                    │
│                                                              │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 核心模块

#### 1.2.1 服务器核心 (server/)

```
server/
├── index.js                 # 服务器入口
├── routes/                  # 路由定义
│   ├── api.routes.js       # API 路由
│   ├── mock.routes.js      # Mock 路由
│   └── proxy.routes.js     # 代理路由
├── middleware/             # 中间件
│   ├── logger.middleware.js # 日志中间件
│   ├── cors.middleware.js   # CORS 中间件
│   └── proxy.middleware.js # 代理中间件
└── app.js                  # Express 应用
```

#### 1.2.2 代理层 (proxy/)

```
proxy/
├── http-proxy.js          # HTTP 代理
├── graphql-proxy.js       # GraphQL 代理
├── websocket-proxy.js     # WebSocket 代理
└── request-interceptor.js # 请求拦截器
```

#### 1.2.3 Mock 管理 (mock/)

```
mock/
├── mock-manager.js       # Mock 管理器
├── mock-generator.js      # Mock 生成器
├── mock-validator.js      # Mock 验证器
└── mock-serializer.js    # Mock 序列化
```

#### 1.2.4 LLM 集成 (llm/)

```
llm/
├── claude-client.js       # Claude 客户端
├── prompt-builder.js     # 提示词构建
├── response-parser.js    # 响应解析
└── code-generator.js     # 代码生成器
```

#### 1.2.5 数据存储 (storage/)

```
storage/
├── database.js          # 数据库连接
├── models/              # 数据模型
│   ├── mock.model.js
│   ├── request.model.js
│   └── config.model.js
└── repositories/        # 数据访问层
    ├── mock.repository.js
    └── request.repository.js
```

#### 1.2.6 Web UI (web-ui/)

```
web-ui/
├── src/
│   ├── components/       # React 组件
│   │   ├── APIPanel.jsx          # 接口面板
│   │   ├── ClaudeSidebar.jsx     # Claude 侧边栏
│   │   ├── RequestList.jsx      # 请求列表
│   │   ├── MockEditor.jsx       # Mock 编辑器
│   │   └── DocumentGenerator.jsx # 文档生成器
│   ├── pages/
│   │   ├── Dashboard.jsx        # 仪表盘
│   │   ├── APIExplorer.jsx      # API 浏览器
│   │   └── Settings.jsx        # 设置
│   ├── services/
│   │   ├── api.service.js       # API 服务
│   │   ├── claude.service.js    # Claude 服务
│   │   └── websocket.service.js # WebSocket 服务
│   └── utils/
│       ├── formatters.js        # 格式化工具
│       └── generators.js        # 生成器工具
└── public/
    └── index.html
```

---

## 二、核心功能实现

### 2.1 服务器启动流程

```javascript
// src/server/index.js
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const httpProxy = require('http-proxy');
const WebSocket = require('ws');
const { setupDatabase } = require('../storage/database');
const { MockManager } = require('../mock/mock-manager');
const { ClaudeClient } = require('../llm/claude-client');

class MockServer {
  constructor(config) {
    this.app = express();
    this.config = config;
    this.mockManager = new MockManager();
    this.claudeClient = new ClaudeClient(config.claude);
    this.requestLogger = [];
    this.setupMiddleware();
    this.setupRoutes();
    this.setupProxy();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use((req, res, next) => {
      this.logRequest(req);
      next();
    });
  }

  setupRoutes() {
    // API 路由
    this.app.get('/api/mocks', this.listMocks.bind(this));
    this.app.post('/api/mocks', this.createMock.bind(this));
    this.app.put('/api/mocks/:id', this.updateMock.bind(this));
    this.app.delete('/api/mocks/:id', this.deleteMock.bind(this));

    // 代理路由（所有其他请求）
    this.app.use('*', this.handleProxy.bind(this));
  }

  setupProxy() {
    // 设置到真实后端的代理
    this.realBackendProxy = httpProxy.createProxyServer({
      target: this.config.backendUrl,
      changeOrigin: true,
      secure: false,
      onProxyReq: (proxyReq, req, res) => {
        console.log(`[Proxy] ${req.method} ${req.url} -> ${this.config.backendUrl}${req.url}`);
      },
      onProxyRes: (proxyRes, req, res) => {
        // 记录真实响应
        this.logResponse(req, proxyRes);
      },
      onError: (err, req, res) => {
        console.error('[Proxy Error]', err);
        res.status(500).json({ error: 'Proxy error', message: err.message });
      }
    });
  }

  async handleProxy(req, res) {
    // 检查是否有匹配的 Mock
    const mock = await this.mockManager.findMatchingMock(req);

    if (mock) {
      console.log(`[Mock] Using mock for ${req.method} ${req.url}`);
      return res.status(mock.status || 200).json(mock.response);
    }

    // 如果没有 Mock，代理到真实后端
    this.realBackendProxy.web(req, res);
  }

  logRequest(req) {
    const logEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      query: req.query,
    };

    this.requestLogger.push(logEntry);
    this.broadcastRequest(logEntry);
  }

  logResponse(req, res) {
    const logEntry = this.requestLogger.find(log => log.url === req.url);
    if (logEntry) {
      logEntry.response = {
        status: res.statusCode,
        headers: res.headers,
        body: res.body || {},
      };
    }
  }

  broadcastRequest(logEntry) {
    // 通过 WebSocket 广播到 Web UI
    this.wss?.clients?.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'REQUEST', data: logEntry }));
      }
    });
  }

  // Mock CRUD 操作
  async listMocks(req, res) {
    const mocks = await this.mockManager.list();
    res.json(mocks);
  }

  async createMock(req, res) {
    const mock = await this.mockManager.create(req.body);
    res.json(mock);
  }

  async updateMock(req, res) {
    const mock = await this.mockManager.update(req.params.id, req.body);
    res.json(mock);
  }

  async deleteMock(req, res) {
    await this.mockManager.delete(req.params.id);
    res.json({ success: true });
  }

  start() {
    const PORT = this.config.port || 4000;
    const server = this.app.listen(PORT, () => {
      console.log(`✅ Mock Server running on http://localhost:${PORT}`);
      console.log(`📡 Proxying to: ${this.config.backendUrl}`);
      console.log(`🌐 Web UI: http://localhost:${this.config.webUiPort || 4001}`);
    });

    // 设置 WebSocket 用于实时通信
    this.wss = new WebSocket.Server({ server, path: '/ws' });
    this.wss.on('connection', (ws) => {
      console.log('🔗 WebSocket client connected');

      ws.send(JSON.stringify({
        type: 'INIT',
        data: {
          mocks: await this.mockManager.list(),
          recentRequests: this.requestLogger.slice(-50),
        }
      }));

      ws.on('message', async (message) => {
        const data = JSON.parse(message);
        await this.handleWebSocketMessage(ws, data);
      });
    });
  }

  async handleWebSocketMessage(ws, message) {
    switch (message.type) {
      case 'GENERATE_MOCK':
        // 使用 Claude 生成 Mock
        const generatedMock = await this.claudeClient.generateMock(message.data);
        ws.send(JSON.stringify({ type: 'MOCK_GENERATED', data: generatedMock }));
        break;

      case 'UPDATE_MOCK':
        // 更新 Mock
        await this.mockManager.update(message.data.id, message.data);
        this.broadcastMocks();
        break;
    }
  }
}

module.exports = MockServer;
```

### 2.2 Mock 管理器

```javascript
// src/mock/mock-manager.js
const { v4: uuidv4 } = require('uuid')
const { MockRepository } = require('../storage/repositories/mock.repository')

class MockManager {
  constructor() {
    this.mockRepository = new MockRepository()
  }

  async create(mockData) {
    const mock = {
      id: uuidv4(),
      ...mockData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    }

    return await this.mockRepository.save(mock)
  }

  async update(id, updates) {
    const existingMock = await this.mockRepository.findById(id)
    if (!existingMock) {
      throw new Error(`Mock with id ${id} not found`)
    }

    const updatedMock = {
      ...existingMock,
      ...updates,
      updatedAt: new Date().toISOString(),
      version: existingMock.version + 1,
    }

    return await this.mockRepository.save(updatedMock)
  }

  async delete(id) {
    return await this.mockRepository.delete(id)
  }

  async list(filters = {}) {
    return await this.mockRepository.findAll(filters)
  }

  async findMatchingMock(req) {
    const mocks = await this.mockRepository.findAll({ enabled: true })

    for (const mock of mocks) {
      if (this.isMatch(req, mock)) {
        return mock
      }
    }

    return null
  }

  isMatch(req, mock) {
    // 匹配 HTTP 方法
    if (mock.method && mock.method.toUpperCase() !== req.method.toUpperCase()) {
      return false
    }

    // 匹配 URL
    if (mock.path) {
      const mockUrlPattern = mock.path
        .replace(/:([^/]+)/g, '[^/]+')
        .replace(/\*/g, '.*')
      const regex = new RegExp(`^${mockUrlPattern}$`)

      if (!regex.test(req.path)) {
        return false
      }

      // 提取路径参数
      const mockUrl = mock.path
      const reqUrl = req.path
      const mockParts = mockUrl.split('/')
      const reqParts = reqUrl.split('/')

      const params = {}
      for (let i = 0; i < mockParts.length; i++) {
        if (mockParts[i].startsWith(':')) {
          const paramName = mockParts[i].slice(1)
          params[paramName] = reqParts[i]
        }
      }

      req.params = params
    }

    // 匹配查询参数
    if (mock.queryParams) {
      for (const [key, value] of Object.entries(mock.queryParams)) {
        if (req.query[key] !== value) {
          return false
        }
      }
    }

    // 匹配请求体
    if (mock.body && typeof mock.body === 'object') {
      const reqBody = req.body
      for (const [key, value] of Object.entries(mock.body)) {
        if (reqBody[key] !== value) {
          return false
        }
      }
    }

    return true
  }
}

module.exports = MockManager
```

### 2.3 Claude 客户端

````javascript
// src/llm/claude-client.js
const Anthropic = require('@anthropic-ai/sdk')

class ClaudeClient {
  constructor(config) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://api.anthropic.com',
    })
    this.model = config.model || 'claude-3-5-sonnet-20241022'
  }

  async generateMock(apiSpec) {
    const prompt = this.buildPrompt(apiSpec)

    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system:
          'You are an expert API mock generator. Generate realistic mock data based on API specifications.',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      })

      const response = message.content[0].text
      return this.parseResponse(response)
    } catch (error) {
      console.error('[Claude Error]', error)
      throw new Error('Failed to generate mock from Claude')
    }
  }

  buildPrompt(apiSpec) {
    return `
Generate a mock response for the following API specification:

${JSON.stringify(apiSpec, null, 2)}

Requirements:
1. Generate realistic mock data that matches the API specification
2. Include all required fields
3. Use appropriate data types
4. Include realistic example values
5. Handle edge cases if mentioned in the spec
6. Return the response in the following JSON format:
{
  "status": 200,
  "response": { ...mock data... },
  "description": "Description of what this mock represents",
  "tags": ["user", "create", "rest"]
}

If the API specification is unclear or incomplete, make reasonable assumptions and note them in the description.
    `.trim()
  }

  parseResponse(response) {
    try {
      // 提取 JSON 部分
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1])
      }

      // 如果没有代码块，尝试直接解析
      return JSON.parse(response)
    } catch (error) {
      console.error('[Parse Error]', error)
      throw new Error('Failed to parse Claude response')
    }
  }

  async generateFromOpenAPISpec(openApiSpec) {
    const prompt = `
Analyze the following OpenAPI specification and generate mock data for all endpoints:

${JSON.stringify(openApiSpec, null, 2)}

For each endpoint, generate:
1. A successful response mock
2. An error response mock
3. Edge case mocks if applicable

Return the result in the following format:
{
  "mocks": [
    {
      "method": "GET",
      "path": "/api/users",
      "status": 200,
      "response": { ... },
      "description": "...",
      "tags": ["users"]
    }
  ]
}
    `.trim()

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 8192,
      system:
        'You are an expert API mock generator. Analyze OpenAPI specifications and generate comprehensive mock data.',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const response = message.content[0].text
    return this.parseResponse(response)
  }

  async chat(messages, context = {}) {
    try {
      const systemPrompt = this.buildSystemPrompt(context)

      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      })

      return message.content[0].text
    } catch (error) {
      console.error('[Chat Error]', error)
      throw error
    }
  }

  buildSystemPrompt(context) {
    return `
You are a helpful assistant for managing API mocks. You have access to:

Current Mock Configuration:
${JSON.stringify(context.mocks || {}, null, 2)}

Recent API Requests:
${JSON.stringify(context.recentRequests || [], null, 2)}

Your role:
1. Help users create and modify mock responses
2. Generate realistic mock data based on API specifications
3. Suggest improvements to existing mocks
4. Answer questions about the mocked API

Always provide clear, actionable responses.
    `.trim()
  }
}

module.exports = ClaudeClient
````

### 2.4 数据库存储

```javascript
// src/storage/database.js
const sqlite3 = require('sqlite3').verbose()
const path = require('path')
const fs = require('fs')

class Database {
  constructor(dbPath) {
    this.dbPath = dbPath
    this.db = null
  }

  async connect() {
    return new Promise((resolve, reject) => {
      const dir = path.dirname(this.dbPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err)
        } else {
          console.log('✅ Database connected')
          this.initSchema().then(resolve).catch(reject)
        }
      })
    })
  }

  async initSchema() {
    const queries = [
      // Mock 表
      `CREATE TABLE IF NOT EXISTS mocks (
        id TEXT PRIMARY KEY,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        status INTEGER DEFAULT 200,
        response TEXT NOT NULL,
        queryParams TEXT,
        headers TEXT,
        enabled BOOLEAN DEFAULT 1,
        description TEXT,
        tags TEXT,
        version INTEGER DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`,

      // 请求日志表
      `CREATE TABLE IF NOT EXISTS request_logs (
        id TEXT PRIMARY KEY,
        method TEXT NOT NULL,
        url TEXT NOT NULL,
        headers TEXT,
        body TEXT,
        query TEXT,
        responseStatus INTEGER,
        responseBody TEXT,
        responseTime INTEGER,
        isMocked BOOLEAN DEFAULT 0,
        timestamp TEXT NOT NULL
      )`,

      // 会话表
      `CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL
      )`,

      // 索引
      `CREATE INDEX IF NOT EXISTS idx_mocks_method_path ON mocks(method, path)`,
      `CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON request_logs(timestamp DESC)`,
    ]

    for (const query of queries) {
      await this.run(query)
    }
  }

  run(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(query, params, function (err) {
        if (err) reject(err)
        else resolve(this)
      })
    })
  }

  get(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(query, params, (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })
  }

  all(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) reject(err)
        else resolve(rows)
      })
    })
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }
}

let databaseInstance = null

async function setupDatabase(config) {
  if (databaseInstance) {
    return databaseInstance
  }

  const dbPath = config.dbPath || './data/mocks.db'
  databaseInstance = new Database(dbPath)
  await databaseInstance.connect()
  return databaseInstance
}

module.exports = { Database, setupDatabase }
```

---

## 三、Web UI 实现

### 3.1 主应用组件

```jsx
// web-ui/src/Dashboard.jsx
import React, { useState, useEffect } from 'react'
import APIPanel from './components/APIPanel'
import ClaudeSidebar from './components/ClaudeSidebar'
import RequestList from './components/RequestList'
import { apiService } from './services/api.service'
import { websocketService } from './services/websocket.service'

function Dashboard() {
  const [requests, setRequests] = useState([])
  const [mocks, setMocks] = useState([])
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [isClaudeConnected, setIsClaudeConnected] = useState(false)

  useEffect(() => {
    // 加载初始数据
    loadData()

    // 建立 WebSocket 连接
    websocketService.connect()

    // 监听实时请求
    websocketService.on('REQUEST', (data) => {
      setRequests((prev) => [data, ...prev].slice(0, 100))
    })

    // 监听 Mock 更新
    websocketService.on('MOCK_UPDATED', (data) => {
      loadMocks()
    })

    return () => {
      websocketService.disconnect()
    }
  }, [])

  const loadData = async () => {
    try {
      const [mocksData, requestsData] = await Promise.all([
        apiService.getMocks(),
        apiService.getRecentRequests(),
      ])
      setMocks(mocksData)
      setRequests(requestsData)
    } catch (error) {
      console.error('Failed to load data:', error)
    }
  }

  const loadMocks = async () => {
    try {
      const mocksData = await apiService.getMocks()
      setMocks(mocksData)
    } catch (error) {
      console.error('Failed to load mocks:', error)
    }
  }

  const handleGenerateMock = async (request) => {
    try {
      const apiSpec = {
        method: request.method,
        path: request.url,
        headers: request.headers,
        query: request.query,
      }

      const generatedMock = await apiService.generateMock(apiSpec)
      await apiService.createMock(generatedMock)
      await loadMocks()

      return generatedMock
    } catch (error) {
      console.error('Failed to generate mock:', error)
      throw error
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>🎭 智能 Mock 服务器</h1>
        <div className="status-indicators">
          <span
            className={`indicator ${isClaudeConnected ? 'connected' : 'disconnected'}`}
          >
            {isClaudeConnected ? '🤖 Claude 已连接' : '🔴 Claude 未连接'}
          </span>
        </div>
      </header>

      <div className="dashboard-content">
        <main className="main-content">
          <RequestList
            requests={requests}
            selectedRequest={selectedRequest}
            onRequestSelect={setSelectedRequest}
          />

          <APIPanel
            request={selectedRequest}
            mocks={mocks}
            onGenerateMock={handleGenerateMock}
          />
        </main>

        <aside className="sidebar">
          <ClaudeSidebar
            request={selectedRequest}
            mocks={mocks}
            onMockUpdate={loadMocks}
            onConnectionChange={setIsClaudeConnected}
          />
        </aside>
      </div>
    </div>
  )
}

export default Dashboard
```

### 3.2 API 面板组件

```jsx
// web-ui/src/components/APIPanel.jsx
import React, { useState } from 'react'
import { generateMarkdownDocumentation } from '../utils/formatters'

function APIPanel({ request, mocks, onGenerateMock }) {
  const [markdown, setMarkdown] = useState('')
  const [copied, setCopied] = useState(false)

  const handleGenerateDoc = () => {
    if (!request) return

    const mock = mocks.find(
      (m) => m.method === request.method && m.path === request.url,
    )

    const doc = generateMarkdownDocumentation(request, mock)
    setMarkdown(doc)
  }

  const handleCopyDoc = async () => {
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleGenerateMock = async () => {
    try {
      await onGenerateMock(request)
    } catch (error) {
      alert('生成 Mock 失败: ' + error.message)
    }
  }

  if (!request) {
    return (
      <div className="api-panel empty">
        <p>选择一个请求查看详情</p>
      </div>
    )
  }

  return (
    <div className="api-panel">
      <div className="panel-header">
        <h2>API 详情</h2>
        <div className="panel-actions">
          <button className="btn btn-secondary" onClick={handleGenerateDoc}>
            📄 生成文档
          </button>
          {markdown && (
            <button
              className={`btn ${copied ? 'btn-success' : 'btn-primary'}`}
              onClick={handleCopyDoc}
            >
              {copied ? '✓ 已复制' : '📋 复制文档'}
            </button>
          )}
          <button className="btn btn-primary" onClick={handleGenerateMock}>
            🤖 生成 Mock
          </button>
        </div>
      </div>

      <div className="request-details">
        <div className="detail-row">
          <label>方法:</label>
          <span className={`method method-${request.method.toLowerCase()}`}>
            {request.method}
          </span>
        </div>

        <div className="detail-row">
          <label>URL:</label>
          <code>{request.url}</code>
        </div>

        <div className="detail-section">
          <h3>请求头</h3>
          <pre>
            <code>{JSON.stringify(request.headers, null, 2)}</code>
          </pre>
        </div>

        {request.query && Object.keys(request.query).length > 0 && (
          <div className="detail-section">
            <h3>查询参数</h3>
            <pre>
              <code>{JSON.stringify(request.query, null, 2)}</code>
            </pre>
          </div>
        )}

        {request.body && (
          <div className="detail-section">
            <h3>请求体</h3>
            <pre>
              <code>{JSON.stringify(request.body, null, 2)}</code>
            </pre>
          </div>
        )}

        {request.response && (
          <div className="detail-section">
            <h3>响应</h3>
            <div className={`status-badge status-${request.response.status}`}>
              {request.response.status}
            </div>
            <pre>
              <code>{JSON.stringify(request.response.body, null, 2)}</code>
            </pre>
          </div>
        )}
      </div>

      {markdown && (
        <div className="markdown-preview">
          <h3>Markdown 文档</h3>
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            className="markdown-textarea"
            rows={20}
          />
        </div>
      )}
    </div>
  )
}

export default APIPanel
```

### 3.3 Claude 侧边栏组件

````jsx
// web-ui/src/components/ClaudeSidebar.jsx
import React, { useState, useEffect, useRef } from 'react'
import { claudeService } from '../services/claude.service'

function ClaudeSidebar({ request, mocks, onMockUpdate, onConnectionChange }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    checkConnection()
    // 初始欢迎消息
    addMessage(
      'assistant',
      '你好！我是你的 AI Mock 助手。我可以帮你：\n\n1. 生成 Mock 数据\n2. 修改现有 Mock\n3. 优化 Mock 配置\n4. 回答 API 相关问题\n\n有什么可以帮你的吗？',
    )
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const checkConnection = async () => {
    try {
      await claudeService.ping()
      setIsConnected(true)
      onConnectionChange(true)
    } catch (error) {
      setIsConnected(false)
      onConnectionChange(false)
    }
  }

  const addMessage = (role, content) => {
    setMessages((prev) => [...prev, { role, content, timestamp: new Date() }])
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    addMessage('user', userMessage)
    setIsLoading(true)

    try {
      const context = {
        currentRequest: request,
        availableMocks: mocks,
        messages: messages,
      }

      const response = await claudeService.chat(userMessage, context)
      addMessage('assistant', response)

      // 如果响应包含可执行的 Mock 更新
      if (response.includes('```json')) {
        try {
          const mockUpdate = extractMockUpdate(response)
          if (mockUpdate) {
            await claudeService.updateMock(mockUpdate)
            await onMockUpdate()
          }
        } catch (error) {
          console.error('Failed to apply mock update:', error)
        }
      }
    } catch (error) {
      addMessage('assistant', `抱歉，我遇到了一些问题：${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const extractMockUpdate = (response) => {
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1])
    }
    return null
  }

  const handleQuickAction = async (action) => {
    const prompts = {
      generate: '请根据当前选择的请求生成一个 Mock 响应',
      improve: '请分析并改进当前 Mock 的数据结构',
      variants: '请生成当前 Mock 的几个变体',
      docs: '请生成这个 API 的完整文档',
    }

    setInput(prompts[action])
    await handleSend()
  }

  return (
    <div className="claude-sidebar">
      <div className="sidebar-header">
        <h2>🤖 Claude AI 助手</h2>
        <div
          className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}
        >
          {isConnected ? '🟢 已连接' : '🔴 未连接'}
        </div>
      </div>

      <div className="quick-actions">
        {request && (
          <>
            <button onClick={() => handleQuickAction('generate')}>
              🎯 生成 Mock
            </button>
            <button onClick={() => handleQuickAction('improve')}>
              ✨ 改进 Mock
            </button>
            <button onClick={() => handleQuickAction('variants')}>
              🔄 生成变体
            </button>
            <button onClick={() => handleQuickAction('docs')}>
              📄 生成文档
            </button>
          </>
        )}
      </div>

      <div className="messages-container">
        {messages.map((message, index) => (
          <div key={index} className={`message message-${message.role}`}>
            <div className="message-header">
              <span className="message-role">
                {message.role === 'user' ? '👤 用户' : '🤖 Claude'}
              </span>
              <span className="message-time">
                {new Date(message.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="message-content">
              {message.role === 'assistant' ? (
                <MarkdownContent content={message.content} />
              ) : (
                <pre>{message.content}</pre>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message message-assistant">
            <div className="message-content loading">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-container">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="输入你的问题或指令... (Shift+Enter 换行)"
          rows={3}
          disabled={!isConnected}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading || !isConnected}
          className="btn btn-primary"
        >
          {isLoading ? '发送中...' : '发送'}
        </button>
      </div>
    </div>
  )
}

// 简单的 Markdown 渲染组件
function MarkdownContent({ content }) {
  const html = content
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')

  return <div dangerouslySetInnerHTML={{ __html: html }} />
}

export default ClaudeSidebar
````

### 3.4 Markdown 生成器

````javascript
// web-ui/src/utils/formatters.js
export function generateMarkdownDocumentation(request, mock) {
  const lines = []

  // 标题
  const pathTitle = request.url.split('/').pop() || 'API'
  lines.push(`# ${pathTitle}`)
  lines.push('')

  // 基本信息
  lines.push('## 基本信息')
  lines.push('')
  lines.push(`- **方法**: \`${request.method}\``)
  lines.push(`- **路径**: \`${request.url}\``)
  lines.push(`- **状态码**: ${mock?.status || 200}`)
  lines.push('')

  // 描述
  if (mock?.description) {
    lines.push('## 描述')
    lines.push('')
    lines.push(mock.description)
    lines.push('')
  }

  // 请求
  lines.push('## 请求')
  lines.push('')

  // 请求头
  if (request.headers) {
    lines.push('### 请求头')
    lines.push('')
    lines.push('| 名称 | 值 |')
    lines.push('|------|-----|')
    for (const [key, value] of Object.entries(request.headers)) {
      if (key !== 'content-length' && key !== 'host') {
        lines.push(`| \`${key}\` | \`${value}\` |`)
      }
    }
    lines.push('')
  }

  // 查询参数
  if (request.query && Object.keys(request.query).length > 0) {
    lines.push('### 查询参数')
    lines.push('')
    lines.push('| 参数 | 类型 | 必填 | 描述 |')
    lines.push('|------|------|------|------|')
    for (const [key, value] of Object.entries(request.query)) {
      lines.push(`| \`${key}\` | string | 否 | ${value} |`)
    }
    lines.push('')
  }

  // 请求体
  if (request.body) {
    lines.push('### 请求体')
    lines.push('')
    lines.push('```json')
    lines.push(JSON.stringify(request.body, null, 2))
    lines.push('```')
    lines.push('')
  }

  // 响应
  lines.push('## 响应')
  lines.push('')

  if (mock?.response) {
    lines.push('### 成功响应')
    lines.push('')
    lines.push(`**状态码**: ${mock.status || 200}`)
    lines.push('')
    lines.push('```json')
    lines.push(JSON.stringify(mock.response, null, 2))
    lines.push('```')
    lines.push('')

    // 响应字段说明
    lines.push('### 响应字段')
    lines.push('')
    lines.push('| 字段 | 类型 | 描述 |')
    lines.push('|------|------|------|')
    const fields = extractFields(mock.response)
    for (const field of fields) {
      lines.push(`| \`${field.name}\` | ${field.type} | ${field.description} |`)
    }
    lines.push('')
  }

  // 标签
  if (mock?.tags && mock.tags.length > 0) {
    lines.push('## 标签')
    lines.push('')
    mock.tags.forEach((tag) => lines.push(`- ${tag}`))
    lines.push('')
  }

  // 示例代码
  lines.push('## 示例代码')
  lines.push('')
  lines.push('### JavaScript/Fetch')
  lines.push('')
  lines.push('```javascript')
  lines.push(`fetch('${request.url}', {`)
  lines.push(`  method: '${request.method}',`)
  lines.push(`  headers: {`)
  lines.push(`    'Content-Type': 'application/json',`)
  lines.push(`  },`)
  if (request.body) {
    lines.push(`  body: JSON.stringify(${JSON.stringify(request.body)}),`)
  }
  lines.push(`})`)
  lines.push(`  .then(response => response.json())`)
  lines.push(`  .then(data => console.log(data))`)
  lines.push(`  .catch(error => console.error('Error:', error))`)
  lines.push(``)
  lines.push('```')
  lines.push('')

  return lines.join('\n')
}

function extractFields(obj, prefix = '') {
  const fields = []

  for (const [key, value] of Object.entries(obj)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key

    if (value !== null && typeof value === 'object') {
      fields.push(...extractFields(value, fieldPath))
    } else {
      const type = typeof value
      const description = generateFieldDescription(value)
      fields.push({
        name: fieldPath,
        type,
        description,
      })
    }
  }

  return fields
}

function generateFieldDescription(value) {
  if (typeof value === 'string') {
    if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
      return '日期时间'
    }
    if (value.match(/^[\w-]+@[\w-]+\.[\w-.]+$/)) {
      return '邮箱地址'
    }
    if (value.match(/^\d+$/)) {
      return '数字字符串'
    }
    return '字符串'
  }

  if (typeof value === 'number') {
    return '数字'
  }

  if (typeof value === 'boolean') {
    return '布尔值'
  }

  if (value === null) {
    return '可为空'
  }

  return '未知类型'
}
````

---

## 四、启动和使用

### 4.1 项目结构

```
mock-server-project/
├── package.json
├── config/
│   ├── server.config.js
│   └── proxy.config.js
├── src/
│   ├── server/
│   ├── proxy/
│   ├── mock/
│   ├── llm/
│   ├── storage/
│   └── web-ui/
└── data/
    └── mocks.db
```

### 4.2 启动流程

```javascript
// config/server.config.js
module.exports = {
  port: 4000, // Mock 服务器端口
  webUiPort: 4001, // Web UI 端口
  backendUrl: 'http://localhost:3000', // 真实后端 URL

  claude: {
    apiKey: process.env.CLAUDE_API_KEY,
    baseURL: process.env.CLAUDE_BASE_URL || 'https://api.anthropic.com',
    model: 'claude-3-5-sonnet-20241022',
  },

  database: {
    dbPath: './data/mocks.db',
  },

  features: {
    autoProxy: true, // 自动代理未匹配的请求
    logRequests: true, // 记录所有请求
    autoGenerateMock: false, // 自动生成 Mock（需要确认）
  },
}
```

```javascript
// index.js - 主入口
const config = require('./config/server.config')
const { MockServer } = require('./src/server')

// 启动 Mock 服务器
const server = new MockServer(config)
server.start()

console.log(`
✅ Mock Server 启动成功！

📡 Mock API:     http://localhost:${config.port}
🌐 Web UI:       http://localhost:${config.webUiPort}
🔗 Real Backend: ${config.backendUrl}

💡 使用说明：
1. 修改前端应用的 API base URL 为 http://localhost:${config.port}
2. 打开 Web UI: http://localhost:${config.webUiPort}
3. 在 Web UI 中查看请求、生成 Mock、使用 Claude AI
`)
```

### 4.3 前端应用配置

无需修改任何代码！只需要在启动时设置环境变量或配置：

**方式1：环境变量**

```bash
# React 应用
REACT_APP_API_URL=http://localhost:4000 npm start

# Vue 应用
VUE_APP_API_URL=http://localhost:4000 npm run dev
```

**方式2：代理配置**

```javascript
// 前端项目的 package.json
{
  "scripts": {
    "start": "REACT_APP_API_URL=http://localhost:4000 react-scripts start"
  }
}
```

**方式3：启动脚本**

```bash
# 修改前端项目的启动脚本
#!/bin/bash

# 启动 Mock 服务器
cd mock-server-project
node index.js &

# 等待服务器启动
sleep 3

# 启动前端应用
cd ../frontend-project
REACT_APP_API_URL=http://localhost:4000 npm start
```

---

## 五、可用的第三方库

### 5.1 核心依赖

```json
{
  "dependencies": {
    // 服务器框架
    "express": "^4.18.2",
    "cors": "^2.8.5",

    // HTTP 代理
    "http-proxy": "^1.18.1",
    "http-proxy-middleware": "^2.0.6",

    // WebSocket
    "ws": "^8.13.0",

    // 数据库
    "sqlite3": "^5.1.6",
    "better-sqlite3": "^8.7.0",

    // Claude API
    "@anthropic-ai/sdk": "^0.24.3",

    // 工具库
    "uuid": "^9.0.0",
    "lodash": "^4.17.21",
    "dotenv": "^16.3.1",

    // 日志
    "winston": "^3.11.0",
    "pino": "^8.16.2",

    // 验证
    "joi": "^17.11.0",
    "ajv": "^8.12.0",

    // 代码生成
    "handlebars": "^4.7.8",
    "mustache": "^4.2.0",

    // OpenAPI
    "swagger-parser": "^10.0.3",
    "@apidevtools/swagger-parser": "^10.0.3",

    // 请求/响应处理
    "body-parser": "^1.20.2",
    "multer": "^1.4.5-lts.1",

    // HTTP 客户端
    "axios": "^1.6.2",
    "node-fetch": "^3.3.2"
  },

  "devDependencies": {
    // Web UI
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.8",

    // UI 组件库
    "antd": "^5.12.2",
    "@mui/material": "^5.15.1",
    "@emotion/react": "^11.11.1",

    // Markdown 渲染
    "react-markdown": "^9.0.1",
    "remark-gfm": "^4.0.0",

    // 代码高亮
    "prismjs": "^1.29.0",
    "react-syntax-highlighter": "^15.5.0",

    // 代码编辑器
    "monaco-editor": "^0.45.0",
    "@monaco-editor/react": "^4.6.0",

    // 开发工具
    "typescript": "^5.3.3",
    "@types/react": "^18.2.45",
    "@types/node": "^20.10.6",
    "nodemon": "^3.0.2",
    "jest": "^29.7.0"
  }
}
```

### 5.2 可选增强库

```json
{
  "optional": {
    // 性能优化
    "compression": "^1.7.4",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5",

    // 认证
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1",
    "passport": "^0.7.0",

    // 文件处理
    "multer": "^1.4.5-lts.1",
    "formidable": "^3.5.1",

    // 图表
    "recharts": "^2.10.3",
    "chart.js": "^4.4.0",

    // 实时协作
    "socket.io": "^4.6.1",

    // 任务队列
    "bull": "^4.12.0",
    "agenda": "^5.0.0",

    // 监控
    "prom-client": "^15.1.0",
    "pino-opentelemetry": "^0.6.0",

    // 测试
    "supertest": "^6.3.3",
    "msw": "^2.0.0"
  }
}
```

---

## 六、文档和资源

### 6.1 官方文档

- **Express**: https://expressjs.com/
- **Anthropic API**: https://docs.anthropic.com/claude/reference
- **SQLite**: https://www.sqlite.org/docs.html
- **WebSocket**: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- **React**: https://react.dev/

### 6.2 参考项目

- **MSW**: https://mswjs.io/
- **http-proxy-middleware**: https://github.com/chimurai/http-proxy-middleware
- **mockoon**: https://mockoon.com/
- **Postman**: https://www.postman.com/

### 6.3 学习资源

- **Service Worker API**: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- **OpenAPI Specification**: https://swagger.io/specification/
- **REST API 设计**: https://restfulapi.net/

---

## 七、总结

这个智能自动化 Mock 服务器方案解决了以下问题：

✅ **零侵入性**：完全独立于前端代码，通过代理方式工作
✅ **全自动化**：利用 Claude AI 自动生成 Mock 数据
✅ **可视化界面**：Web UI 提供完整的监控和管理功能
✅ **智能代理**：自动代理真实后端，无缝切换
✅ **文档生成**：自动生成 Markdown 格式的 API 文档
✅ **AI 辅助**：Claude Code 集成，自然语言交互

这是一个完整的生产级解决方案，可以极大地提升前端开发效率！
