import express from 'express'
import crypto from 'crypto'
import http from 'http'
import type { MockManager } from '../mock/manager.js'
import type { Database } from '../storage/database.js'
import type { ClaudeClient } from '../llm/claude-client.js'
import { VersionManager } from '../mock/version-manager.js'
import { ImportExporter } from '../import-export/importer.js'
import pc from 'picocolors'

export interface ServerConfig {
  port: number
  webPort: number
  backendUrl?: string
  dbPath?: string
  claudeApiKey?: string
}

export function setupRoutes(
  app: express.Application,
  mockManager: MockManager,
  database: Database,
  config: ServerConfig,
  claudeClient: ClaudeClient
) {
  const versionManager = new VersionManager(database)
  const importer = new ImportExporter()

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      globalEnabled: mockManager.isGlobalEnabled(),
    })
  })

  // ============ Global Toggle API ============
  app.get('/api/global-toggle', (req, res) => {
    res.json({ enabled: mockManager.isGlobalEnabled() })
  })

  app.post('/api/global-toggle', (req, res) => {
    const { enabled } = req.body
    if (typeof enabled === 'boolean') {
      mockManager.setGlobalEnabled(enabled)
      res.json({ enabled: mockManager.isGlobalEnabled() })
    } else {
      // Toggle if no enabled param
      const newState = mockManager.toggleGlobal()
      res.json({ enabled: newState })
    }
  })

  // ============ Mock CRUD API ============
  app.get('/api/mocks', async (req, res) => {
    try {
      const mocks = await mockManager.findAll()
      res.json(mocks)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  app.get('/api/mocks/:id', async (req, res) => {
    try {
      const mock = await mockManager.findById(req.params.id)
      if (!mock) {
        return res.status(404).json({ error: 'Mock not found' })
      }
      res.json(mock)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  app.post('/api/mocks', async (req, res) => {
    try {
      const mock = await mockManager.create(req.body)
      res.status(201).json(mock)
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  })

  app.put('/api/mocks/:id', async (req, res) => {
    try {
      const mock = await mockManager.update(req.params.id, req.body)
      if (!mock) {
        return res.status(404).json({ error: 'Mock not found' })
      }
      res.json(mock)
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  })

  app.delete('/api/mocks/:id', async (req, res) => {
    try {
      const deleted = await mockManager.delete(req.params.id)
      if (!deleted) {
        return res.status(404).json({ error: 'Mock not found' })
      }
      res.json({ success: true })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  app.post('/api/mocks/:id/toggle', async (req, res) => {
    try {
      const mock = await mockManager.toggle(req.params.id)
      if (!mock) {
        return res.status(404).json({ error: 'Mock not found' })
      }
      res.json(mock)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  app.post('/api/mocks/:id/duplicate', async (req, res) => {
    try {
      const mock = await mockManager.duplicate(req.params.id)
      if (!mock) {
        return res.status(404).json({ error: 'Mock not found' })
      }
      res.status(201).json(mock)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // ============ AI Generation API ============

  // Generate mock using AI
  app.post('/api/ai/generate', async (req, res) => {
    try {
      const { method, path, description, context } = req.body

      if (!method || !path) {
        return res.status(400).json({ error: 'method and path are required' })
      }

      const generated = await claudeClient.generateMock({
        method,
        path,
        description,
        context,
      })

      // Save the generated mock
      const mock = await mockManager.create(generated)

      res.status(201).json(mock)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // Improve existing mock using AI
  app.post('/api/ai/improve/:id', async (req, res) => {
    try {
      const { instruction } = req.body

      if (!instruction) {
        return res.status(400).json({ error: 'instruction is required' })
      }

      const existingMock = await mockManager.findById(req.params.id)
      if (!existingMock) {
        return res.status(404).json({ error: 'Mock not found' })
      }

      const improved = await claudeClient.improveMock(existingMock, instruction)

      // Update the mock with improvements
      const updated = await mockManager.update(req.params.id, improved)

      res.json(updated)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // Generate documentation using AI
  app.post('/api/ai/docs/:id', async (req, res) => {
    try {
      const mock = await mockManager.findById(req.params.id)
      if (!mock) {
        return res.status(404).json({ error: 'Mock not found' })
      }

      const documentation = await claudeClient.generateDocumentation(mock)

      res.json({ documentation })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // Chat with AI assistant
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { messages, context } = req.body

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'messages array is required' })
      }

      const reply = await claudeClient.chat(messages, context)

      res.json({ reply })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // Check AI status
  app.get('/api/ai/status', (req, res) => {
    res.json({
      enabled: claudeClient.isEnabled(),
      provider: 'Anthropic Claude',
    })
  })

  // ============ Version Management API ============

  // Get mock versions
  app.get('/api/mocks/:id/versions', async (req, res) => {
    try {
      const versions = await versionManager.getVersions(req.params.id)
      res.json(versions)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // Get specific version
  app.get('/api/mocks/:id/versions/:version', async (req, res) => {
    try {
      const version = await versionManager.getVersion(req.params.id, parseInt(req.params.version))
      if (!version) {
        return res.status(404).json({ error: 'Version not found' })
      }
      res.json(version)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // Create new version (snapshot)
  app.post('/api/mocks/:id/versions', async (req, res) => {
    try {
      const mock = await mockManager.findById(req.params.id)
      if (!mock) {
        return res.status(404).json({ error: 'Mock not found' })
      }

      const version = await versionManager.createVersion(
        mock.id,
        mock.response,
        mock.headers,
        req.body.description
      )

      res.status(201).json(version)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // Rollback to version
  app.post('/api/mocks/:id/versions/:version/rollback', async (req, res) => {
    try {
      const version = await versionManager.rollback(
        req.params.id,
        parseInt(req.params.version)
      )

      if (!version) {
        return res.status(404).json({ error: 'Version not found' })
      }

      // Update the mock with the version
      const mock = await mockManager.update(req.params.id, {
        response: version.response,
        headers: version.headers,
      })

      res.json(mock)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // Compare versions
  app.get('/api/mocks/:id/versions/compare', async (req, res) => {
    try {
      const v1 = parseInt(req.query.v1 as string)
      const v2 = parseInt(req.query.v2 as string)

      if (!v1 || !v2) {
        return res.status(400).json({ error: 'v1 and v2 query params required' })
      }

      const comparison = await versionManager.compareVersions(req.params.id, v1, v2)
      res.json(comparison)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // ============ Import/Export API ============

  // Import from OpenAPI/Swagger
  app.post('/api/import/openapi', async (req, res) => {
    try {
      const spec = req.body
      const mocks = await importer.fromOpenAPI(spec)

      // Save all mocks
      const created = []
      for (const mockData of mocks) {
        const mock = await mockManager.create(mockData)
        created.push(mock)
      }

      res.status(201).json({
        imported: created.length,
        mocks: created,
      })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  })

  // Import from Postman
  app.post('/api/import/postman', async (req, res) => {
    try {
      const collection = req.body
      const mocks = await importer.fromPostman(collection)

      // Save all mocks
      const created = []
      for (const mockData of mocks) {
        const mock = await mockManager.create(mockData)
        created.push(mock)
      }

      res.status(201).json({
        imported: created.length,
        mocks: created,
      })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  })

  // Export to OpenAPI
  app.get('/api/export/openapi', async (req, res) => {
    try {
      const mocks = await mockManager.findAll()
      const spec = importer.toOpenAPI(mocks)
      res.json(spec)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // Export to Postman
  app.get('/api/export/postman', async (req, res) => {
    try {
      const mocks = await mockManager.findAll()
      const collection = importer.toPostman(mocks)
      res.json(collection)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // Export to JSON
  app.get('/api/export/json', async (req, res) => {
    try {
      const mocks = await mockManager.findAll()
      const json = importer.toJSON(mocks)
      res.header('Content-Type', 'application/json')
      res.header('Content-Disposition', 'attachment; filename="mocks.json"')
      res.send(json)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // ============ Request Logs ============
  app.get('/api/requests', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100
      const requests = await database.getRecentRequests(limit)
      res.json(requests)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // ============ Stats ============
  app.get('/api/stats', async (req, res) => {
    try {
      const mocks = await mockManager.findAll()
      const enabledMocks = mocks.filter((m) => m.enabled).length

      res.json({
        totalMocks: mocks.length,
        activeMocks: enabledMocks,
        disabledMocks: mocks.length - enabledMocks,
        aiEnabled: claudeClient.isEnabled(),
        globalEnabled: mockManager.isGlobalEnabled(),
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // ============ Catch-all: Mock Handler ============
  app.all('*', async (req, res) => {
    const startTime = Date.now()

    // Find matching mock
    const mock = mockManager.findMatchingMock(req.method, req.path)

    if (mock) {
      // Apply delay if configured
      if (mock.delay && mock.delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, mock.delay))
      }

      // Set headers
      if (mock.headers) {
        Object.entries(mock.headers).forEach(([key, value]) => {
          res.setHeader(key, value)
        })
      }

      // Set cookies
      if (mock.cookies) {
        Object.entries(mock.cookies).forEach(([key, value]) => {
          res.cookie(key, value)
        })
      }

      // Log the request
      const duration = Date.now() - startTime
      await database.saveRequestLog({
        id: `req_${crypto.randomUUID()}`,
        method: req.method,
        path: req.path,
        query: req.query,
        headers: req.headers,
        body: req.body,
        response_status: mock.status,
        response_body: mock.response,
        response_time: duration,
        is_mocked: true,
        mock_id: mock.id,
        timestamp: new Date().toISOString(),
      })

      console.log(
        `${pc.gray(new Date().toISOString())} ${pc.blue(req.method)} ${pc.green(req.path)} ${pc.green('Mock')}`
      )

      return res.status(mock.status).json(mock.response)
    }

    // No mock found - either proxy to backend or return 404
    if (config.backendUrl) {
      console.log(
        `${pc.gray(new Date().toISOString())} ${pc.blue(req.method)} ${pc.yellow(req.path)} ${pc.cyan('Proxy')}`
      )

      // Proxy the request to backend
      const targetUrl = new URL(req.path, config.backendUrl)

      const proxyReq = http.request({
        hostname: targetUrl.hostname,
        port: targetUrl.port || 80,
        path: targetUrl.pathname + targetUrl.search,
        method: req.method,
        headers: {
          ...req.headers,
          host: targetUrl.host,
        },
      }, (proxyRes) => {
        // Forward the response status and headers
        res.status(proxyRes.statusCode || 200)
        proxyRes.headers && Object.entries(proxyRes.headers).forEach(([key, value]) => {
          if (value) res.setHeader(key, value)
        })

        // Stream the response body
        proxyRes.pipe(res)
      })

      proxyReq.on('error', (err) => {
        console.error(pc.red(`[Proxy] Error: ${err.message}`))
        res.status(502).json({
          error: 'Bad Gateway',
          message: `Failed to proxy request: ${err.message}`,
        })
      })

      // Forward the request body if present
      if (req.body && Object.keys(req.body).length > 0) {
        proxyReq.write(JSON.stringify(req.body))
      }

      proxyReq.end()
      return
    }

    // Log the request as not mocked
    await database.saveRequestLog({
      id: `req_${crypto.randomUUID()}`,
      method: req.method,
      path: req.path,
      query: req.query,
      headers: req.headers,
      body: req.body,
      response_status: 404,
      response_body: null,
      response_time: Date.now() - startTime,
      is_mocked: false,
      mock_id: null,
      timestamp: new Date().toISOString(),
    })

    res.status(404).json({
      error: 'Not Found',
      message: `No mock found for ${req.method} ${req.path}`,
    })
  })
}
