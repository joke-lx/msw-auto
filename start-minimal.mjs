#!/usr/bin/env node

import { MockServer } from './dist/server/index.js'

console.log('Starting MSW Auto Mock Server (minimal config)...')

// 使用内存数据库，避免文件系统问题
const server = new MockServer({
  port: 3001,
  webPort: 3000,
  dbPath: ':memory:'
})

server.start()
  .then(() => {
    console.log('✅ Server started successfully!')
    console.log('📍 Mock Server: http://localhost:3001')
    console.log('📍 Health Check: http://localhost:3001/health')
    console.log('📍 API Docs: http://localhost:3001/api/mocks')
  })
  .catch(error => {
    console.error('❌ Failed to start server:', error)
    console.error('Stack:', error.stack)
    process.exit(1)
  })

process.on('SIGINT', () => {
  console.log('\n���� Shutting down...')
  server.stop()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down...')
  server.stop()
  process.exit(0)
})
