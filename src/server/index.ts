import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { MockManager } from './mock/manager.js'
import { Database } from './storage/database.js'
import { setupRoutes } from './routes/index.js'
import { setupWebSocket } from './websocket/index.js'
import { ClaudeClient, getClaudeClient } from './llm/claude-client.js'
import pc from 'picocolors'
import fs from 'fs'

export interface ServerConfig {
  port: number
  webPort: number
  backendUrl?: string
  dbPath?: string
  claudeApiKey?: string
}

function loadConfig(): ServerConfig {
  const configPath = './data/config.json'
  let envConfig: any = {}

  // Try to load from config file
  if (fs.existsSync(configPath)) {
    try {
      envConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    } catch (e) {
      // Ignore
    }
  }

  return {
    port: parseInt(process.env.PORT || envConfig.port || '3001'),
    webPort: parseInt(process.env.WEB_PORT || envConfig.webPort || '3000'),
    backendUrl: process.env.BACKEND_URL || envConfig.backendUrl,
    dbPath: process.env.DB_PATH || envConfig.dbPath || './data/mocks.db',
    claudeApiKey: process.env.ANTHROPIC_API_KEY || envConfig.claudeApiKey,
  }
}

export class MockServer {
  private app: express.Application
  private server: ReturnType<typeof createServer>
  private wss: WebSocketServer
  private mockManager: MockManager
  private database: Database
  private claudeClient: ClaudeClient
  private config: ServerConfig

  constructor(config: Partial<ServerConfig> = {}) {
    const loadedConfig = loadConfig()
    this.config = {
      ...loadedConfig,
      ...config,
    }

    this.app = express()
    this.server = createServer(this.app)
    this.wss = new WebSocketServer({ server: this.server, path: '/ws' })
    this.database = new Database(this.config.dbPath!)
    this.mockManager = new MockManager(this.database)
    this.claudeClient = getClaudeClient({
      apiKey: this.config.claudeApiKey,
    })

    this.setupMiddleware()
    this.setupRoutes()
    this.setupWebSocket()
  }

  private setupMiddleware() {
    this.app.use(cors())
    this.app.use(express.json({ limit: '10mb' }))
    this.app.use(express.urlencoded({ extended: true }))

    // Request logging middleware
    this.app.use((req, res, next) => {
      const start = Date.now()
      res.on('finish', () => {
        const duration = Date.now() - start
        console.log(
          `${pc.gray(new Date().toISOString())} ${pc.blue(req.method)} ${req.path} ${pc.yellow(res.statusCode.toString())} ${pc.gray(duration + 'ms')}`
        )

        // Broadcast to WebSocket clients
        this.broadcast({
          type: 'REQUEST',
          data: {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration,
            timestamp: new Date().toISOString(),
          },
        })
      })
      next()
    })
  }

  private setupRoutes() {
    setupRoutes(this.app, this.mockManager, this.database, this.config, this.claudeClient)
  }

  private setupWebSocket() {
    setupWebSocket(this.wss, this.mockManager, this.database)
  }

  private broadcast(data: any) {
    const message = JSON.stringify(data)
    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        // WebSocket.OPEN
        client.send(message)
      }
    })
  }

  async start() {
    try {
      // Initialize database
      await this.database.connect()
      console.log(pc.green('[Database] Connected'))

      // Initialize Claude AI
      await this.claudeClient.initialize()

      // Start server
      return new Promise<void>((resolve) => {
        this.server.listen(this.config.port, () => {
          console.log(`
${pc.cyan('╔═══════════════════════════════════════════════════════════╗')}
${pc.cyan('║')}     ${pc.bold(pc.blue('MSW Auto Server'))}                          ${pc.cyan('║')}
${pc.cyan('╚═══════════════════════════════════════════════════════════╝')}
${pc.dim('━'.repeat(62))}

${pc.green('[Server]')} Mock server running on ${pc.bold(`http://localhost:${this.config.port}`)}
${pc.green('[WebUI]')} Web UI available at ${pc.bold(`http://localhost:${this.config.webPort}`)}
${pc.cyan('[WebSocket]')} WS available at ${pc.bold(`ws://localhost:${this.config.port}/ws`)}

${pc.yellow('Press Ctrl+C to stop the server')}
`)
          resolve()
        })
      })
    } catch (error) {
      console.error(pc.red('[Error] Failed to start server:'), error)
      process.exit(1)
    }
  }

  stop() {
    this.server.close()
    this.database.close()
    console.log(pc.yellow('[Server] Stopped'))
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new MockServer()

  server.start()

  process.on('SIGINT', () => {
    server.stop()
    process.exit(0)
  })
}
