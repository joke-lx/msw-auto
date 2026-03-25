/**
 * 契约管理 API 路由
 */

import express from 'express'
import type { ContractManager } from '../../contract/manager.js'
import type { Database } from '../storage/database.js'

export function setupContractRoutes(
  app: express.Application,
  contractManager: ContractManager,
  database: Database
) {
  // ============ Contract CRUD API ============

  /**
   * GET /api/contracts
   * 获取所有契约
   */
  app.get('/api/contracts', async (req, res) => {
    try {
      const contracts = await contractManager.findAll()
      res.json(contracts)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  /**
   * GET /api/contracts/:id
   * 获取单个契约详情
   */
  app.get('/api/contracts/:id', async (req, res) => {
    try {
      const contract = await contractManager.findById(req.params.id)
      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' })
      }
      res.json(contract)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  /**
   * POST /api/contracts
   * 创建契约
   */
  app.post('/api/contracts', async (req, res) => {
    try {
      const { name, sourceType, sourceUrl, spec } = req.body

      if (!name || !spec) {
        return res.status(400).json({ error: 'name and spec are required' })
      }

      const contract = await contractManager.create({
        name,
        sourceType: sourceType || 'file',
        sourceUrl,
        spec,
      })

      res.status(201).json(contract)
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  })

  /**
   * DELETE /api/contracts/:id
   * 删除契约
   */
  app.delete('/api/contracts/:id', async (req, res) => {
    try {
      const deleted = await contractManager.delete(req.params.id)
      if (!deleted) {
        return res.status(404).json({ error: 'Contract not found' })
      }
      res.json({ success: true })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // ============ Contract Discovery API ============

  /**
   * POST /api/contracts/discover
   * 自动发现契约
   */
  app.post('/api/contracts/discover', async (req, res) => {
    try {
      const { projectPath, backendUrl, port, swaggerPath } = req.body

      const contracts = await contractManager.discover({
        projectPath,
        backendUrl,
        port,
        swaggerPath,
      })

      res.json({
        total: contracts.length,
        contracts,
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  /**
   * POST /api/contracts/:id/sync
   * 同步契约（重新获取最新内容）
   */
  app.post('/api/contracts/:id/sync', async (req, res) => {
    try {
      const contract = await contractManager.sync(req.params.id)
      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' })
      }
      res.json(contract)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // ============ Mock Generation API ============

  /**
   * GET /api/contracts/:id/mocks
   * 获取契约的所有 Mock 数据
   */
  app.get('/api/contracts/:id/mocks', async (req, res) => {
    try {
      const { endpoint, method } = req.query

      const mocks = contractManager.generateMocks(
        req.params.id,
        endpoint as string | undefined,
        method as string | undefined
      )

      res.json({
        contractId: req.params.id,
        total: mocks.length,
        mocks,
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  /**
   * POST /api/contracts/:id/mocks/generate
   * 生成指定端点的 Mock 数据
   */
  app.post('/api/contracts/:id/mocks/generate', async (req, res) => {
    try {
      const { endpoint, method } = req.body

      const mocks = contractManager.generateMocks(
        req.params.id,
        endpoint,
        method
      )

      if (mocks.length === 0) {
        return res.status(404).json({ error: 'No matching endpoint found' })
      }

      res.json(mocks[0])
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // ============ TypeScript Types API ============

  /**
   * GET /api/contracts/:id/types
   * 获取契约的 TypeScript 类型定义
   */
  app.get('/api/contracts/:id/types', async (req, res) => {
    try {
      const result = contractManager.generateTypes(req.params.id)

      res.json({
        contractId: result.contractId,
        types: result.types,
        interfaces: result.interfaces,
        filePath: result.filePath,
        generatedAt: result.generatedAt,
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  /**
   * POST /api/contracts/:id/types/download
   * 下载 TypeScript 类型文件
   */
  app.post('/api/contracts/:id/types/download', async (req, res) => {
    try {
      const result = contractManager.generateTypes(req.params.id)

      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="api-types.ts"`)
      res.send(result.types)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // ============ Validation API ============

  /**
   * POST /api/contracts/:id/validate
   * 验证前端代码是否正确使用 API
   */
  app.post('/api/contracts/:id/validate', async (req, res) => {
    try {
      const { frontendPath } = req.body

      if (!frontendPath) {
        return res.status(400).json({ error: 'frontendPath is required' })
      }

      // TODO: 实现前端验证
      res.json({
        contractId: req.params.id,
        status: 'pending',
        message: 'Validation started',
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // ============ Version/Diff API ============

  /**
   * GET /api/contracts/:id/history
   * 获取契约版本历史
   */
  app.get('/api/contracts/:id/history', async (req, res) => {
    try {
      // TODO: 实现版本历史
      res.json({
        contractId: req.params.id,
        versions: [],
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  /**
   * GET /api/contracts/:id/diff
   * 对比两个版本的差异
   */
  app.get('/api/contracts/:id/diff', async (req, res) => {
    try {
      const { version1, version2 } = req.query

      const diff = contractManager.diff(
        req.params.id,
        parseInt(version1 as string, 10),
        parseInt(version2 as string, 10)
      )

      if (!diff) {
        return res.status(404).json({ error: 'Could not compute diff' })
      }

      res.json(diff)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })
}
