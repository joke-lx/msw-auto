#!/usr/bin/env node

import { MockServer } from './dist/server/index.js'

console.log('Starting MSW Auto Mock Server...')

const server = new MockServer()

server.start().catch(error => {
  console.error('Failed to start server:', error)
  process.exit(1)
})

process.on('SIGINT', () => {
  console.log('\nShutting down...')
  server.stop()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\nShutting down...')
  server.stop()
  process.exit(0)
})
