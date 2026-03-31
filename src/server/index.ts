import express from 'express'
import cors from 'cors'
import { createServer, Server as HttpServer } from 'http'
import { WebSocketServer } from 'ws'
import { MockManager } from './mock/manager.js'
import { ContractManager } from './contract/manager.js'
import { Database } from './storage/database.js'
import { setupInternalRoutes, setupInterceptionRoutes, setWebSocketServer } from './routes/index.js'
import { setupWebSocket } from './websocket/index.js'
import { ClaudeClient, getClaudeClient } from './llm/claude-client.js'
import pc from 'picocolors'
import fs from 'fs'

export interface ServerConfig {
  port: number        // Interception port (3001) - handles mock/proxy requests
  uiPort: number      // Web UI API port (3002) - handles internal API calls
  webPort: number
  backendUrl?: string
  dbPath?: string
  claudeApiKey?: string
  // LLM config
  provider?: string
  baseUrl?: string
  model?: string
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
    port: parseInt(process.env.PORT || envConfig.port || '3001'),        // Interception port
    uiPort: parseInt(process.env.UI_PORT || envConfig.uiPort || '3002'), // Web UI API port
    webPort: parseInt(process.env.WEB_PORT || envConfig.webPort || '4000'),
    backendUrl: process.env.BACKEND_URL || envConfig.backendUrl,
    dbPath: process.env.DB_PATH || envConfig.dbPath || './data/mocks.db',
    claudeApiKey: process.env.ANTHROPIC_API_KEY || envConfig.apiKey || envConfig.claudeApiKey,
    provider: envConfig.provider || 'anthropic',
    baseUrl: envConfig.baseUrl,
    model: envConfig.model,
  }
}

export class MockServer {
  private app: express.Application           // For internal UI API
  private interceptionApp: express.Application  // For interception/proxy
  private server: HttpServer                 // Internal UI API server
  private interceptionServer: HttpServer      // Interception/proxy server
  private wss: WebSocketServer               // WebSocket server for UI
  private mockManager: MockManager
  private contractManager: ContractManager
  private database: Database
  private claudeClient: ClaudeClient
  private config: ServerConfig

  constructor(config: Partial<ServerConfig> = {}) {
    const loadedConfig = loadConfig()
    this.config = {
      ...loadedConfig,
      ...config,
    }

    // Create two Express apps and servers
    this.app = express()
    this.interceptionApp = express()
    this.server = createServer(this.app)
    this.interceptionServer = createServer(this.interceptionApp)

    // WebSocket server on the UI port
    this.wss = new WebSocketServer({ server: this.server, path: '/ws' })

    this.database = new Database(this.config.dbPath!)
    this.mockManager = new MockManager(this.database)
    this.contractManager = new ContractManager(this.database)
    this.claudeClient = getClaudeClient({
      apiKey: this.config.claudeApiKey,
      baseURL: this.config.baseUrl,
      model: this.config.model,
    })

    this.setupMiddleware()
    this.setupRoutes()
    this.setupWebSocket()
  }

  private setupMiddleware() {
    // CORS for both apps
    this.app.use(cors())
    this.app.use(express.json({ limit: '10mb' }))
    this.app.use(express.urlencoded({ extended: true }))

    this.interceptionApp.use(cors())
    this.interceptionApp.use(express.json({ limit: '10mb' }))
    this.interceptionApp.use(express.urlencoded({ extended: true }))

    // Request logging middleware for UI server
    this.app.use((req, res, next) => {
      const start = Date.now()
      res.on('finish', () => {
        const duration = Date.now() - start
        console.log(
          `${pc.gray(new Date().toISOString())} ${pc.blue(req.method)} ${pc.dim('[UI]')} ${req.path} ${pc.yellow(res.statusCode.toString())} ${pc.gray(duration + 'ms')}`
        )
      })
      next()
    })

    // Request logging middleware for interception server
    this.interceptionApp.use((req, res, next) => {
      const start = Date.now()
      res.on('finish', () => {
        const duration = Date.now() - start
        console.log(
          `${pc.gray(new Date().toISOString())} ${pc.blue(req.method)} ${pc.cyan('[Int]')} ${req.path} ${pc.yellow(res.statusCode.toString())} ${pc.gray(duration + 'ms')}`
        )
      })
      next()
    })
  }

  private setupRoutes() {
    // Internal UI API routes on port 3002
    setupInternalRoutes(this.app, this.mockManager, this.database, this.config, this.claudeClient, this.contractManager)
    // Interception routes on port 3001
    setupInterceptionRoutes(this.interceptionApp, this.mockManager, this.database, this.config)
  }

  private setupWebSocket() {
    setupWebSocket(this.wss, this.mockManager, this.database)
    // Pass WSS to routes for broadcasting
    setWebSocketServer(this.wss)
  }

  async start() {
    try {
      // Initialize database
      await this.database.connect()
      console.log(pc.green('[Database] Connected'))

      // Initialize Claude AI
      await this.claudeClient.initialize()

      // Start both servers
      await Promise.all([
        new Promise<void>((resolve) => {
          this.server.listen(this.config.uiPort, () => {
            resolve()
          })
        }),
        new Promise<void>((resolve) => {
          this.interceptionServer.listen(this.config.port, () => {
            resolve()
          })
        })
      ])

      console.log(`
${pc.cyan('╔═══════════════════════════════════════════════════════════╗')}
${pc.cyan('║')}     ${pc.bold(pc.blue('MSW Auto Server'))}                          ${pc.cyan('║')}
${pc.cyan('╚═══════════════════════════════════════════════════════════╝')}
${pc.dim('━'.repeat(62))}

${pc.green('[Interception] Mock interception on')} ${pc.bold(`http://localhost:${this.config.port}`)}
${pc.green('[UI API]')} Web UI API on ${pc.bold(`http://localhost:${this.config.uiPort}`)}
${pc.green('[WebUI]')} Web UI available at ${pc.bold(`http://localhost:${this.config.webPort}`)}
${pc.cyan('[WebSocket]')} WS available at ${pc.bold(`ws://localhost:${this.config.uiPort}/ws`)}

${pc.yellow('Press Ctrl+C to stop the server')}
`)
    } catch (error) {
      console.error(pc.red('[Error] Failed to start server:'), error)
      process.exit(1)
    }
  }

  stop() {
    this.server.close()
    this.interceptionServer.close()
    this.database.close()
    console.log(pc.yellow('[Server] Stopped'))
  }
}

// Run if called directly - support multiple ways to run
const isMain = import.meta.url.includes('index.js') ||
               import.meta.url.includes('index.ts') ||
               process.argv[1]?.includes('server')

if (isMain) {
  const server = new MockServer()

  server.start()

  process.on('SIGINT', () => {
    server.stop()
    process.exit(0)
  })
}
