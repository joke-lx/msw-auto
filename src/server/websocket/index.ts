import { WebSocketServer, WebSocket } from 'ws'
import crypto from 'crypto'
import type { MockManager } from '../mock/manager.js'
import type { Database } from '../storage/database.js'
import pc from 'picocolors'

interface WSClient {
  id: string
  ws: WebSocket
  subscribedMocks?: string[]
}

export function setupWebSocket(
  wss: WebSocketServer,
  mockManager: MockManager,
  database: Database
) {
  const clients: Map<string, WSClient> = new Map()

  wss.on('connection', (ws: WebSocket) => {
    const clientId = `client_${crypto.randomUUID()}`

    const client: WSClient = {
      id: clientId,
      ws,
    }

    clients.set(clientId, client)

    console.log(pc.green(`[WebSocket] Client connected: ${clientId}`))

    // Send welcome message
    ws.send(
      JSON.stringify({
        type: 'CONNECTED',
        data: {
          clientId,
          message: 'Connected to MSW Auto server',
        },
      })
    )

    // Send current stats
    updateStats()

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString())
        handleMessage(client, message)
      } catch (error) {
        console.error(pc.red('[WebSocket] Failed to parse message:'), error)
        ws.send(
          JSON.stringify({
            type: 'ERROR',
            data: { message: 'Invalid message format' },
          })
        )
      }
    })

    ws.on('close', () => {
      clients.delete(clientId)
      console.log(pc.yellow(`[WebSocket] Client disconnected: ${clientId}`))
    })

    ws.on('error', (error) => {
      console.error(pc.red(`[WebSocket] Error for client ${clientId}:`), error)
      clients.delete(clientId)
    })

    function handleMessage(client: WSClient, message: any) {
      switch (message.type) {
        case 'SUBSCRIBE':
          client.subscribedMocks = message.mocks || []
          ws.send(
            JSON.stringify({
              type: 'SUBSCRIBED',
              data: { mocks: client.subscribedMocks },
            })
          )
          break

        case 'PING':
          ws.send(JSON.stringify({ type: 'PONG', data: { timestamp: Date.now() } }))
          break

        case 'GET_STATS':
          updateStats()
          break

        default:
          ws.send(
            JSON.stringify({
              type: 'ERROR',
              data: { message: `Unknown message type: ${message.type}` },
            })
          )
      }
    }

    async function updateStats() {
      try {
        const mocks = await mockManager.findAll()
        const requests = await database.getRecentRequests(10)

        const stats = {
          totalMocks: mocks.length,
          activeMocks: mocks.filter((m) => m.enabled).length,
          recentRequests: requests.length,
        }

        broadcast(
          {
            type: 'STATS',
            data: stats,
          },
          client.id
        )
      } catch (error) {
        console.error(pc.red('[WebSocket] Failed to get stats:'), error)
      }
    }
  })

  function broadcast(message: any, excludeClientId?: string) {
    const data = JSON.stringify(message)
    clients.forEach((client) => {
      if (client.id !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data)
      }
    })
  }

  // Periodic stats update
  setInterval(async () => {
    try {
      const mocks = await mockManager.findAll()
      const requests = await database.getRecentRequests(10)

      broadcast({
        type: 'STATS',
        data: {
          totalMocks: mocks.length,
          activeMocks: mocks.filter((m) => m.enabled).length,
          recentRequests: requests.length,
        },
      })
    } catch (error) {
      // Silent fail for periodic updates
    }
  }, 30000) // Every 30 seconds
}
