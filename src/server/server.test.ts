/**
 * Mock 服务器 API 测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { MockServer } from './index.js'

describe('Mock Server API', () => {
  let server: MockServer
  const port = 3002 // 使用不同端口避免冲突

  beforeAll(async () => {
    server = new MockServer({
      port,
      webPort: 3003,
      dbPath: ':memory:', // 使用内存数据库
    })
    await server.start()
  })

  afterAll(async () => {
    await server.stop()
  })

  it('should respond to health check', async () => {
    const response = await fetch(`http://localhost:${port}/health`)
    expect(response.ok).toBe(true)

    const data = await response.json()
    expect(data).toHaveProperty('status')
  })

  it('should list mocks', async () => {
    const response = await fetch(`http://localhost:${port}/api/mocks`)
    expect(response.ok).toBe(true)

    const data = await response.json()
    expect(Array.isArray(data)).toBe(true)
  })

  it('should handle CORS', async () => {
    const response = await fetch(`http://localhost:${port}/api/mocks`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
      }
    })

    expect(response.headers.get('access-control-allow-origin')).toBeTruthy()
  })
})
