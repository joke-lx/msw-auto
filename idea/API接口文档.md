# API 接口文档

## 一、API 概述

### 1.1 基础信息

| 项目     | 说明                        |
| -------- | --------------------------- |
| 基础 URL | `http://localhost:4000/api` |
| 认证方式 | JWT Bearer Token            |
| 响应格式 | JSON                        |
| 字符编码 | UTF-8                       |
| 速率限制 | 100 请求/15 分钟            |

### 1.2 通用响应格式

```typescript
// 成功响应
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "req_123456"
  }
}

// 错误响应
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid request parameters",
    "details": { ... }
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "req_123456"
  }
}
```

### 1.3 HTTP 状态码

| 状态码 | 说明           |
| ------ | -------------- |
| 200    | 请求成功       |
| 201    | 创建成功       |
| 204    | 无内容         |
| 400    | 请求参数错误   |
| 401    | 未授权         |
| 403    | 禁止访问       |
| 404    | 资源不存在     |
| 409    | 资源冲突       |
| 422    | 验证失败       |
| 429    | 请求过于频繁   |
| 500    | 服务器内部错误 |

---

## 二、Mock 管理 API

### 2.1 获取 Mock 列表

**接口**：`GET /api/mocks`

**请求参数**：

| 参数       | 类型     | 必填 | 说明                     |
| ---------- | -------- | ---- | ------------------------ |
| page       | number   | 否   | 页码，默认 1             |
| pageSize   | number   | 否   | 每页数量，默认 20        |
| method     | string   | 否   | HTTP 方法过滤            |
| path       | string   | 否   | 路径过滤（支持模糊搜索） |
| enabled    | boolean  | 否   | 是否启用过滤             |
| tags       | string[] | 否   | 标签过滤                 |
| created_by | string   | 否   | 创建者 ID 过滤           |

**请求示例**：

```bash
GET /api/mocks?page=1&pageSize=20&enabled=true&tags[]=users
```

**响应示例**：

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "mock_1234567890_abc123def",
        "method": "GET",
        "path": "/api/users",
        "status": 200,
        "response": {
          "users": [
            {
              "id": "1",
              "name": "Alice",
              "email": "alice@example.com"
            }
          ]
        },
        "headers": {
          "Content-Type": "application/json"
        },
        "delay": 0,
        "enabled": true,
        "dynamic_response": false,
        "description": "用户列表 Mock",
        "tags": ["users", "list"],
        "version": 1,
        "created_by": "user_123",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
      }
    ],
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "req_123456"
  }
}
```

### 2.2 获取单个 Mock

**接口**：`GET /api/mocks/:id`

**请求参数**：

| 参数 | 类型   | 必填 | 说明    |
| ---- | ------ | ---- | ------- |
| id   | string | 是   | Mock ID |

**请求示例**：

```bash
GET /api/mocks/mock_1234567890_abc123def
```

**响应示例**：

```json
{
  "success": true,
  "data": {
    "id": "mock_1234567890_abc123def",
    "method": "GET",
    "path": "/api/users",
    "status": 200,
    "response": { ... },
    "headers": { ... },
    "delay": 0,
    "enabled": true,
    "dynamic_response": false,
    "description": "用户列表 Mock",
    "tags": ["users", "list"],
    "version": 1,
    "created_by": "user_123",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

### 2.3 创建 Mock

**接口**：`POST /api/mocks`

**请求参数**：

| 参数             | 类型     | 必填 | 说明                                       |
| ---------------- | -------- | ---- | ------------------------------------------ |
| method           | string   | 是   | HTTP 方法（GET, POST, PUT, DELETE, PATCH） |
| path             | string   | 是   | API 路径（支持参数，如 `/users/:id`）      |
| status           | number   | 否   | 响应状态码，默认 200                       |
| response         | object   | 是   | 响应体                                     |
| headers          | object   | 否   | 响应头                                     |
| cookies          | object   | 否   | Cookies                                    |
| query_params     | object   | 否   | 查询参数匹配规则                           |
| request_headers  | object   | 否   | 请求头匹配规则                             |
| request_body     | object   | 否   | 请求体匹配规则                             |
| delay            | number   | 否   | 响应延迟（毫秒），默认 0                   |
| enabled          | boolean  | 否   | 是否启用，默认 true                        |
| dynamic_response | boolean  | 否   | 是否动态响应，默认 false                   |
| description      | string   | 否   | 描述                                       |
| tags             | string[] | 否   | 标签                                       |

**请求示例**：

```bash
POST /api/mocks
Content-Type: application/json

{
  "method": "GET",
  "path": "/api/users",
  "status": 200,
  "response": {
    "users": [
      {
        "id": "1",
        "name": "Alice",
        "email": "alice@example.com"
      }
    ]
  },
  "headers": {
    "Content-Type": "application/json"
  },
  "delay": 0,
  "enabled": true,
  "description": "用户列表 Mock",
  "tags": ["users", "list"]
}
```

**响应示例**：

```json
{
  "success": true,
  "data": {
    "id": "mock_1234567890_abc123def",
    "method": "GET",
    "path": "/api/users",
    "status": 200,
    "response": { ... },
    "headers": { ... },
    "delay": 0,
    "enabled": true,
    "dynamic_response": false,
    "description": "用户列表 Mock",
    "tags": ["users", "list"],
    "version": 1,
    "created_by": "user_123",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

### 2.4 更新 Mock

**接口**：`PUT /api/mocks/:id`

**请求参数**：

| 参数             | 类型     | 必填 | 说明             |
| ---------------- | -------- | ---- | ---------------- |
| id               | string   | 是   | Mock ID          |
| method           | string   | 否   | HTTP 方法        |
| path             | string   | 否   | API 路径         |
| status           | number   | 否   | 响应状态码       |
| response         | object   | 否   | 响应体           |
| headers          | object   | 否   | 响应头           |
| cookies          | object   | 否   | Cookies          |
| query_params     | object   | 否   | 查询参数匹配规则 |
| request_headers  | object   | 否   | 请求头匹配规则   |
| request_body     | object   | 否   | 请求体匹配规则   |
| delay            | number   | 否   | 响应延迟（毫秒） |
| enabled          | boolean  | 否   | 是否启用         |
| dynamic_response | boolean  | 否   | 是否动态响应     |
| description      | string   | 否   | 描述             |
| tags             | string[] | 否   | 标签             |

**请求示例**：

```bash
PUT /api/mocks/mock_1234567890_abc123def
Content-Type: application/json

{
  "enabled": false,
  "description": "更新后的描述"
}
```

**响应示例**：

```json
{
  "success": true,
  "data": {
    "id": "mock_1234567890_abc123def",
    "method": "GET",
    "path": "/api/users",
    "status": 200,
    "response": { ... },
    "headers": { ... },
    "delay": 0,
    "enabled": false,
    "dynamic_response": false,
    "description": "更新后的描述",
    "tags": ["users", "list"],
    "version": 2,
    "created_by": "user_123",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T12:00:00Z"
  }
}
```

### 2.5 删除 Mock

**接口**：`DELETE /api/mocks/:id`

**请求参数**：

| 参数 | 类型   | 必填 | 说明    |
| ---- | ------ | ---- | ------- |
| id   | string | 是   | Mock ID |

**请求示例**：

```bash
DELETE /api/mocks/mock_1234567890_abc123def
```

**响应示例**：

```json
{
  "success": true,
  "data": {
    "deleted": true,
    "id": "mock_1234567890_abc123def"
  }
}
```

### 2.6 批量操作 Mock

**接口**：`POST /api/mocks/batch`

**请求参数**：

| 参数   | 类型     | 必填 | 说明                                |
| ------ | -------- | ---- | ----------------------------------- |
| action | string   | 是   | 操作类型（enable, disable, delete） |
| ids    | string[] | 是   | Mock ID 列表                        |

**请求示例**：

```bash
POST /api/mocks/batch
Content-Type: application/json

{
  "action": "enable",
  "ids": ["mock_1", "mock_2", "mock_3"]
}
```

**响应示例**：

```json
{
  "success": true,
  "data": {
    "successCount": 3,
    "failedCount": 0,
    "failedIds": []
  }
}
```

---

## 三、请求日志 API

### 3.1 获取请求日志

**接口**：`GET /api/requests`

**请求参数**：

| 参数       | 类型    | 必填 | 说明                 |
| ---------- | ------- | ---- | -------------------- |
| page       | number  | 否   | 页码，默认 1         |
| pageSize   | number  | 否   | 每页数量，默认 50    |
| method     | string  | 否   | HTTP 方法过滤        |
| path       | string  | 否   | 路径过滤             |
| is_mocked  | boolean | 否   | 是否 Mock 过滤       |
| mock_id    | string  | 否   | Mock ID 过滤         |
| start_date | string  | 否   | 开始日期（ISO 8601） |
| end_date   | string  | 否   | 结束日期（ISO 8601） |

**请求示例**：

```bash
GET /api/requests?page=1&pageSize=50&is_mocked=true&start_date=2024-01-01T00:00:00Z
```

**响应示例**：

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "req_1234567890_abc123def",
        "method": "GET",
        "url": "http://localhost:4000/api/users",
        "path": "/api/users",
        "query": {
          "page": "1",
          "limit": "10"
        },
        "headers": {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0..."
        },
        "body": null,
        "response_status": 200,
        "response_body": { ... },
        "response_time": 150,
        "is_mocked": true,
        "mock_id": "mock_1234567890_abc123def",
        "ip_address": "127.0.0.1",
        "user_agent": "Mozilla/5.0...",
        "timestamp": "2024-01-01T00:00:00Z"
      }
    ],
    "total": 1000,
    "page": 1,
    "pageSize": 50,
    "totalPages": 20
  }
}
```

### 3.2 获取请求统计

**接口**：`GET /api/requests/stats`

**请求参数**：

| 参数       | 类型   | 必填 | 说明                 |
| ---------- | ------ | ---- | -------------------- |
| start_date | string | 否   | 开始日期（ISO 8601） |
| end_date   | string | 否   | 结束日期（ISO 8601） |

**请求示例**：

```bash
GET /api/requests/stats?start_date=2024-01-01T00:00:00Z&end_date=2024-01-31T23:59:59Z
```

**响应示例**：

```json
{
  "success": true,
  "data": {
    "totalRequests": 1000,
    "mockRequests": 800,
    "realRequests": 200,
    "mockHitRate": 80,
    "avgResponseTime": 150,
    "requestsByMethod": {
      "GET": 600,
      "POST": 300,
      "PUT": 50,
      "DELETE": 50
    },
    "requestsByStatus": {
      "200": 850,
      "404": 100,
      "500": 50
    },
    "topEndpoints": [
      {
        "method": "GET",
        "path": "/api/users",
        "count": 400
      },
      {
        "method": "POST",
        "path": "/api/users",
        "count": 200
      }
    ]
  }
}
```

### 3.3 删除请求日志

**接口**：`DELETE /api/requests`

**请求参数**：

| 参数 | 类型   | 必填 | 说明                       |
| ---- | ------ | ---- | -------------------------- |
| days | number | 否   | 删除 N 天前的日志，默认 30 |

**请求示例**：

```bash
DELETE /api/requests?days=30
```

**响应示例**：

```json
{
  "success": true,
  "data": {
    "deletedCount": 1000
  }
}
```

---

## 四、Claude AI API

### 4.1 生成 Mock

**接口**：`POST /api/claude/generate-mock`

**请求参数**：

| 参数        | 类型   | 必填 | 说明       |
| ----------- | ------ | ---- | ---------- |
| method      | string | 是   | HTTP 方法  |
| path        | string | 是   | API 路径   |
| description | string | 否   | 描述       |
| context     | object | 否   | 上下文信息 |

**请求示例**：

```bash
POST /api/claude/generate-mock
Content-Type: application/json

{
  "method": "GET",
  "path": "/api/users",
  "description": "获取用户列表",
  "context": {
    "existingMocks": [...],
    "projectInfo": {
      "name": "My App",
      "version": "1.0.0"
    }
  }
}
```

**响应示例**：

```json
{
  "success": true,
  "data": {
    "method": "GET",
    "path": "/api/users",
    "status": 200,
    "response": {
      "users": [
        {
          "id": "1",
          "name": "Alice",
          "email": "alice@example.com",
          "created_at": "2024-01-01T00:00:00Z"
        },
        {
          "id": "2",
          "name": "Bob",
          "email": "bob@example.com",
          "created_at": "2024-01-02T00:00:00Z"
        }
      ],
      "total": 2,
      "page": 1,
      "pageSize": 10
    },
    "headers": {
      "Content-Type": "application/json"
    },
    "description": "成功获取用户列表",
    "tags": ["users", "list"]
  }
}
```

### 4.2 聊天

**接口**：`POST /api/claude/chat`

**请求参数**：

| 参数      | 类型   | 必填 | 说明       |
| --------- | ------ | ---- | ---------- |
| message   | string | 是   | 用户消息   |
| context   | object | 否   | 上下文信息 |
| sessionId | string | 否   | 会话 ID    |

**请求示例**：

```bash
POST /api/claude/chat
Content-Type: application/json

{
  "message": "请生成一个用户列表的 Mock 数据",
  "context": {
    "currentRequest": {
      "method": "GET",
      "path": "/api/users"
    },
    "existingMocks": [...]
  },
  "sessionId": "session_123"
}
```

**响应示例**：

````json
{
  "success": true,
  "data": {
    "message": "好的，我为你生成了一个用户列表的 Mock 数据：\n\n```json\n{\n  \"users\": [\n    {\n      \"id\": \"1\",\n      \"name\": \"Alice\",\n      \"email\": \"alice@example.com\"\n    }\n  ]\n}\n```",
    "sessionId": "session_123"
  }
}
````

### 4.3 生成文档

**接口**：`POST /api/claude/generate-docs`

**请求参数**：

| 参数   | 类型     | 必填 | 说明                                      |
| ------ | -------- | ---- | ----------------------------------------- |
| mocks  | object[] | 是   | Mock 数据                                 |
| format | string   | 否   | 文档格式（markdown, html），默认 markdown |

**请求示例**：

```bash
POST /api/claude/generate-docs
Content-Type: application/json

{
  "mocks": [
    {
      "method": "GET",
      "path": "/api/users",
      "status": 200,
      "response": { ... }
    }
  ],
  "format": "markdown"
}
```

**响应示例**：

````json
{
  "success": true,
  "data": {
    "documentation": "# API Documentation\n\n## Get Users\n\n**Method**: GET\n**Path**: /api/users\n\n### Request\n\n### Response\n\n```json\n{ ... }\n```\n",
    "format": "markdown"
  }
}
````

---

## 五、系统 API

### 5.1 健康检查

**接口**：`GET /api/health`

**响应示例**：

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "timestamp": "2024-01-01T00:00:00Z",
    "checks": {
      "database": "healthy",
      "cache": "healthy",
      "claude": "healthy"
    }
  }
}
```

### 5.2 系统信息

**接口**：`GET /api/system/info`

**响应示例**：

```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "environment": "production",
    "uptime": 86400,
    "memory": {
      "used": 512,
      "total": 1024,
      "percentage": 50
    },
    "cpu": {
      "usage": 25.5
    }
  }
}
```

### 5.3 配置信息

**接口**：`GET /api/system/config`

**响应示例**：

```json
{
  "success": true,
  "data": {
    "proxy": {
      "enabled": true,
      "backendUrl": "https://api.example.com"
    },
    "features": {
      "autoProxy": true,
      "logRequests": true,
      "autoGenerateMock": false
    }
  }
}
```

---

## 六、WebSocket API

### 6.1 连接

**连接地址**：`ws://localhost:4001/ws`

**客户端连接**：

```javascript
const ws = new WebSocket('ws://localhost:4001/ws')

ws.onopen = () => {
  console.log('WebSocket connected')
}

ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  console.log('Received:', message)
}

ws.onerror = (error) => {
  console.error('WebSocket error:', error)
}

ws.onclose = () => {
  console.log('WebSocket closed')
}
```

### 6.2 消息类型

#### 6.2.1 服务器发送的消息

```typescript
// 初始化消息
{
  type: 'INIT',
  data: {
    mocks: Mock[],
    recentRequests: RequestLog[]
  }
}

// 新请求消息
{
  type: 'REQUEST',
  data: RequestLog
}

// Mock 更新消息
{
  type: 'MOCK_UPDATED',
  data: Mock
}

// Mock 删除消息
{
  type: 'MOCK_DELETED',
  data: { id: string }
}

// Mock 批量更新消息
{
  type: 'MOCKS_BATCH_UPDATED',
  data: { ids: string[] }
}

// 错误消息
{
  type: 'ERROR',
  data: {
    code: string,
    message: string
  }
}
```

#### 6.2.2 客户端发送的消息

```typescript
// 生成 Mock
{
  type: 'GENERATE_MOCK',
  data: {
    method: string,
    path: string,
    description: string
  }
}

// 更新 Mock
{
  type: 'UPDATE_MOCK',
  data: {
    id: string,
    updates: Partial<Mock>
  }
}

// 删除 Mock
{
  type: 'DELETE_MOCK',
  data: {
    id: string
  }
}

// 订阅事件
{
  type: 'SUBSCRIBE',
  data: {
    events: string[] // ['requests', 'mocks', 'stats']
  }
}

// 取消订阅
{
  type: 'UNSUBSCRIBE',
  data: {
    events: string[]
  }
}
```

---

## 七、错误码

### 7.1 错误码列表

| 错误码              | 说明            | HTTP 状态码 |
| ------------------- | --------------- | ----------- |
| INVALID_REQUEST     | 请求参数无效    | 400         |
| UNAUTHORIZED        | 未授权          | 401         |
| FORBIDDEN           | 禁止访问        | 403         |
| NOT_FOUND           | 资源不存在      | 404         |
| CONFLICT            | 资源冲突        | 409         |
| VALIDATION_ERROR    | 验证失败        | 422         |
| RATE_LIMIT_EXCEEDED | 请求过于频繁    | 429         |
| INTERNAL_ERROR      | 服务器内部错误  | 500         |
| DATABASE_ERROR      | 数据库错误      | 500         |
| CLAUDE_API_ERROR    | Claude API 错误 | 500         |

### 7.2 错误响应示例

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "path",
      "message": "Path is required"
    }
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "req_123456"
  }
}
```

---

## 八、SDK 使用示例

### 8.1 JavaScript SDK

```javascript
import { MockClient } from '@smart-mock/sdk'

const client = new MockClient({
  baseURL: 'http://localhost:4000',
  apiKey: 'your-api-key',
})

// 获取 Mock 列表
const mocks = await client.mocks.list({
  page: 1,
  pageSize: 20,
})

// 创建 Mock
const mock = await client.mocks.create({
  method: 'GET',
  path: '/api/users',
  response: { users: [] },
})

// 更新 Mock
await client.mocks.update(mock.id, {
  enabled: false,
})

// 删除 Mock
await client.mocks.delete(mock.id)

// 使用 Claude 生成 Mock
const generatedMock = await client.claude.generateMock({
  method: 'GET',
  path: '/api/users',
})
```

### 8.2 Python SDK

```python
from smart_mock import MockClient

client = MockClient(
    base_url='http://localhost:4000',
    api_key='your-api-key'
)

# 获取 Mock 列表
mocks = client.mocks.list(page=1, page_size=20)

# 创建 Mock
mock = client.mocks.create(
    method='GET',
    path='/api/users',
    response={'users': []}
)

# 更新 Mock
client.mocks.update(mock.id, enabled=False)

# 删除 Mock
client.mocks.delete(mock.id)

# 使用 Claude 生成 Mock
generated_mock = client.claude.generate_mock(
    method='GET',
    path='/api/users'
)
```

---

## 九、总结

API 接口文档提供了：

✅ **完整的 API 文档**：涵盖所有功能接口
✅ **详细的参数说明**：每个参数都有详细说明
✅ **丰富的示例**：提供完整的请求和响应示例
✅ **WebSocket 支持**：实时通信接口
✅ **SDK 集成**：多语言 SDK 使用示例
✅ **错误处理**：完整的错误码和错误响应

核心接口：

- **Mock 管理**：CRUD 操作和批量操作
- **请求日志**：查询和统计
- **Claude AI**：自动生成和聊天
- **系统接口**：健康检查和配置
- **WebSocket**：实时事件推送

关键优势：

- **RESTful 设计**：遵循 RESTful 规范
- **版本控制**：支持 API 版本
- **认证授权**：JWT Token 认证
- **速率限制**：防止 API 滥用
- **完整文档**：易于集成和使用
